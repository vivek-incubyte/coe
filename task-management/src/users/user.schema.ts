import { z } from 'zod';

export const UserSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  email: z.email(),
  password: z.string(),
  createdAt: z.date(),
});
export type User = z.infer<typeof UserSchema>;

export type PublicUser = Omit<User, 'password'>;

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
  password: z.string().min(5).max(100),
});
export type CreateUserDto = z.infer<typeof CreateUserSchema>;
