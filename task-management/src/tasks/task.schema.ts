import {
  MAX_SEARCH_LENGTH,
  PAGINATION_DEFAULT,
  PAGINATION_MAX,
} from '@src/config/constants';
import { taskStatusEnum } from '@src/infra/database/schema';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const TaskStatus = z.enum(taskStatusEnum.enumValues);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const TaskSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: TaskStatus,
  createdAt: z.date(),
  userId: z.uuid().nullable(),
});
export type Task = z.infer<typeof TaskSchema>;

export const TaskResponseSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: TaskStatus,
  createdAt: z.iso.datetime(),
  userId: z.uuid().nullable(),
});
export class TaskResponseDto extends createZodDto(TaskResponseSchema) {}

export const TaskIdParamSchema = z.uuid();

const Pagination = z.strictObject({
  limit: z.coerce
    .number()
    .int()
    .nonnegative()
    .max(PAGINATION_MAX)
    .default(PAGINATION_DEFAULT),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const GetAllTasksReq = Pagination.extend({
  search: z.string().trim().min(1).max(MAX_SEARCH_LENGTH).optional(),
  status: TaskStatus.optional(),
});

export type GetAllTasksReq = z.infer<typeof GetAllTasksReq>;

export class GetAllTasksQueryDto extends createZodDto(GetAllTasksReq) {}

export const CreateTaskSchema = z.strictObject({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: TaskStatus.default(TaskStatus.enum.OPEN),
  userId: z.uuid().nullable().optional(),
});
export class CreateTaskDto extends createZodDto(CreateTaskSchema) {}

export const UpdateTaskSchema = z
  .strictObject({
    title: z.string().min(1).max(200),
    description: z.string().max(2000),
    status: TaskStatus,
    userId: z.uuid().nullable(),
  })
  .partial();
export class UpdateTaskDto extends createZodDto(UpdateTaskSchema) {}
