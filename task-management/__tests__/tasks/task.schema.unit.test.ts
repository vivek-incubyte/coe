import { describe, expect, it } from 'vitest';
import {
  CreateTaskSchema,
  GetAllTasksReq,
  TaskIdParamSchema,
  TaskSchema,
  TaskStatus,
  UpdateTaskSchema,
} from '@src/tasks/task.schema';
import {
  MAX_SEARCH_LENGTH,
  PAGINATION_DEFAULT,
  PAGINATION_MAX as PAGINATION_MAX_LIMIT,
} from '@src/config/constants';
import { taskStatusEnum } from '@src/infra/database/schema';

describe('GetAllTasksRequest', () => {
  it('allows empty params', () => {
    const result = GetAllTasksReq.parse({});
    expect(result).toEqual({
      limit: PAGINATION_DEFAULT,
      offset: 0,
    });
  });

  it('rejects unknown params', () => {
    const result = GetAllTasksReq.safeParse({
      unknown: 'property',
    });

    expect(result.success).toBe(false);
  });

  it('accepts all params', () => {
    const result = GetAllTasksReq.parse({
      limit: '10',
      offset: '5',
      search: ' urgent ',
      status: 'DONE',
    });

    expect(result).toEqual({
      limit: 10,
      offset: 5,
      search: 'urgent',
      status: 'DONE',
    });
  });

  describe('Limit and Offset', () => {
    it('converts string limit to integer', () => {
      const value = '5';
      const result = GetAllTasksReq.parse({ limit: value });
      expect(result.limit).toBe(Number.parseInt(value));
    });

    it('rejects a negative limit', () => {
      const result = GetAllTasksReq.safeParse({ limit: '-1' });
      expect(result.success).toBe(false);
    });

    it('rejects a non-integer limit', () => {
      const result = GetAllTasksReq.safeParse({ limit: '1.5' });
      expect(result.success).toBe(false);
    });

    it('rejects a non-numeric limit', () => {
      const result = GetAllTasksReq.safeParse({ limit: 'abc' });
      expect(result.success).toBe(false);
    });

    it(`rejects limit > ${PAGINATION_MAX_LIMIT}`, () => {
      const result = GetAllTasksReq.safeParse({
        limit: PAGINATION_MAX_LIMIT + 1,
      });
      expect(result.success).toBe(false);
    });

    it(`accepts limit = ${PAGINATION_MAX_LIMIT}`, () => {
      const result = GetAllTasksReq.parse({
        limit: PAGINATION_MAX_LIMIT,
      });
      expect(result.limit).toBe(PAGINATION_MAX_LIMIT);
    });

    it('converts string offset to integer', () => {
      const value = '5';
      const result = GetAllTasksReq.parse({ offset: value });
      expect(result.offset).toBe(Number.parseInt(value));
    });

    it('rejects a non-integer offset', () => {
      const result = GetAllTasksReq.safeParse({ offset: '1.5' });
      expect(result.success).toBe(false);
    });

    it('rejects a non-numeric offset', () => {
      const result = GetAllTasksReq.safeParse({ offset: 'abc' });
      expect(result.success).toBe(false);
    });

    it('rejects a negative offset', () => {
      const result = GetAllTasksReq.safeParse({ offset: '-1' });
      expect(result.success).toBe(false);
    });

    it('accepts zero as a valid limit and offset', () => {
      const result = GetAllTasksReq.parse({ limit: '0', offset: '0' });
      expect(result).toEqual({ limit: 0, offset: 0 });
    });
  });

  describe('search', () => {
    it('does not include search by default', () => {
      const result = GetAllTasksReq.parse({});
      expect(result.search).toEqual(undefined);
    });

    it('accepts a search string and includes it', () => {
      const searchText = 'urgent';
      const result = GetAllTasksReq.parse({ search: searchText });
      expect(result.search).toEqual(searchText);
    });

    it('rejects an empty search string', () => {
      const result = GetAllTasksReq.safeParse({ search: '' });
      expect(result.success).toBe(false);
    });

    it('rejects white-space only search string', () => {
      const result = GetAllTasksReq.safeParse({ search: '  ' });
      expect(result.success).toBe(false);
    });

    it('trims space from both ends for search string', () => {
      const searchText = 'urgent';
      const result = GetAllTasksReq.parse({ search: `   ${searchText}    ` });
      expect(result.search).toBe(searchText);
    });

    it(`rejects search string with length > ${MAX_SEARCH_LENGTH}`, () => {
      const result = GetAllTasksReq.safeParse({
        search: 's'.repeat(MAX_SEARCH_LENGTH + 1),
      });
      expect(result.success).toBe(false);
    });

    it(`accepts search string with length = ${MAX_SEARCH_LENGTH}`, () => {
      const result = GetAllTasksReq.parse({
        search: 's'.repeat(MAX_SEARCH_LENGTH),
      });
      expect(result.search).toHaveLength(MAX_SEARCH_LENGTH);
    });
  });

  describe('status', () => {
    it('does not include status by default', () => {
      const result = GetAllTasksReq.parse({});
      expect(result.status).toEqual(undefined);
    });

    it(`rejects a status value outside ${taskStatusEnum.enumValues.join(',')}`, () => {
      const result = GetAllTasksReq.safeParse({ status: 'RANDOMVALUE' });
      expect(result.success).toBe(false);
    });

    it(`accepts a status in ${taskStatusEnum.enumValues.join(',')}`, () => {
      const taskStatuses = taskStatusEnum.enumValues;
      for (const status of taskStatuses) {
        const result = GetAllTasksReq.parse({ status });
        expect(result.status).toBe(status);
      }
    });
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

  it('accepts a request without userId, leaving it undefined', () => {
    const result = CreateTaskSchema.parse({ title: 'Write tests' });

    expect(result.userId).toBeUndefined();
  });

  it('accepts a request with a valid uuid userId', () => {
    const result = CreateTaskSchema.parse({
      title: 'Write tests',
      userId: '123e4567-e89b-12d3-a456-426614174000',
    });

    expect(result.userId).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('accepts a request with userId explicitly set to null', () => {
    const result = CreateTaskSchema.parse({
      title: 'Write tests',
      userId: null,
    });

    expect(result.userId).toBeNull();
  });

  it('rejects a request where userId is not a valid uuid', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'Write tests',
      userId: 'not-a-uuid',
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

  it('accepts an update payload with only userId set to a valid uuid', () => {
    const result = UpdateTaskSchema.parse({
      userId: '123e4567-e89b-12d3-a456-426614174000',
    });

    expect(result).toEqual({
      userId: '123e4567-e89b-12d3-a456-426614174000',
    });
  });

  it('accepts an update payload with userId set to null, unassigning it', () => {
    const result = UpdateTaskSchema.parse({ userId: null });

    expect(result).toEqual({ userId: null });
  });

  it('rejects an update payload where userId is not a valid uuid', () => {
    const result = UpdateTaskSchema.safeParse({ userId: 'not-a-uuid' });

    expect(result.success).toBe(false);
  });
});

describe('TaskSchema', () => {
  it('rejects a task with userId omitted entirely', () => {
    const result = TaskSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Write tests',
      status: TaskStatus.enum.OPEN,
      createdAt: new Date(),
    });

    expect(result.success).toBe(false);
  });

  it('accepts a task with userId set to null', () => {
    const result = TaskSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Write tests',
      status: TaskStatus.enum.OPEN,
      createdAt: new Date(),
      userId: null,
    });

    expect(result.success).toBe(true);
  });

  it('accepts a task with userId set to a valid uuid', () => {
    const result = TaskSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Write tests',
      status: TaskStatus.enum.OPEN,
      createdAt: new Date(),
      userId: '123e4567-e89b-12d3-a456-426614174000',
    });

    expect(result.success).toBe(true);
  });
});
