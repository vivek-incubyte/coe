import { describe, expect, it } from 'vitest';
import {
  CreateUserSchema,
  UserResponseSchema,
  UserSchema,
} from '@src/users/user.schema';

describe('UserSchema', () => {
  const validUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    password: 'dummyPassword',
    createdAt: new Date(),
  };

  it('accepts a fully valid user', () => {
    const result = UserSchema.safeParse(validUser);

    expect(result.success).toBe(true);
  });

  it('accepts a name longer than a single character', () => {
    const result = UserSchema.safeParse({
      ...validUser,
      name: 'Ada Lovelace',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a user with an empty string name', () => {
    const result = UserSchema.safeParse({ ...validUser, name: '' });

    expect(result.success).toBe(false);
  });

  it('rejects a user with no id field', () => {
    const { id, ...rest } = validUser;

    const result = UserSchema.safeParse(rest);

    expect(result.success).toBe(false);
  });

  it('rejects a user with no email field', () => {
    const { email, ...rest } = validUser;

    const result = UserSchema.safeParse(rest);

    expect(result.success).toBe(false);
  });

  it('rejects a user with no password field', () => {
    const { password, ...rest } = validUser;

    const result = UserSchema.safeParse(rest);

    expect(result.success).toBe(false);
  });

  it('rejects a user with no createdAt field', () => {
    const { createdAt, ...rest } = validUser;

    const result = UserSchema.safeParse(rest);

    expect(result.success).toBe(false);
  });
});

describe('UserResponseSchema', () => {
  const validResponse = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    createdAt: new Date().toISOString(),
  };

  it('accepts a fully valid response', () => {
    const result = UserResponseSchema.safeParse(validResponse);

    expect(result.success).toBe(true);
  });

  it('accepts a name longer than a single character', () => {
    const result = UserResponseSchema.safeParse({
      ...validResponse,
      name: 'Ada Lovelace',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a response with an empty string name', () => {
    const result = UserResponseSchema.safeParse({
      ...validResponse,
      name: '',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a response with no id field', () => {
    const { id, ...rest } = validResponse;

    const result = UserResponseSchema.safeParse(rest);

    expect(result.success).toBe(false);
  });

  it('ignores an extra password field since UserResponseSchema is not a strict object', () => {
    const result = UserResponseSchema.safeParse({
      ...validResponse,
      password: 'shouldNotBeHere',
    });

    expect(result.success).toBe(true);
  });

  it('rejects createdAt that is not an ISO datetime string', () => {
    const result = UserResponseSchema.safeParse({
      ...validResponse,
      createdAt: 'not-a-date',
    });

    expect(result.success).toBe(false);
  });
});

describe('CreateUserSchema', () => {
  it('parses a valid request with name, email and password', () => {
    const result = CreateUserSchema.parse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'dummyPassword',
    });

    expect(result).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'dummyPassword',
    });
  });

  it('rejects a request with no name field', () => {
    const result = CreateUserSchema.safeParse({
      email: 'ada@example.com',
      password: 'dummyPassword',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty string name', () => {
    const result = CreateUserSchema.safeParse({
      name: '',
      email: 'ada@example.com',
      password: 'dummyPassword',
    });

    expect(result.success).toBe(false);
  });

  it('accepts a single-character name', () => {
    const result = CreateUserSchema.safeParse({
      name: 'A',
      email: 'ada@example.com',
      password: 'dummyPassword',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a request with no email field', () => {
    const result = CreateUserSchema.safeParse({
      name: 'Ada Lovelace',
      password: 'dummyPassword',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty string email', () => {
    const result = CreateUserSchema.safeParse({
      name: 'Ada Lovelace',
      email: '',
      password: 'dummyPassword',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an email missing an @ symbol', () => {
    const result = CreateUserSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'not-an-email',
      password: 'dummyPassword',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an email missing a domain', () => {
    const result = CreateUserSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@',
      password: 'dummyPassword',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a request with no password', () => {
    const result = CreateUserSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a request with empty password', () => {
    const result = CreateUserSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@',
      password: '',
    });

    expect(result.success).toBe(false);
  });

  it('rejects password less than 5 characters', () => {
    const result = CreateUserSchema.safeParse({
      name: 'A',
      email: 'ada@example.com',
      password: '1234',
    });

    expect(result.success).toBe(false);
  });

  it('accepts password less than >=5 characters', () => {
    const result = CreateUserSchema.safeParse({
      name: 'A',
      email: 'ada@example.com',
      password: 'strongPassword',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a payload that includes an id field', () => {
    const result = CreateUserSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'dummyPassword',
      id: '123e4567-e89b-12d3-a456-426614174000',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a payload that includes a createdAt field', () => {
    const result = CreateUserSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'dummyPassword',
      createdAt: new Date().toISOString(),
    });

    expect(result.success).toBe(false);
  });

  it('rejects a payload with an unrecognized extra field', () => {
    const result = CreateUserSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'dummyPassword',
      role: 'admin',
    });

    expect(result.success).toBe(false);
  });
});
