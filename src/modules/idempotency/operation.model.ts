import mongoose, { Schema } from 'mongoose';
import type { OperationDoc } from './operation.types';

const operationSchema = new Schema<OperationDoc>(
  {
    referenceId: { type: String, required: true },
    type: { type: String, required: true },
    /** Stored so a replay can tell a different movement from the one this referenceId already committed. */
    fingerprint: { type: String, required: true },
    status: { type: String, required: true, enum: ['COMPLETED'] },
    result: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false, autoIndex: false },
);

/** Unique referenceId. A second insert fails, which is what stops a retry from moving the money again. */
operationSchema.index({ referenceId: 1 }, { unique: true });

export const OperationModel = mongoose.model<OperationDoc>('Operation', operationSchema, 'operations');
