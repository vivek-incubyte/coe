import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const taskStatusEnum = pgEnum('task_status', [
  'OPEN',
  'IN_PROGRESS',
  'DONE',
]);

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  status: taskStatusEnum('status').notNull().default('OPEN'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
