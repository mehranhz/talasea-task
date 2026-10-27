import type { Request, Response } from 'express';
import { toObjectId } from '../../common/objectId';
import { getValidated } from '../../common/http/validate';
import { sendData } from '../../common/http/respond';
import type { WalletService } from './wallet.service';
import type { CreateWalletBody, MoneyBody, TransferBody, WalletIdParams } from './wallet.schemas';

export class WalletController {
  constructor(private readonly wallets: WalletService) {}

  /** Opens a zero wallet first, so a later deposit has an account to land in. */
  create = async (req: Request, res: Response): Promise<void> => {
    const { body } = getValidated<CreateWalletBody, unknown, unknown>(res);
    const wallet = await this.wallets.create(body.userId, body.asset);
    sendData(req, res, 201, wallet);
  };

  /** Returns the live balance and marks it uncacheable, so a proxy cannot serve a figure a later debit already changed. */
  balance = async (req: Request, res: Response): Promise<void> => {
    const { params } = getValidated<unknown, WalletIdParams, unknown>(res);
    const balance = await this.wallets.getBalance(toObjectId(params.walletId));
    res.setHeader('Cache-Control', 'no-store');
    sendData(req, res, 200, balance);
  };

  /** Credits this wallet once for the body's referenceId. A retry returns that credit. */
  deposit = async (req: Request, res: Response): Promise<void> => {
    const { params, body } = getValidated<MoneyBody, WalletIdParams, unknown>(res);
    const outcome = await this.wallets.deposit(toObjectId(params.walletId), body.amount, body.referenceId);
    this.reply(req, res, outcome);
  };

  /** Debits this wallet once for the body's referenceId. A retry returns that debit. */
  withdraw = async (req: Request, res: Response): Promise<void> => {
    const { params, body } = getValidated<MoneyBody, WalletIdParams, unknown>(res);
    const outcome = await this.wallets.withdraw(toObjectId(params.walletId), body.amount, body.referenceId);
    this.reply(req, res, outcome);
  };

  /** Moves the amount once for the body's referenceId. Both wallets share that one outcome. */
  transfer = async (req: Request, res: Response): Promise<void> => {
    const { body } = getValidated<TransferBody, unknown, unknown>(res);
    const outcome = await this.wallets.transfer(
      toObjectId(body.fromWalletId),
      toObjectId(body.toWalletId),
      body.amount,
      body.referenceId,
    );
    this.reply(req, res, outcome);
  };

  /** Marks a replayed reference so the client can tell a duplicate post from a second movement. */
  private reply(
    req: Request,
    res: Response,
    outcome: { statusCode: number; data: Record<string, unknown>; replayed: boolean },
  ): void {
    if (outcome.replayed) res.setHeader('Idempotency-Replayed', 'true');
    sendData(req, res, outcome.statusCode, outcome.data);
  }
}
