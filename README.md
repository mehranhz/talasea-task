# Wallet service

I built this as the wallet service from the brief: create a wallet, deposit, withdraw, transfer, read a balance, and read history, under a load of more than two million users and several million transactions a day. The API is Node.js and Express. The source is TypeScript, compiled to CommonJS, which is the JavaScript the process actually runs. Docker starts `node dist/server.js` for the API and `node dist/worker.js` for the worker.

## What was asked

Each user can hold one wallet per asset and can do five things.

- Create a wallet. One wallet per user per asset. The schema was mine to choose, and this file is where that choice is explained.
- Deposit. The amount is greater than zero. Every call carries a `referenceId`. Repeating the same id returns the same result and does not credit the wallet again.
- Withdraw. The amount is greater than zero. The balance stays at zero or above. An insufficient balance is rejected. Concurrent withdrawals cannot spend the same money twice. `referenceId` makes the call idempotent.
- Transfer. A wallet cannot pay itself. The sender stays non-negative. The debit and the credit commit together, so money cannot leave the sender and miss the receiver. The same `referenceId` does not run a second time. Concurrent transfers stay consistent.
- Read the current balance on a path that can take a high request rate.
- Read transaction history on a query that stays fast as the ledger grows.

The stack in the brief is Node.js, Express, JavaScript, MongoDB, Redis, Docker, and Docker Compose. The design had to be defensible at that volume: collection shape, indexes, a bounded MongoDB pool, Redis used for the hot read path, concurrency control, idempotency, atomic transfers, pagination, and predictable errors. Every balance change has a ledger row. A retry does not move money again. Concurrent calls do not corrupt a balance.

Tests were optional in the brief. I kept `npm run test:e2e` and `npm run check:ledger` because they exercise those invariants. The implementation logic is still the part that answers the task.

## Why the architecture is split this way

Money is decided in MongoDB. The API returns as soon as that decision commits. Follow-up work runs in another process.

`src/server.ts` is a stateless API. A request hits Express, `WalletService` in `src/modules/wallet/wallet.service.ts` performs the money change, and the HTTP response is the committed result. The API process holds no session and publishes nothing to a queue on that path, so another API container can be added beside it.

`src/worker.ts` is the only process that consumes BullMQ. The queue names are in `src/modules/queue/queue.names.ts`.

- `outbox-relay` reads outbox rows written with the money change and enqueues the follow-up job.
- `notifications` is that follow-up. The user already has the money result from the HTTP call.
- `reconciliation` compares each wallet balance with the ledger.
- `ledger-archive` moves old ledger rows off the hot collection.

The outbox row is inserted in the same MongoDB transaction as the balance update and the ledger lines. The worker relays it later. A money event exists because the transaction committed, whether or not Redis or the queue is reachable at that moment.

MongoDB is the source of truth for money. `wallet.balance` is the debit authority. A withdrawal or a transfer debit is allowed only when that field covers the amount. The `transactions` collection is an append-only ledger of each wallet leg. It records the movement. It does not authorize the debit.

Redis is the fast path for the balance cache, rate limiting, and the idempotency lookup. Those three are allowed to miss. A cache miss falls through to MongoDB. The cache never authorizes a debit. Rate-limit settings are `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` in `.env.example` (60 seconds and 10000). The balance cache TTL is `BALANCE_CACHE_TTL_SECONDS` (30).

`connectMongo` in `src/config/mongo.ts` opens the pool with `MONGO_MAX_POOL_SIZE` and `MONGO_MIN_POOL_SIZE`. `.env.example` sets those to 50 and 5, so a burst of balance reads and money writes shares a bounded set of connections.

## Decisions

**Minor units.** Amounts are integers in minor units. Integer `$inc` and a balance comparison stay exact, which is what a concurrent debit needs. A float would make the "greater than zero" and "cannot go negative" rules ambiguous.

**One wallet per user per asset.** `WalletService.create` creates the wallet for a user and an asset. A unique index on `{ userId, asset }` is the rule from the brief, enforced in the database rather than only in the handler. `.env.example` lists the supported assets as `USD,EUR`.

**Idempotency keys live in MongoDB, with a Redis fast path.** Each money call stores its `referenceId` in MongoDB under a unique index, with the result that was returned. The same key replays that result, so a duplicate deposit, withdrawal, or transfer does not move money twice. Redis holds a recent copy of that key so a retry can return before another MongoDB read. The unique index is the guarantee. Redis is the fast path.

**Conditional debit.** Withdraw, and the sender side of a transfer, update the wallet only when `balance` is greater than or equal to the amount, in the same update that decrements it. Two concurrent debits cannot both match. If the balance is short, the operation is rejected. `wallet.balance` stays the authority, which is the concurrent-withdrawal rule in the brief.

