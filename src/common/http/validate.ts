import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

export interface ValidatedParts<TBody, TParams, TQuery> {
  body: TBody;
  params: TParams;
  query: TQuery;
}

export function validate<TBody, TParams, TQuery>(schemas: {
  body?: ZodType<TBody>;
  params?: ZodType<TParams>;
  query?: ZodType<TQuery>;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const body = schemas.body ? schemas.body.parse(req.body) : (undefined as TBody);
      const params = schemas.params ? schemas.params.parse(req.params) : (undefined as TParams);
      const query = schemas.query ? schemas.query.parse(req.query) : (undefined as TQuery);
      res.locals.validated = { body, params, query };
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function getValidated<TBody, TParams, TQuery>(
  res: Response,
): ValidatedParts<TBody, TParams, TQuery> {
  const validated = res.locals.validated;
  if (!validated) {
    throw new Error('Validation middleware did not run');
  }
  return validated as ValidatedParts<TBody, TParams, TQuery>;
}
