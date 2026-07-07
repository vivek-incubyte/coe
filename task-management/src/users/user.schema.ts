import { z } from 'zod';

export const UserSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  email: z.email(),
  createdAt: z.date(),
});
export type User = z.infer<typeof UserSchema>;

export const UserResponseSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  email: z.email(),
  createdAt: z.iso.datetime(),
});
export type UserResponseDto = z.infer<typeof UserResponseSchema>;

export const CreateUserSchema = z.strictObject({
  name: z.string().min(1),
  email: z.email(),
});
export type CreateUserDto = z.infer<typeof CreateUserSchema>;
