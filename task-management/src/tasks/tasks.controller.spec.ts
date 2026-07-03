import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { Task, TaskResponseSchema, TaskStatus } from './task.schema';
import { randomUUID } from 'node:crypto';

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: randomUUID(),
  title: 'Test task',
  description: 'Sample Task',
  status: TaskStatus.enum.OPEN,
  createdAt: new Date(),
  ...overrides,
});

const mockTasksService = { findAll: vi.fn() };

describe('TasksController', () => {
  let controller: TasksController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: mockTasksService }],
    }).compile();

    controller = module.get<TasksController>(TasksController);
  });

  // Z — Zero: controller calls service exactly once and returns empty when service has no tasks
  it('delegates to the service and returns an empty array when there are no tasks', () => {
    mockTasksService.findAll.mockReturnValue([]);

    expect(controller.findAll()).toEqual([]);
    expect(mockTasksService.findAll).toHaveBeenCalledOnce();
  });

  // O — One: controller converts createdAt Date → ISO string and passes other fields through unchanged
  it('maps Task to TaskResponseDto: converts createdAt to ISO string, passes scalar fields through', () => {
    const dateString = '2024-06-15T12:00:00.000Z';
    const fixedDate = new Date(dateString);
    const task = makeTask({
      createdAt: fixedDate,
      description: 'some description',
    });
    mockTasksService.findAll.mockReturnValue([task]);

    const [dto] = controller.findAll();

    expect(dto.createdAt).toBe(dateString);
    expect(dto.id).toBe(task.id);
    expect(dto.title).toBe(task.title);
    expect(dto.status).toBe(task.status);
    expect(dto.description).toBe(task.description);
  });

  // M — Many: the Date → string conversion is applied to every task, not just the first
  it('applies the createdAt conversion to every task the service returns', () => {
    const dateString1 = '2024-01-01T00:00:00.000Z';
    const dateString2 = '2024-06-15T12:30:00.000Z';
    const dateString3 = '2024-12-31T23:59:59.999Z';

    const tasks = [
      makeTask({ createdAt: new Date(dateString1) }),
      makeTask({ createdAt: new Date(dateString2) }),
      makeTask({ createdAt: new Date(dateString3) }),
    ];
    mockTasksService.findAll.mockReturnValue(tasks);

    const result = controller.findAll();

    expect(result[0].createdAt).toBe(dateString1);
    expect(result[1].createdAt).toBe(dateString2);
    expect(result[2].createdAt).toBe(dateString3);
  });

  // B — Boundary: undefined description is preserved as-is, not coerced to null or empty string
  it('preserves undefined description in the DTO without coercion', () => {
    const task = makeTask({ description: undefined });
    mockTasksService.findAll.mockReturnValue([task]);

    const [dto] = controller.findAll();

    expect(dto.description).toBeUndefined();
  });

  // I — Interface: the full DTO output satisfies the TaskResponseSchema contract
  it('produces a DTO that is valid against the TaskResponseSchema', () => {
    const task = makeTask({ createdAt: new Date() });
    mockTasksService.findAll.mockReturnValue([task]);

    const [dto] = controller.findAll();
    const result = TaskResponseSchema.safeParse(dto);

    expect(result.success).toBe(true);
  });

  // E — Exception: service errors propagate; NestJS global filter maps them to 500
  it('propagates exceptions thrown by the service', () => {
    mockTasksService.findAll.mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(() => controller.findAll()).toThrow('storage unavailable');
  });
});
