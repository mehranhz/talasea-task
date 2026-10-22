import type { Request, Response } from 'express';
import { toObjectId } from '../../common/objectId';
import { getValidated } from '../../common/http/validate';
import { sendData } from '../../common/http/respond';
import type { WalletService } from './wallet.service';
import type { CreateWalletBody, MoneyBody, TransferBody, WalletIdParams } from './wallet.schemas';

export class WalletController {
  constructor(private readonly wallets: WalletService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const { body } = getValidated<CreateWalletBody, unknown, unknown>(res);
    const wallet = await this.wallets.create(body.userId, body.asset);
    sendData(req, res, 201, wallet);
  };

  balance = async (req: Request, res: Response): Promise<void> => {
    const { params } = getValidated<unknown, WalletIdParams, unknown>(res);
    const balance = await this.wallets.getBalance(toObjectId(params.walletId));
    res.setHeader('Cache-Control', 'no-store');
    sendData(req, res, 200, balance);
  };

  deposit = async (req: Request, res: Response): Promise<void> => {
    const { params, body } = getValidated<MoneyBody, WalletIdParams, unknown>(res);
    const outcome = await this.wallets.deposit(toObjectId(params.walletId), body.amount, body.referenceId);
    this.reply(req, res, outcome);
  };

  withdraw = async (req: Request, res: Response): Promise<void> => {
    const { params, body } = getValidated<MoneyBody, WalletIdParams, unknown>(res);
    const outcome = await this.wallets.withdraw(toObjectId(params.walletId), body.amount, body.referenceId);
    this.reply(req, res, outcome);
  };

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

  private reply(
    req: Request,
    res: Response,
    outcome: { statusCode: number; data: Record<string, unknown>; replayed: boolean },
  ): void {
    if (outcome.replayed) res.setHeader('Idempotency-Replayed', 'true');
    sendData(req, res, outcome.statusCode, outcome.data);
  }
}