**Transfers lock both wallets in a stable order, inside one MongoDB transaction.** `WalletService.transfer` sorts the two wallet ids, then debits one and credits the other in a single MongoDB transaction. The sort gives every transfer the same lock order, so two transfers crossing the same pair do not deadlock. The transaction makes the pair atomic: the sender is debited and the receiver is credited, or neither write remains. A transfer to the same wallet is rejected before that transaction starts. Compose starts MongoDB as a one-member replica set (`rs0` in `docker-compose.yml`) because a multi-document transaction needs a primary.

**History is paginated with an index hint and no skip.** `TransactionRepository.list` in `src/modules/transaction/transaction.repository.ts` pages by wallet with a cursor and hints the history index. There is no `skip`, so a deep page stays an index range read as the collection grows. The row already carries the fields the history response needs, so the list does not fan out into more queries.

**The archive job moves old rows and keeps their net on a rollup.** `TransactionRepository.moveOldBatch` moves ledger rows older than `LEDGER_ARCHIVE_AFTER_DAYS` (90 in `.env.example`) to `transactions_archive`. The net of each batch is added to `ledger_rollups`. `wallet.balance` is left unchanged. The hot collection stays bounded, and the debit authority stays the wallet document. The worker schedule is `LEDGER_ARCHIVE_CRON` (`15 3 * * *` in `.env.example`).

**Reconciliation compares the balance with the hot net plus the rollup.** The reconciliation job, on `RECONCILIATION_CRON` (`0 * * * *` in `.env.example`), compares `wallet.balance` with `TransactionRepository.netByWallet` plus `archivedNetByWallet`. Drift is logged. The job leaves the wallet document as it is.

**Docker Compose runs MongoDB, Redis, the API, and the worker.** `docker-compose.yml` is the four-process layout above. MongoDB 7 is published on port 27017. Redis 7 is published on port 6379, with AOF enabled. The API is published on port 3000. The worker has no host port. The API and the worker wait until MongoDB and Redis are healthy, then use `MONGO_URI=mongodb://mongo:27017/wallet?replicaSet=rs0` and `REDIS_URL=redis://redis:6379`.

**Errors share one envelope.** `errorHandler` in `src/common/http/errorHandler.ts` writes every failure as `{ error: { code, message, details }, meta: { requestId } }`. An `AppError` already carries the code, the status, the message, and `details`, so those four cases stay stable. Validation is `VALIDATION_ERROR` (400); a Zod failure lists `{ path, message }` under `details.issues`. An insufficient balance is `INSUFFICIENT_FUNDS` (422, `walletId`). A transfer to the same wallet is `SAME_WALLET_TRANSFER` (422, `walletId`). A second wallet for the same user and asset is `WALLET_EXISTS` (409, `userId` and `asset`), including when the unique index raises a duplicate key. A client tells those rejections apart from `code` and status.

## What I left out on purpose

I left authentication out. The brief is about balance, idempotency, and atomic transfers. A login layer would sit in front of the same `WalletService` methods.

I left automatic repair out. Reconciliation logs drift and does not write `wallet.balance`. A repair pass would be a second writer next to the debit authority.

I left webhooks out. `notifications` is the queue the outbox relay fills after the money transaction commits. The brief's contract is the synchronous result of deposit, withdraw, and transfer.

I left a multi-node replica set out. Compose runs one MongoDB member, initiated as `rs0`, which is enough for the transactions this service uses. Extra members would be an operations change. They would not change the debit rule, the ledger, or the outbox.

With those four left out, the brief is still covered. One wallet per user per asset. Deposits and withdrawals are idempotent and reject a non-positive amount. The balance cannot go negative, including under concurrent debits. A transfer is atomic. Balance reads have a Redis cache in front of MongoDB. History pages over an index. The ledger can grow, and the archive job keeps the hot collection to recent rows while the rollup preserves the archived net.

## How to run

Node 20 or newer. Copy `.env.example` to `.env`. Compose loads that file and overrides `MONGO_URI` and `REDIS_URL` for the `api` and `worker` services so they use the Docker hostnames.

Redis is published on **6379**. MongoDB is published on **27017**. The API is published on **3000**.

```bash
docker compose up --build
```

The `api` service runs `node dist/server.js`. The `worker` service runs `node dist/worker.js`.

To run the same processes on the host, point `.env` at the published ports: `MONGO_URI=mongodb://127.0.0.1:27017/wallet?replicaSet=rs0` and `REDIS_URL=redis://127.0.0.1:6379`. `connectMongo` in `src/config/mongo.ts` sets `directConnection` when that URI is localhost, which a one-member set on the host needs. Then:

```bash
npm run dev
npm run dev:worker
```

`npm run build` compiles to `dist/`. `npm run start` and `npm run start:worker` run those files. `npm run typecheck` is `tsc --noEmit`.

`npm run demo` runs `scripts/concurrency-demo.ts`. `npm run check:ledger` runs `scripts/ledger-check.ts`. `npm run test:e2e` runs `test/e2e/**/*.test.ts` with `--test-concurrency=1`.

`tutorial/README.md` is the longer walkthrough of the same service.
