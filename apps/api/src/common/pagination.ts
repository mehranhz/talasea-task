import { Types } from 'mongoose';
import { ValidationError } from './errors/errors';
import { toObjectId } from './objectId';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function clampLimit(value: number | undefined): number {
  if (value === undefined) return DEFAULT_LIMIT;
  return Math.min(value, MAX_LIMIT);
}

export function encodeCursor(id: Types.ObjectId): string {
  return Buffer.from(id.toHexString(), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): Types.ObjectId {
  const hex = Buffer.from(cursor, 'base64url').toString('utf8');
  if (!/^[a-fA-F0-9]{24}$/.test(hex)) {
    throw new ValidationError('Invalid cursor');
  }
  return toObjectId(hex);
}
