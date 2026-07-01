import { describe, it, expect, beforeEach } from 'vitest';
import { ZodError } from 'zod';
import { TasksService } from './tasks.service';
import { Task, TaskSchema } from './task.schema';
import { randomUUID } from 'node:crypto';
import { TASK_STATUS } from './task.enum';

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: randomUUID(),
  title: 'Test task',
  description: 'A description',
  status: TASK_STATUS.OPEN,
  createdAt: new Date(),
  ...overrides,
});

describe('TasksService', () => {
  let service: TasksService;

  beforeEach(() => {
    service = new TasksService();
  });

  // Z — Zero: store is empty
  it('returns an empty array on a freshly created service', () => {
    expect(service.findAll()).toEqual([]);
  });

  it('returns an empty array on every call when no task has been added', () => {
    service.findAll();
    service.findAll();
    expect(service.findAll()).toEqual([]);
  });

  // O — One: exactly one task in the store
  it('returns a single-element array when one task has been added', () => {
    service.addTask(makeTask());

    expect(service.findAll()).toHaveLength(1);
  });

  it('returns the stored task with every field preserved exactly', () => {
    const task = makeTask({ description: 'detailed description' });
    service.addTask(task);

    const [result] = service.findAll();

    expect(result.id).toBe(task.id);
    expect(result.title).toBe(task.title);
    expect(result.description).toBe(task.description);
    expect(result.status).toBe(task.status);
    expect(result.createdAt).toEqual(task.createdAt);
  });

  // M — Many: multiple tasks in the store
  it('returns all tasks when multiple tasks have been added', () => {
    const tasks = [makeTask(), makeTask(), makeTask()];
    tasks.forEach((t) => service.addTask(t));

    expect(service.findAll()).toHaveLength(3);
  });

  it('returns tasks in the order they were inserted', () => {
    const tasks = [
      makeTask({ title: 'First' }),
      makeTask({ title: 'Second' }),
      makeTask({ title: 'Third' }),
    ];
    tasks.forEach((t) => service.addTask(t));

    const result = service.findAll();

    tasks.forEach((r, i) => expect(r.id).toBe(result[i].id));
  });

  // B — Boundary: edge values of individual fields
  it('preserves undefined description without coercing it to null or an empty string', () => {
    service.addTask(makeTask({ description: undefined }));

    expect(service.findAll()[0].description).toBeUndefined();
  });

  it('returns tasks with each valid status value unchanged', () => {
    const statuses = [
      TASK_STATUS.OPEN,
      TASK_STATUS.IN_PROGRESS,
      TASK_STATUS.DONE,
    ] as const;
    statuses.forEach((status) => service.addTask(makeTask({ status })));

    const result = service.findAll();

    statuses.forEach((status, i) => expect(result[i].status).toBe(status));
  });

  // I — Interface: shape of what findAll returns
  it('each returned task satisfies the TaskSchema contract', () => {
    service.addTask(makeTask());

    service.findAll().forEach((task) => {
      expect(TaskSchema.safeParse(task).success).toBe(true);
    });
  });

  it('returns a new array reference on every call', () => {
    service.addTask(makeTask());

    expect(service.findAll()).not.toBe(service.findAll());
  });

  // E — Exception: invalid data in the store surfaces at read time
  it('throws a ZodError when a stored task has a malformed id', () => {
    (service as any).tasks = [{ ...makeTask(), id: 'not-a-uuid' }];

    expect(() => service.findAll()).toThrow(ZodError);
  });

  it('throws a ZodError when a stored task has an invalid status', () => {
    (service as any).tasks = [{ ...makeTask(), status: 'INVALID_STATUS' }];

    expect(() => service.findAll()).toThrow(ZodError);
  });
});
