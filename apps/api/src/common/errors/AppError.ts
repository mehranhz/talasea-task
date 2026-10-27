import { ErrorCode, HTTP_STATUS } from '@talasea/types';

export { ErrorCode, HTTP_STATUS };

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
    this.details = details;
  }
}
