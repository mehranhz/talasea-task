import type { Types } from 'mongoose';

export interface OutboxDoc {
  _id: Types.ObjectId;
  eventType: string;
  payload: Record<string, unknown>;
  publishedAt: Date | null;
  createdAt: Date;
}

export interface NewOutboxEvent {
  eventType: string;
  payload: Record<string, unknown>;
}
