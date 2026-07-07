import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { TABLE_USERS } from './users.schema';

export const taskStatusEnum = pgEnum('task_status', [
  'OPEN',
  'IN_PROGRESS',
  'DONE',
]);

export const TABLE_TASKS = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  status: taskStatusEnum('status').notNull().default('OPEN'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  userId: uuid('user_id').references(() => TABLE_USERS.id, {
    onDelete: 'set null',
  }),
});
