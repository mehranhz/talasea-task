import mongoose, { Schema } from 'mongoose';
import type { OutboxDoc } from './outbox.types';

const outboxSchema = new Schema<OutboxDoc>(
  {
    eventType: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    publishedAt: { type: Date, default: null },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false, autoIndex: false },
);

outboxSchema.index({ publishedAt: 1, _id: 1 }, { partialFilterExpression: { publishedAt: null } });

export const OutboxModel = mongoose.model<OutboxDoc>('Outbox', outboxSchema, 'outbox');
