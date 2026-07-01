import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../infra/database/schema';
import { tasks } from '../infra/database/schema';
import type { Task, TaskStatus } from './task.schema';

type DB = ReturnType<typeof drizzle<typeof schema>>;

export type CreateTaskInput = {
  title: string;
  description?: string;
  status?: TaskStatus;
};

export class TasksRepository {
  constructor(private readonly db: DB) {}

  async create(input: CreateTaskInput): Promise<Task> {
    const [row] = await this.db
      .insert(tasks)
      .values({
        title: input.title,
        description: input.description,
        status: input.status,
      })
      .returning();
    return this.toTask(row);
  }

  private toTask(row: typeof tasks.$inferSelect): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      status: row.status as TaskStatus,
      createdAt: row.createdAt,
    };
  }
}
