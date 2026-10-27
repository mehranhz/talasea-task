import type { Request, Response } from 'express';

export function sendData(
  req: Request,
  res: Response,
  status: number,
  data: unknown,
  meta: Record<string, unknown> = {},
): void {
  res.status(status).json({
    data,
    meta: { requestId: req.requestId, ...meta },
  });
}
