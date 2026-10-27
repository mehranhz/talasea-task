import mongoose, { Schema } from 'mongoose';
import type { OutboxDoc } from './outbox.types';

/** Written in the same transaction as the balance change, so the event exists only if that movement committed. */
const outboxSchema = new Schema<OutboxDoc>(
  {
    eventType: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    publishedAt: { type: Date, default: null },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false, autoIndex: false },
);

/** Unpublished rows only, oldest first, so the relay scans events that committed with the balance and are not sent yet. */
outboxSchema.index({ publishedAt: 1, _id: 1 }, { partialFilterExpression: { publishedAt: null } });

export const OutboxModel = mongoose.model<OutboxDoc>('Outbox', outboxSchema, 'outbox');
