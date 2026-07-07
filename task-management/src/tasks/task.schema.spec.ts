import { describe, expect, it } from 'vitest';
import {
  CreateTaskSchema,
  PaginationQuerySchema,
  TaskIdParamSchema,
  TaskStatus,
  UpdateTaskSchema,
} from './task.schema';

describe('PaginationQuerySchema', () => {
  it('defaults limit to 20 when omitted', () => {
    const result = PaginationQuerySchema.parse({});

    expect(result.limit).toBe(20);
  });

  it('defaults offset to 0 when omitted', () => {
    const result = PaginationQuerySchema.parse({});

    expect(result.offset).toBe(0);
  });

  it('coerces numeric query string values into numbers', () => {
    const result = PaginationQuerySchema.parse({ limit: '5', offset: '10' });

    expect(result).toEqual({ limit: 5, offset: 10 });
  });

  it('accepts zero as a valid limit and offset', () => {
    const result = PaginationQuerySchema.parse({ limit: '0', offset: '0' });

    expect(result).toEqual({ limit: 0, offset: 0 });
  });

  it('rejects a negative limit', () => {
    const result = PaginationQuerySchema.safeParse({ limit: '-1' });

    expect(result.success).toBe(false);
  });

  it('rejects a negative offset', () => {
    const result = PaginationQuerySchema.safeParse({ offset: '-1' });

    expect(result.success).toBe(false);
  });

  it('rejects a non-integer limit', () => {
    const result = PaginationQuerySchema.safeParse({ limit: '1.5' });

    expect(result.success).toBe(false);
  });

  it('rejects a non-integer offset', () => {
    const result = PaginationQuerySchema.safeParse({ offset: '1.5' });

    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric limit', () => {
    const result = PaginationQuerySchema.safeParse({ limit: 'abc' });

    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric offset', () => {
    const result = PaginationQuerySchema.safeParse({ offset: 'abc' });

    expect(result.success).toBe(false);
  });

  it('accepts a search string and includes it in the parsed result', () => {
    const result = PaginationQuerySchema.parse({ search: 'urgent' });

    expect(result).toEqual({ search: 'urgent', limit: 20, offset: 0 });
  });

  it('search omitted defaults to undefined', () => {
    const result = PaginationQuerySchema.parse({});

    expect(result).toEqual({ search: undefined, limit: 20, offset: 0 });
  });

  it('rejects an empty or whitespace-only search string', () => {
    const result = PaginationQuerySchema.safeParse({ search: '   ' });

    expect(result.success).toBe(false);
  });
});

describe('TaskIdParamSchema', () => {
  it('accepts a well-formed uuid', () => {
    const result = TaskIdParamSchema.safeParse(
      '123e4567-e89b-12d3-a456-426614174000',
    );

    expect(result.success).toBe(true);
  });

  it('rejects a malformed uuid', () => {
    const result = TaskIdParamSchema.safeParse('not-a-uuid');

    expect(result.success).toBe(false);
  });

  it('rejects an empty string', () => {
    const result = TaskIdParamSchema.safeParse('');

    expect(result.success).toBe(false);
  });
});

describe('CreateTaskSchema', () => {
  it('parses a valid request with title, description, and status', () => {
    const result = CreateTaskSchema.parse({
      title: 'Write tests',
      description: 'Cover the create endpoint',
      status: TaskStatus.enum.IN_PROGRESS,
    });

    expect(result).toEqual({
      title: 'Write tests',
      description: 'Cover the create endpoint',
      status: TaskStatus.enum.IN_PROGRESS,
    });
  });

  it('defaults status to OPEN when status is omitted', () => {
    const result = CreateTaskSchema.parse({ title: 'Write tests' });

    expect(result.status).toBe(TaskStatus.enum.OPEN);
  });

  it('accepts a request without a description', () => {
    const result = CreateTaskSchema.parse({ title: 'Write tests' });

    expect(result.description).toBeUndefined();
  });

  it('rejects a request with no title field', () => {
    const result = CreateTaskSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it('rejects an empty string title', () => {
    const result = CreateTaskSchema.safeParse({ title: '' });

    expect(result.success).toBe(false);
  });

  it('accepts a title exactly at the 200 character limit', () => {
    const result = CreateTaskSchema.safeParse({ title: 'a'.repeat(200) });

    expect(result.success).toBe(true);
  });

  it('rejects a title exceeding 200 characters', () => {
    const result = CreateTaskSchema.safeParse({ title: 'a'.repeat(201) });

    expect(result.success).toBe(false);
  });

  it('accepts a description exactly at the 2000 character limit', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'Write tests',
      description: 'a'.repeat(2000),
    });

    expect(result.success).toBe(true);
  });

  it('rejects a description exceeding 2000 characters', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'Write tests',
      description: 'a'.repeat(2001),
    });

    expect(result.success).toBe(false);
  });

  it('rejects a status value outside OPEN, IN_PROGRESS, DONE', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'Write tests',
      status: 'CANCELLED',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a payload that includes an id field', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'Write tests',
      id: '123e4567-e89b-12d3-a456-426614174000',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a payload that includes a createdAt field', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'Write tests',
      createdAt: new Date().toISOString(),
    });

    expect(result.success).toBe(false);
  });
});

describe('UpdateTaskSchema', () => {
  it('accepts an empty object, updating nothing', () => {
    const result = UpdateTaskSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it('accepts a partial payload with only title set', () => {
    const result = UpdateTaskSchema.parse({ title: 'Updated title' });

    expect(result).toEqual({ title: 'Updated title' });
  });

  it('accepts a payload with title, description, and status all set', () => {
    const result = UpdateTaskSchema.parse({
      title: 'Updated title',
      description: 'Updated description',
      status: TaskStatus.enum.DONE,
    });

    expect(result).toEqual({
      title: 'Updated title',
      description: 'Updated description',
      status: TaskStatus.enum.DONE,
    });
  });

  it('rejects an empty string title', () => {
    const result = UpdateTaskSchema.safeParse({ title: '' });

    expect(result.success).toBe(false);
  });

  it('accepts a title exactly at the 200 character limit', () => {
    const result = UpdateTaskSchema.safeParse({ title: 'a'.repeat(200) });

    expect(result.success).toBe(true);
  });

  it('rejects a title exceeding 200 characters', () => {
    const result = UpdateTaskSchema.safeParse({ title: 'a'.repeat(201) });

    expect(result.success).toBe(false);
  });

  it('accepts a description exactly at the 2000 character limit', () => {
    const result = UpdateTaskSchema.safeParse({
      description: 'a'.repeat(2000),
    });

    expect(result.success).toBe(true);
  });

  it('rejects a description exceeding 2000 characters', () => {
    const result = UpdateTaskSchema.safeParse({
      description: 'a'.repeat(2001),
    });

    expect(result.success).toBe(false);
  });

  it('rejects a status value outside OPEN, IN_PROGRESS, DONE', () => {
    const result = UpdateTaskSchema.safeParse({ status: 'CANCELLED' });

    expect(result.success).toBe(false);
  });

  it('rejects a payload that includes an id field', () => {
    const result = UpdateTaskSchema.safeParse({
      title: 'Updated title',
      id: '123e4567-e89b-12d3-a456-426614174000',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a payload that includes a createdAt field', () => {
    const result = UpdateTaskSchema.safeParse({
      title: 'Updated title',
      createdAt: new Date().toISOString(),
    });

    expect(result.success).toBe(false);
  });
});
