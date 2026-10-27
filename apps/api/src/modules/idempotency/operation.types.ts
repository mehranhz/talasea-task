import type { Types } from 'mongoose';

export interface StoredResult {
  statusCode: number;
  data: Record<string, unknown>;
}

export interface OperationDoc {
  _id: Types.ObjectId;
  referenceId: string;
  type: string;
  fingerprint: string;
  status: 'COMPLETED';
  result: StoredResult;
  createdAt: Date;
}

export interface NewOperation {
  referenceId: string;
  type: string;
  fingerprint: string;
  result: StoredResult;
}
