import { Types, type ClientSession } from 'mongoose';
import { OutboxModel } from './outbox.model';
import type { NewOutboxEvent, OutboxDoc } from './outbox.types';

export class OutboxRepository {
  /** Inserts the outbox row in the same transaction as the money write, so the event exists only if the money committed. */
  async insert(input: NewOutboxEvent, session: ClientSession): Promise<OutboxDoc> {
    const created = await OutboxModel.create(
      [
        {
          eventType: input.eventType,
          payload: input.payload,
          publishedAt: null,
          createdAt: new Date(),
        },
      ],
      { session },
    );
    const doc = created[0];
    if (!doc) throw new Error('Outbox insert returned no document');
    return doc.toObject();
  }

  /** Oldest unpublished rows first. A row is visible only after the money transaction that wrote it has committed. */
  async findUnpublished(limit: number): Promise<OutboxDoc[]> {
    return OutboxModel.find({ publishedAt: null }).sort({ _id: 1 }).limit(limit).lean<OutboxDoc[]>().exec();
  }

  /** Marks relayed rows published so a later pass does not enqueue the same event again. */
  async markPublished(ids: Types.ObjectId[]): Promise<void> {
    if (ids.length === 0) return;
    await OutboxModel.updateMany({ _id: { $in: ids } }, { $set: { publishedAt: new Date() } }).exec();
  }
}
