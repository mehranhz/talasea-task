import type { NextFunction, Request, Response } from 'express';

const ALLOWED_METHODS = 'GET, POST, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, x-request-id';
const EXPOSED_HEADERS = 'x-request-id, Idempotency-Replayed';

/**
 * Allows the configured web origins to call the API from a browser.
 * Any other origin is left without CORS headers. Auth is unchanged because this service has none.
 */
export function corsMiddleware(allowedOrigins: readonly string[]) {
  const allowed = new Set(allowedOrigins);
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.header('origin');
    if (origin && allowed.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
      res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
      res.setHeader('Access-Control-Expose-Headers', EXPOSED_HEADERS);
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
}
