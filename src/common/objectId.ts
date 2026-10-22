import { Types } from 'mongoose';
import { ValidationError } from './errors/errors';

const OBJECT_ID_PATTERN = /^[a-fA-F0-9]{24}$/;

export function toObjectId(id: string): Types.ObjectId {
  if (!OBJECT_ID_PATTERN.test(id)) {
    throw new ValidationError('Invalid id', { id });
  }
  return new Types.ObjectId(id);
}
