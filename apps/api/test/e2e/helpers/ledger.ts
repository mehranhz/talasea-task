import { Types } from 'mongoose';
import { TransactionModel } from '../../../src/modules/transaction/transaction.model';

/** Builds an ObjectId whose timestamp is in the past, so archive treats the row as old. */
/** Builds an ObjectId whose timestamp is in the past, so archive treats the row as old. */
export function idAt(secondsAgo: number, counter: number): Types.ObjectId {
  const seconds = Math.floor(Date.now() / 1000) - secondsAgo;
  const hex = `${seconds.toString(16).padStart(8, '0')}aaaaaaaaaa${counter.toString(16).padStart(6, '0')}`;
  return new Types.ObjectId(hex);
}

/** Collects plan stage names. The history check requires IXSCAN and rejects a collection scan. */
/** Collects plan stage names. The history check requires IXSCAN and rejects a collection scan. */
export function winningStages(plan: unknown): string[] {
  if (!plan || typeof plan !== 'object') return [];
  const record = plan as {
    executionStats?: { executionStages?: unknown };
    queryPlanner?: { winningPlan?: unknown };
  };
  const found: string[] = [];
  walkStages(record.executionStats?.executionStages, found);
  if (found.length === 0) walkStages(record.queryPlanner?.winningPlan, found);
  return found;
}

/** Docs examined versus rows returned. One recent hot row should not read the archived history. */
/** Docs examined versus rows returned. One recent hot row should not read the archived history. */
export function executionStats(plan: unknown): { docs: number; returned: number } {
  if (!plan || typeof plan !== 'object' || !('executionStats' in plan)) return { docs: -1, returned: -1 };
  const stats = plan.executionStats;
  if (!stats || typeof stats !== 'object') return { docs: -1, returned: -1 };
  const docs =
    'totalDocsExamined' in stats && typeof stats.totalDocsExamined === 'number' ? stats.totalDocsExamined : -1;
  const returned = 'nReturned' in stats && typeof stats.nReturned === 'number' ? stats.nReturned : -1;
  return { docs, returned };
}

/** Walks nested explain nodes. An index scan under a limit still counts. */
/** Walks nested explain nodes. An index scan under a limit still counts. */
function walkStages(node: unknown, found: string[]): void {
  if (!node || typeof node !== 'object') return;
  if ('stage' in node && typeof node.stage === 'string') found.push(node.stage);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) walkStages(item, found);
    } else {
      walkStages(value, found);
    }
  }
}

/** Explains the same hinted history query the API uses, so the test sees the real plan. */
/** Explains the same hinted history query the API uses, so the test sees the real plan. */
export async function explainHistory(walletId: Types.ObjectId, limit: number): Promise<unknown> {
  return TransactionModel.find({ walletId })
    .sort({ _id: -1 })
    .hint({ walletId: 1, _id: -1 })
    .limit(limit)
    .explain('executionStats');
}
