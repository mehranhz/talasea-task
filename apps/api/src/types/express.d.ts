declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }

    interface Locals {
      validated?: {
        body: unknown;
        params: unknown;
        query: unknown;
      };
    }
  }
}

export {};
