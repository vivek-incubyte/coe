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
