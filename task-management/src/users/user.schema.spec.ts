import { describe, expect, it } from 'vitest';
import { CreateUserSchema } from './user.schema';

describe('CreateUserSchema', () => {
  it('parses a valid request with name and email', () => {
    const result = CreateUserSchema.parse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    });

    expect(result).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    });
  });

  it('rejects a request with no name field', () => {
    const result = CreateUserSchema.safeParse({ email: 'ada@example.com' });

    expect(result.success).toBe(false);
  });

  it('rejects an empty string name', () => {
    const result = CreateUserSchema.safeParse({
      name: '',
      email: 'ada@example.com',
    });

    expect(result.success).toBe(false);
  });

  it('accepts a single-character name', () => {
    const result = CreateUserSchema.safeParse({
      name: 'A',
      email: 'ada@example.com',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a request with no email field', () => {
    const result = CreateUserSchema.safeParse({ name: 'Ada Lovelace' });

    expect(result.success).toBe(false);
  });

  it('rejects an empty string email', () => {
    const result = CreateUserSchema.safeParse({
      name: 'Ada Lovelace',
      email: '',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an email missing an @ symbol', () => {
    const result = CreateUserSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'not-an-email',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an email missing a domain', () => {
    const result = CreateUserSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a payload that includes an id field', () => {
    const result = CreateUserSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      id: '123e4567-e89b-12d3-a456-426614174000',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a payload that includes a createdAt field', () => {
    const result = CreateUserSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      createdAt: new Date().toISOString(),
    });

    expect(result.success).toBe(false);
  });

  it('rejects a payload with an unrecognized extra field', () => {
    const result = CreateUserSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      role: 'admin',
    });

    expect(result.success).toBe(false);
  });
});
