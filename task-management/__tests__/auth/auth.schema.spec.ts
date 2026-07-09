import { describe, expect, it } from 'vitest';
import { LoginSchema, RegisterSchema } from '@src/auth/auth.schema';

describe('RegisterSchema', () => {
  it('parses a valid request with name, email and password', () => {
    const result = RegisterSchema.parse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'strongPassword',
    });

    expect(result).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'strongPassword',
    });
  });

  it('rejects a request with no name field', () => {
    const result = RegisterSchema.safeParse({
      email: 'ada@example.com',
      password: 'strongPassword',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty string name', () => {
    const result = RegisterSchema.safeParse({
      name: '',
      email: 'ada@example.com',
      password: 'strongPassword',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a request with no email field', () => {
    const result = RegisterSchema.safeParse({
      name: 'Ada Lovelace',
      password: 'strongPassword',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an email missing an @ symbol', () => {
    const result = RegisterSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'not-an-email',
      password: 'strongPassword',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an email missing a domain', () => {
    const result = RegisterSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@',
      password: 'strongPassword',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a request with no password field', () => {
    const result = RegisterSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    });

    expect(result.success).toBe(false);
  });

  it('rejects password shorter than 5 characters', () => {
    const result = RegisterSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: '1234',
    });

    expect(result.success).toBe(false);
  });

  it('accepts password exactly 5 characters long', () => {
    const result = RegisterSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: '12345',
    });

    expect(result.success).toBe(true);
  });

  it('accepts password exactly 100 characters long', () => {
    const result = RegisterSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'a'.repeat(100),
    });

    expect(result.success).toBe(true);
  });

  it('rejects password longer than 100 characters', () => {
    const result = RegisterSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'a'.repeat(101),
    });

    expect(result.success).toBe(false);
  });

  it('rejects a payload with an unrecognized extra field', () => {
    const result = RegisterSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'strongPassword',
      role: 'admin',
    });

    expect(result.success).toBe(false);
  });
});

describe('LoginSchema', () => {
  it('parses a valid request with email and password', () => {
    const result = LoginSchema.parse({
      email: 'ada@example.com',
      password: 'strongPassword',
    });

    expect(result).toEqual({
      email: 'ada@example.com',
      password: 'strongPassword',
    });
  });

  it('rejects a request with no email field', () => {
    const result = LoginSchema.safeParse({
      password: 'strongPassword',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a request with no password field', () => {
    const result = LoginSchema.safeParse({
      email: 'ada@example.com',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an email missing an @ symbol', () => {
    const result = LoginSchema.safeParse({
      email: 'not-an-email',
      password: 'strongPassword',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a payload with an unrecognized extra field', () => {
    const result = LoginSchema.safeParse({
      email: 'ada@example.com',
      password: 'strongPassword',
      rememberMe: true,
    });

    expect(result.success).toBe(false);
  });

  it('accepts an empty string password, deferring credential-matching to the service layer', () => {
    const result = LoginSchema.safeParse({
      email: 'ada@example.com',
      password: '',
    });

    expect(result.success).toBe(true);
  });
});
