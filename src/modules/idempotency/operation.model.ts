import mongoose, { Schema } from 'mongoose';
import type { OperationDoc } from './operation.types';

const operationSchema = new Schema<OperationDoc>(
  {
    referenceId: { type: String, required: true },
    type: { type: String, required: true },
    fingerprint: { type: String, required: true },
    status: { type: String, required: true, enum: ['COMPLETED'] },
    result: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false, autoIndex: false },
);

operationSchema.index({ referenceId: 1 }, { unique: true });

export const OperationModel = mongoose.model<OperationDoc>('Operation', operationSchema, 'operations');
