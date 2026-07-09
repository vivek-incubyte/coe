import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '@src/auth/auth.guard';
import {
  GetAllTasksReq,
  Task,
  TaskResponseDto,
  TaskStatus,
} from '@src/tasks/task.schema';
import { TasksController } from '@src/tasks/tasks.controller';
import { TasksService } from '@src/tasks/tasks.service';

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: randomUUID(),
  title: 'Test task',
  description: 'Sample task',
  status: TaskStatus.enum.OPEN,
  createdAt: new Date(),
  userId: null,
  ...overrides,
});

const defaultPagination: GetAllTasksReq = { limit: 20, offset: 0 };

const mockTasksService = {
  findAll: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
};

describe('TasksController', () => {
  let controller: TasksController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: mockTasksService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TasksController>(TasksController);
  });

  describe('findAll', () => {
    it('returns empty object when no tasks available', async () => {
      mockTasksService.findAll.mockResolvedValue([]);
      const result = await controller.findAll(defaultPagination);
      expect(result).toEqual([]);
    });

    it('maps a task to a response dto, converting createdAt to an ISO string', async () => {
      const fixedDate = '2024-06-15T12:00:00.000Z';
      const newTask = makeTask({ createdAt: new Date(fixedDate) });
      mockTasksService.findAll.mockResolvedValue([newTask]);

      const [task] = await controller.findAll(defaultPagination);

      expect(task).toEqual({
        id: newTask.id,
        title: newTask.title,
        description: newTask.description,
        status: newTask.status,
        createdAt: fixedDate,
        userId: null,
      });
    });

    it('applies the createdAt conversion to every task returned', async () => {
      const fixedDate = '2026-06-15T12:00:00.000Z';
      const tasks = [
        makeTask({ createdAt: new Date(fixedDate) }),
        makeTask({ createdAt: new Date(fixedDate) }),
      ];
      mockTasksService.findAll.mockResolvedValue(tasks);

      const result: TaskResponseDto[] =
        await controller.findAll(defaultPagination);

      expect(result[0].createdAt).toBe(fixedDate);
      expect(result[1].createdAt).toBe(fixedDate);
    });

    it('passes the params to the service unchanged', async () => {
      mockTasksService.findAll.mockResolvedValue([]);
      const params: GetAllTasksReq = {
        limit: 5,
        offset: 10,
        search: 'asdf',
        status: TaskStatus.enum.OPEN,
      };

      await controller.findAll(params);
      expect(mockTasksService.findAll).toHaveBeenCalledWith(params);
    });
  });

  describe('findOne', () => {
    it('returns the mapped task when the service finds a match', async () => {
      const task = makeTask();
      mockTasksService.findOne.mockResolvedValue(task);

      const dto = await controller.findOne(task.id);

      expect(dto.id).toBe(task.id);
      expect(dto.title).toBe(task.title);
      expect(dto.createdAt).toBe(task.createdAt.toISOString());
    });

    it('passes the given id through to the service', async () => {
      const id = randomUUID();
      mockTasksService.findOne.mockResolvedValue(makeTask({ id }));

      await controller.findOne(id);

      expect(mockTasksService.findOne).toHaveBeenCalledWith(id);
    });

    it('propagates the NotFoundException the service throws', async () => {
      mockTasksService.findOne.mockRejectedValue(
        new NotFoundException('Task with id not found'),
      );

      await expect(controller.findOne(randomUUID())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns a response dto whose userId matches the task userId', async () => {
      const userId = randomUUID();
      const task = makeTask({ userId });
      mockTasksService.findOne.mockResolvedValue(task);

      const dto = await controller.findOne(task.id);

      expect(dto.userId).toBe(userId);
    });
  });

  describe('create', () => {
    it('passes the createTaskDto through to the service unchanged', async () => {
      mockTasksService.create.mockResolvedValue(makeTask());
      const createTaskDto = {
        title: 'Write tests',
        description: 'Cover the create endpoint',
        status: TaskStatus.enum.OPEN,
      };

      await controller.create(createTaskDto);

      expect(mockTasksService.create).toHaveBeenCalledWith(createTaskDto);
    });

    it('returns the mapped response dto with the id and status the service returns', async () => {
      const createdTask = makeTask({ status: TaskStatus.enum.OPEN });
      mockTasksService.create.mockResolvedValue(createdTask);

      const dto = await controller.create({
        title: createdTask.title,
        status: TaskStatus.enum.OPEN,
      });

      expect(dto.id).toBe(createdTask.id);
      expect(dto.title).toBe(createdTask.title);
      expect(dto.status).toBe(TaskStatus.enum.OPEN);
    });

    it('converts createdAt to an ISO string in the response', async () => {
      const fixedDate = new Date('2024-06-15T12:00:00.000Z');
      const createdTask = makeTask({ createdAt: fixedDate });
      mockTasksService.create.mockResolvedValue(createdTask);

      const dto = await controller.create({
        title: createdTask.title,
        status: TaskStatus.enum.OPEN,
      });

      expect(dto.createdAt).toBe('2024-06-15T12:00:00.000Z');
    });

    it('passes a createTaskDto containing userId through to the service unchanged', async () => {
      const userId = randomUUID();
      mockTasksService.create.mockResolvedValue(makeTask({ userId }));
      const createTaskDto = {
        title: 'Write tests',
        description: 'Cover the create endpoint',
        status: TaskStatus.enum.OPEN,
        userId,
      };

      await controller.create(createTaskDto);

      expect(mockTasksService.create).toHaveBeenCalledWith(createTaskDto);
    });

    it('returns the mapped response dto including the userId the service returns', async () => {
      const userId = randomUUID();
      const createdTask = makeTask({ userId });
      mockTasksService.create.mockResolvedValue(createdTask);

      const dto = await controller.create({
        title: createdTask.title,
        status: TaskStatus.enum.OPEN,
        userId,
      });

      expect(dto.userId).toBe(userId);
    });
  });

  describe('update', () => {
    it('passes the id and updateTaskDto through to the service unchanged', async () => {
      const task = makeTask();
      mockTasksService.update.mockResolvedValue(task);
      const updateTaskDto = { title: 'Updated title' };

      await controller.update(task.id, updateTaskDto);

      expect(mockTasksService.update).toHaveBeenCalledWith(
        task.id,
        updateTaskDto,
      );
    });

    it('returns the mapped response dto reflecting the service result', async () => {
      const updatedTask = makeTask({
        title: 'Updated title',
        status: TaskStatus.enum.DONE,
      });
      mockTasksService.update.mockResolvedValue(updatedTask);

      const dto = await controller.update(updatedTask.id, {
        title: 'Updated title',
        status: TaskStatus.enum.DONE,
      });

      expect(dto.id).toBe(updatedTask.id);
      expect(dto.title).toBe('Updated title');
      expect(dto.status).toBe(TaskStatus.enum.DONE);
    });

    it('returns the mapped response dto unchanged when the update body is empty', async () => {
      const task = makeTask();
      mockTasksService.update.mockResolvedValue(task);

      const dto = await controller.update(task.id, {});

      expect(dto.title).toBe(task.title);
      expect(dto.description).toBe(task.description);
      expect(dto.status).toBe(task.status);
    });

    it('converts createdAt to an ISO string in the response', async () => {
      const fixedDate = new Date('2024-06-15T12:00:00.000Z');
      const updatedTask = makeTask({ createdAt: fixedDate });
      mockTasksService.update.mockResolvedValue(updatedTask);

      const dto = await controller.update(updatedTask.id, {
        title: updatedTask.title,
      });

      expect(dto.createdAt).toBe('2024-06-15T12:00:00.000Z');
    });

    it('propagates the NotFoundException the service throws', async () => {
      mockTasksService.update.mockRejectedValue(
        new NotFoundException('Task with id not found'),
      );

      await expect(
        controller.update(randomUUID(), { title: 'Anything' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('passes an updateTaskDto containing userId: null through to the service unchanged', async () => {
      const task = makeTask();
      mockTasksService.update.mockResolvedValue(makeTask({ userId: null }));
      const updateTaskDto = { userId: null };

      await controller.update(task.id, updateTaskDto);

      expect(mockTasksService.update).toHaveBeenCalledWith(
        task.id,
        updateTaskDto,
      );
    });

    it('returns the mapped response dto reflecting the userId the service returns', async () => {
      const userId = randomUUID();
      const updatedTask = makeTask({ userId });
      mockTasksService.update.mockResolvedValue(updatedTask);

      const dto = await controller.update(updatedTask.id, { userId });

      expect(dto.userId).toBe(userId);
    });
  });

  describe('remove', () => {
    it('resolves without a value when the service deletes the task', async () => {
      mockTasksService.remove.mockResolvedValue(undefined);

      await expect(controller.remove(randomUUID())).resolves.toBeUndefined();
    });

    it('passes the given id through to the service', async () => {
      const id = randomUUID();
      mockTasksService.remove.mockResolvedValue(undefined);

      await controller.remove(id);

      expect(mockTasksService.remove).toHaveBeenCalledWith(id);
    });

    it('propagates the NotFoundException the service throws', async () => {
      mockTasksService.remove.mockRejectedValue(
        new NotFoundException('Task with id not found'),
      );

      await expect(controller.remove(randomUUID())).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
