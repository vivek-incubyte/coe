import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Task, TaskStatus } from '../../src/tasks/task.schema';
import { TasksRepository } from '../../src/tasks/tasks.repository';
import { TasksService } from '../../src/tasks/tasks.service';
import { UsersService } from '../../src/users/users.service';

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: randomUUID(),
  title: 'Test task',
  description: 'A description',
  status: TaskStatus.enum.OPEN,
  createdAt: new Date(),
  userId: null,
  ...overrides,
});

type MockTasksRepository = {
  findAll: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const makeMockRepository = (): MockTasksRepository => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
});

type MockUsersService = {
  create: ReturnType<typeof vi.fn>;
  findAll: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
};

const makeMockUsersService = (): MockUsersService => ({
  create: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
});

describe('TasksService', () => {
  let repository: MockTasksRepository;
  let usersService: MockUsersService;
  let service: TasksService;

  beforeEach(() => {
    repository = makeMockRepository();
    usersService = makeMockUsersService();
    service = new TasksService(
      repository as unknown as TasksRepository,
      usersService as unknown as UsersService,
    );
  });

  describe('findAll', () => {
    it('returns an empty array when the repository has no tasks', async () => {
      repository.findAll.mockResolvedValue([]);

      const result = await service.findAll({ limit: 10, offset: 0 });

      expect(result).toEqual([]);
    });

    it('returns the single task the repository resolves', async () => {
      const task = makeTask();
      repository.findAll.mockResolvedValue([task]);

      const result = await service.findAll({ limit: 10, offset: 0 });

      expect(result).toEqual([task]);
    });

    it('returns every task the repository resolves, unchanged', async () => {
      const tasks = [makeTask(), makeTask(), makeTask()];
      repository.findAll.mockResolvedValue(tasks);

      const result = await service.findAll({ limit: 10, offset: 0 });

      expect(result).toEqual(tasks);
    });

    it('passes the pagination params through to the repository unchanged', async () => {
      repository.findAll.mockResolvedValue([]);
      const pagination = { limit: 5, offset: 10 };

      await service.findAll(pagination);

      expect(repository.findAll).toHaveBeenCalledWith(pagination);
    });

    //  TODO: Skip
    it('delegates limit/offset enforcement to the repository rather than slicing in-memory', async () => {
      const tasks = [makeTask(), makeTask(), makeTask()];
      repository.findAll.mockResolvedValue(tasks);

      const result = await service.findAll({ limit: 2, offset: 0 });

      expect(result).toBe(tasks);
    });
  });

  describe('findOne', () => {
    it('returns the task when the repository finds a match', async () => {
      const task = makeTask();
      repository.findById.mockResolvedValue(task);

      const result = await service.findOne(task.id);

      expect(result).toEqual(task);
    });

    it('passes the given id through to the repository', async () => {
      const id = randomUUID();
      repository.findById.mockResolvedValue(makeTask({ id }));

      await service.findOne(id);

      expect(repository.findById).toHaveBeenCalledWith(id);
    });

    it('throws NotFoundException when the repository finds no match', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne(randomUUID())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('resolves with the task the repository returns, including its generated id and createdAt', async () => {
      const createdTask = makeTask();
      repository.create.mockResolvedValue(createdTask);

      const result = await service.create({
        title: createdTask.title,
        status: TaskStatus.enum.OPEN,
      });

      expect(result).toEqual(createdTask);
      expect(result.id).toBe(createdTask.id);
      expect(result.createdAt).toBe(createdTask.createdAt);
    });

    it('passes the createTaskDto through to the repository unchanged', async () => {
      repository.create.mockResolvedValue(makeTask());
      const createTaskDto = {
        title: 'Ship the feature',
        description: 'Wire it end to end',
        status: TaskStatus.enum.IN_PROGRESS,
      };

      await service.create(createTaskDto);

      expect(repository.create).toHaveBeenCalledWith(createTaskDto);
    });

    it('makes a newly created task immediately retrievable via findOne against the same repository', async () => {
      const createdTask = makeTask();
      repository.create.mockResolvedValue(createdTask);
      repository.findById.mockResolvedValue(createdTask);

      const created = await service.create({
        title: createdTask.title,
        status: createdTask.status,
      });
      const fetched = await service.findOne(created.id);

      expect(fetched).toEqual(created);
      expect(repository.findById).toHaveBeenCalledWith(created.id);
    });

    it('does not call usersService.findById when userId is omitted', async () => {
      repository.create.mockResolvedValue(makeTask());

      await service.create({
        title: 'No user assigned',
        status: TaskStatus.enum.OPEN,
      });

      expect(usersService.findById).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalled();
    });

    it('does not call usersService.findById when userId is explicitly null', async () => {
      repository.create.mockResolvedValue(makeTask());

      await service.create({
        title: 'No user assigned',
        status: TaskStatus.enum.OPEN,
        userId: null,
      });

      expect(usersService.findById).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalled();
    });

    it('validates the userId exists before creating when userId is provided', async () => {
      const userId = randomUUID();
      usersService.findById.mockResolvedValue({
        id: userId,
        name: 'Assignee',
        email: 'assignee@example.com',
        createdAt: new Date(),
      });
      const createTaskDto = {
        title: 'Assigned task',
        status: TaskStatus.enum.OPEN,
        userId,
      };
      repository.create.mockResolvedValue(makeTask({ userId }));

      await service.create(createTaskDto);

      expect(usersService.findById).toHaveBeenCalledWith(userId);
      expect(repository.create).toHaveBeenCalledWith(createTaskDto);
    });

    it('throws BadRequestException when userId does not reference an existing user', async () => {
      const userId = randomUUID();
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.create({
          title: 'Assigned task',
          status: TaskStatus.enum.OPEN,
          userId,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('returns the updated task the repository resolves', async () => {
      const updatedTask = makeTask({ title: 'Updated title' });
      repository.update.mockResolvedValue(updatedTask);

      const result = await service.update(updatedTask.id, {
        title: 'Updated title',
      });

      expect(result).toEqual(updatedTask);
    });

    it('passes the id and updateTaskDto through to the repository unchanged', async () => {
      const task = makeTask();
      repository.update.mockResolvedValue(task);
      const updateTaskDto = {
        title: 'New title',
        status: TaskStatus.enum.DONE,
      };

      await service.update(task.id, updateTaskDto);

      expect(repository.update).toHaveBeenCalledWith(task.id, updateTaskDto);
    });

    it('resolves with the unchanged task when given an empty update body', async () => {
      const task = makeTask();
      repository.update.mockResolvedValue(task);

      const result = await service.update(task.id, {});

      expect(result).toEqual(task);
      expect(repository.update).toHaveBeenCalledWith(task.id, {});
    });

    it('throws NotFoundException when the repository finds no match to update', async () => {
      repository.update.mockResolvedValue(null);

      await expect(
        service.update(randomUUID(), { title: 'Anything' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('does not call usersService.findById when userId is omitted from the update', async () => {
      const task = makeTask();
      repository.update.mockResolvedValue(task);

      await service.update(task.id, { title: 'New title' });

      expect(usersService.findById).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalled();
    });

    it('does not call usersService.findById when userId is explicitly set to null (unassigning)', async () => {
      const task = makeTask();
      repository.update.mockResolvedValue(task);
      const updateTaskDto = { userId: null };

      await service.update(task.id, updateTaskDto);

      expect(usersService.findById).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith(task.id, updateTaskDto);
    });

    it('validates the userId exists before updating when userId is provided', async () => {
      const userId = randomUUID();
      const task = makeTask({ userId });
      usersService.findById.mockResolvedValue({
        id: userId,
        name: 'Assignee',
        email: 'assignee@example.com',
        createdAt: new Date(),
      });
      repository.update.mockResolvedValue(task);

      await service.update(task.id, { userId });

      expect(usersService.findById).toHaveBeenCalledWith(userId);
      expect(repository.update).toHaveBeenCalledWith(task.id, { userId });
    });

    it('throws BadRequestException when updating to a userId that does not reference an existing user', async () => {
      const userId = randomUUID();
      usersService.findById.mockResolvedValue(null);

      await expect(service.update(randomUUID(), { userId })).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('resolves without a value when the repository deletes the task', async () => {
      repository.delete.mockResolvedValue(true);

      await expect(service.remove(randomUUID())).resolves.toBeUndefined();
    });

    it('passes the given id through to the repository', async () => {
      const id = randomUUID();
      repository.delete.mockResolvedValue(true);

      await service.remove(id);

      expect(repository.delete).toHaveBeenCalledWith(id);
    });

    it('throws NotFoundException when the repository finds no match to delete', async () => {
      repository.delete.mockResolvedValue(false);

      await expect(service.remove(randomUUID())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('makes a deleted task unretrievable via findOne against the same repository', async () => {
      const task = makeTask();
      repository.delete.mockResolvedValue(true);
      repository.findById.mockResolvedValue(null);

      await service.remove(task.id);

      await expect(service.findOne(task.id)).rejects.toThrow(NotFoundException);
    });
  });
});
