import { z } from 'zod';

export const RegisterSchema = z.strictObject({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(5).max(100),
});
export type RegisterDto = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.strictObject({
  email: z.email(),
  password: z.string(),
});
export type LoginDto = z.infer<typeof LoginSchema>;
