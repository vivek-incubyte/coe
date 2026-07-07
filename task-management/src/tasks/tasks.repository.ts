import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import {
  DATABASE_CONNECTION,
  type Database,
} from '../infra/database/database.module';
import { TABLE_TASKS } from '../infra/database/schema';
import type { Task, TaskStatus, PaginationQuery } from './task.schema';

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
      .insert(TABLE_TASKS)
      .values({
        title: input.title,
        description: input.description,
        status: input.status,
      })
      .returning();
    return this.toTask(row)!;
  }

  async findAll(pagination: PaginationQuery): Promise<Task[]> {
    const tasks = await this.db
      .select()
      .from(TABLE_TASKS)
      .orderBy(asc(TABLE_TASKS.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);

    return tasks.map((row) => this.toTask(row)!);
  }

  async findById(id: string): Promise<Task | null> {
    const [task] = await this.db
      .select()
      .from(TABLE_TASKS)
      .where(eq(TABLE_TASKS.id, id));
    return this.toTask(task);
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task | null> {
    if (Object.keys(input).length === 0) {
      return this.findById(id);
    }

    const [task] = await this.db
      .update(TABLE_TASKS)
      .set(input)
      .where(eq(TABLE_TASKS.id, id))
      .returning();
    return this.toTask(task);
  }

  async delete(id: string): Promise<boolean> {
    const [task] = await this.db
      .delete(TABLE_TASKS)
      .where(eq(TABLE_TASKS.id, id))
      .returning();
    return task !== undefined;
  }

  private toTask(task: typeof TABLE_TASKS.$inferSelect | null): Task | null {
    if (!task) {
      return null;
    }

    return {
      id: task.id,
      title: task.title,
      description: task.description ?? undefined,
      status: task.status,
      createdAt: task.createdAt,
    };
  }
}
