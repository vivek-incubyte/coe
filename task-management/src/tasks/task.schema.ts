import { z } from 'zod';

export const TaskStatus = z.enum(['OPEN', 'IN_PROGRESS', 'DONE']);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const TaskSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: TaskStatus,
  createdAt: z.date(),
});
export type Task = z.infer<typeof TaskSchema>;

export const TaskResponseSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: TaskStatus,
  createdAt: z.iso.datetime(),
});
export type TaskResponseDto = z.infer<typeof TaskResponseSchema>;

export const TaskIdParamSchema = z.uuid();

export const PaginationQuerySchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().nonnegative().default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const CreateTaskSchema = z.strictObject({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: TaskStatus.default(TaskStatus.enum.OPEN),
});
export type CreateTaskDto = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z
  .strictObject({
    title: z.string().min(1).max(200),
    description: z.string().max(2000),
    status: TaskStatus,
  })
  .partial();
export type UpdateTaskDto = z.infer<typeof UpdateTaskSchema>;
