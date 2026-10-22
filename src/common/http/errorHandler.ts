import type { NextFunction, Request, Response } from 'express';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import { AppError, ErrorCode } from '../errors/AppError';
import { IdempotencyKeyReusedError, isDuplicateKeyError, WalletExistsError } from '../errors/errors';

function isHttpBodyError(err: unknown): err is { status: number; message: string } {
  if (typeof err !== 'object' || err === null) return false;
  const status = (err as { status?: unknown }).status;
  return status === 400 || status === 413;
}

function requestIdOf(req: Request): string {
  return req.requestId || 'unknown';
}

function sendError(
  req: Request,
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  details: Record<string, unknown>,
): void {
  res.status(status).json({
    error: { code, message, details },
    meta: { requestId: requestIdOf(req) },
  });
}

export function errorHandler(logger: Logger) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof AppError) {
      sendError(req, res, err.httpStatus, err.code, err.message, err.details);
      return;
    }

    if (isHttpBodyError(err)) {
      sendError(req, res, 400, ErrorCode.Validation, err.status === 413 ? 'Request body is too large' : 'Invalid JSON', {});
      return;
    }

    if (err instanceof ZodError) {
      sendError(req, res, 400, ErrorCode.Validation, 'Validation failed', {
        issues: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    if (isDuplicateKeyError(err)) {
      const pattern = err.keyPattern ?? {};
      if ('referenceId' in pattern) {
        const referenceId = typeof err.keyValue?.referenceId === 'string' ? err.keyValue.referenceId : '';
        const mapped = new IdempotencyKeyReusedError(referenceId);
        sendError(req, res, mapped.httpStatus, mapped.code, mapped.message, mapped.details);
        return;
      }
      const userId = typeof err.keyValue?.userId === 'string' ? err.keyValue.userId : '';
      const asset = typeof err.keyValue?.asset === 'string' ? err.keyValue.asset : '';
      const mapped = new WalletExistsError(userId, asset);
      sendError(req, res, mapped.httpStatus, mapped.code, mapped.message, mapped.details);
      return;
    }

    logger.error({ err }, 'unhandled error');
    sendError(req, res, 500, ErrorCode.Internal, 'Internal error', {});
  };
}
