import { Types, type ClientSession } from 'mongoose';
import { OutboxModel } from './outbox.model';
import type { NewOutboxEvent, OutboxDoc } from './outbox.types';

export class OutboxRepository {
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

  async findUnpublished(limit: number): Promise<OutboxDoc[]> {
    return OutboxModel.find({ publishedAt: null }).sort({ _id: 1 }).limit(limit).lean<OutboxDoc[]>().exec();
  }

  async markPublished(ids: Types.ObjectId[]): Promise<void> {
    if (ids.length === 0) return;
    await OutboxModel.updateMany({ _id: { $in: ids } }, { $set: { publishedAt: new Date() } }).exec();
  }
}
