import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  DATABASE_CONNECTION,
  type Database,
} from '../infra/database/database.module';
import { tasks } from '../infra/database/schema';
import type { Task, TaskStatus } from './task.schema';

export type CreateTaskInput = {
  title: string;
  description?: string;
  status?: TaskStatus;
};

export type UpdateTaskInput = Partial<CreateTaskInput>;

@Injectable()
export class TasksRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

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

  async findAll(): Promise<Task[]> {
    const rows = await this.db.select().from(tasks);
    return rows.map((row) => this.toTask(row));
  }

  async findById(id: string): Promise<Task | null> {
    const [row] = await this.db.select().from(tasks).where(eq(tasks.id, id));
    return row ? this.toTask(row) : null;
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task | null> {
    if (Object.keys(input).length === 0) {
      return this.findById(id);
    }

    const [row] = await this.db
      .update(tasks)
      .set(input)
      .where(eq(tasks.id, id))
      .returning();
    return row ? this.toTask(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const [row] = await this.db
      .delete(tasks)
      .where(eq(tasks.id, id))
      .returning();
    return row !== undefined;
  }

  private toTask(row: typeof tasks.$inferSelect): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      status: row.status,
      createdAt: row.createdAt,
    };
  }
}
