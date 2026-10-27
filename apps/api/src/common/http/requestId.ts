import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { requestContext } from '../../config/logger';

const MAX_REQUEST_ID_LENGTH = 128;

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('x-request-id');
  const requestId =
    header && header.length > 0 && header.length <= MAX_REQUEST_ID_LENGTH ? header : randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  requestContext.run({ requestId }, () => {
    next();
  });
}
