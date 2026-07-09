import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Task, TaskStatus } from '@src/tasks/task.schema';
import { TasksRepository } from '@src/tasks/tasks.repository';
import { TasksService } from '@src/tasks/tasks.service';
import { UsersService } from '@src/users/users.service';

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
  let repositoryMock: MockTasksRepository;
  let usersService: MockUsersService;
  let service: TasksService;

  beforeEach(() => {
    repositoryMock = makeMockRepository();
    usersService = makeMockUsersService();
    service = new TasksService(
      repositoryMock as unknown as TasksRepository,
      usersService as unknown as UsersService,
    );
  });

  describe.only('findAll', () => {
    it('calls repository with correct params', async () => {
      repositoryMock.findAll.mockResolvedValue([]);
      await service.findAll({
        limit: 10,
        offset: 0,
        search: 'term',
        status: TaskStatus.enum.DONE,
      });
      expect(repositoryMock.findAll).toHaveBeenCalledWith({
        limit: 10,
        offset: 0,
        search: 'term',
        status: TaskStatus.enum.DONE,
      });
    });

    it('returns an empty array when the repository has no tasks', async () => {
      repositoryMock.findAll.mockResolvedValue([]);
      const result = await service.findAll({ limit: 10, offset: 0 });
      expect(result).toEqual([]);
    });

    it('returns every task from repository regardless of limit', async () => {
      const tasks = [makeTask(), makeTask(), makeTask()];
      repositoryMock.findAll.mockResolvedValue(tasks);

      const result = await service.findAll({ limit: 10, offset: 0 });

      expect(result).toEqual(tasks);
      expect(result).toHaveLength(tasks.length);
    });

    it('propagates repository errors', async () => {
      repositoryMock.findAll.mockRejectedValue(new Error('DB Unavailable'));

      await expect(service.findAll({ limit: 10, offset: 0 })).rejects.toThrow(
        'DB Unavailable',
      );
    });
  });

  describe('findOne', () => {
    it('returns the task when the repository finds a match', async () => {
      const task = makeTask();
      repositoryMock.findById.mockResolvedValue(task);

      const result = await service.findOne(task.id);

      expect(result).toEqual(task);
    });

    it('passes the given id through to the repository', async () => {
      const id = randomUUID();
      repositoryMock.findById.mockResolvedValue(makeTask({ id }));

      await service.findOne(id);

      expect(repositoryMock.findById).toHaveBeenCalledWith(id);
    });

    it('throws NotFoundException when the repository finds no match', async () => {
      repositoryMock.findById.mockResolvedValue(null);

      await expect(service.findOne(randomUUID())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('resolves with the task the repository returns, including its generated id and createdAt', async () => {
      const createdTask = makeTask();
      repositoryMock.create.mockResolvedValue(createdTask);

      const result = await service.create({
        title: createdTask.title,
        status: TaskStatus.enum.OPEN,
      });

      expect(result).toEqual(createdTask);
      expect(result.id).toBe(createdTask.id);
      expect(result.createdAt).toBe(createdTask.createdAt);
    });

    it('passes the createTaskDto through to the repository unchanged', async () => {
      repositoryMock.create.mockResolvedValue(makeTask());
      const createTaskDto = {
        title: 'Ship the feature',
        description: 'Wire it end to end',
        status: TaskStatus.enum.IN_PROGRESS,
      };

      await service.create(createTaskDto);

      expect(repositoryMock.create).toHaveBeenCalledWith(createTaskDto);
    });

    it('makes a newly created task immediately retrievable via findOne against the same repository', async () => {
      const createdTask = makeTask();
      repositoryMock.create.mockResolvedValue(createdTask);
      repositoryMock.findById.mockResolvedValue(createdTask);

      const created = await service.create({
        title: createdTask.title,
        status: createdTask.status,
      });
      const fetched = await service.findOne(created.id);

      expect(fetched).toEqual(created);
      expect(repositoryMock.findById).toHaveBeenCalledWith(created.id);
    });

    it('does not call usersService.findById when userId is omitted', async () => {
      repositoryMock.create.mockResolvedValue(makeTask());

      await service.create({
        title: 'No user assigned',
        status: TaskStatus.enum.OPEN,
      });

      expect(usersService.findById).not.toHaveBeenCalled();
      expect(repositoryMock.create).toHaveBeenCalled();
    });

    it('does not call usersService.findById when userId is explicitly null', async () => {
      repositoryMock.create.mockResolvedValue(makeTask());

      await service.create({
        title: 'No user assigned',
        status: TaskStatus.enum.OPEN,
        userId: null,
      });

      expect(usersService.findById).not.toHaveBeenCalled();
      expect(repositoryMock.create).toHaveBeenCalled();
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
      repositoryMock.create.mockResolvedValue(makeTask({ userId }));

      await service.create(createTaskDto);

      expect(usersService.findById).toHaveBeenCalledWith(userId);
      expect(repositoryMock.create).toHaveBeenCalledWith(createTaskDto);
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
      expect(repositoryMock.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('returns the updated task the repository resolves', async () => {
      const updatedTask = makeTask({ title: 'Updated title' });
      repositoryMock.update.mockResolvedValue(updatedTask);

      const result = await service.update(updatedTask.id, {
        title: 'Updated title',
      });

      expect(result).toEqual(updatedTask);
    });

    it('passes the id and updateTaskDto through to the repository unchanged', async () => {
      const task = makeTask();
      repositoryMock.update.mockResolvedValue(task);
      const updateTaskDto = {
        title: 'New title',
        status: TaskStatus.enum.DONE,
      };

      await service.update(task.id, updateTaskDto);

      expect(repositoryMock.update).toHaveBeenCalledWith(
        task.id,
        updateTaskDto,
      );
    });

    it('resolves with the unchanged task when given an empty update body', async () => {
      const task = makeTask();
      repositoryMock.update.mockResolvedValue(task);

      const result = await service.update(task.id, {});

      expect(result).toEqual(task);
      expect(repositoryMock.update).toHaveBeenCalledWith(task.id, {});
    });

    it('throws NotFoundException when the repository finds no match to update', async () => {
      repositoryMock.update.mockResolvedValue(null);

      await expect(
        service.update(randomUUID(), { title: 'Anything' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('does not call usersService.findById when userId is omitted from the update', async () => {
      const task = makeTask();
      repositoryMock.update.mockResolvedValue(task);

      await service.update(task.id, { title: 'New title' });

      expect(usersService.findById).not.toHaveBeenCalled();
      expect(repositoryMock.update).toHaveBeenCalled();
    });

    it('does not call usersService.findById when userId is explicitly set to null (unassigning)', async () => {
      const task = makeTask();
      repositoryMock.update.mockResolvedValue(task);
      const updateTaskDto = { userId: null };

      await service.update(task.id, updateTaskDto);

      expect(usersService.findById).not.toHaveBeenCalled();
      expect(repositoryMock.update).toHaveBeenCalledWith(
        task.id,
        updateTaskDto,
      );
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
      repositoryMock.update.mockResolvedValue(task);

      await service.update(task.id, { userId });

      expect(usersService.findById).toHaveBeenCalledWith(userId);
      expect(repositoryMock.update).toHaveBeenCalledWith(task.id, { userId });
    });

    it('throws BadRequestException when updating to a userId that does not reference an existing user', async () => {
      const userId = randomUUID();
      usersService.findById.mockResolvedValue(null);

      await expect(service.update(randomUUID(), { userId })).rejects.toThrow(
        BadRequestException,
      );
      expect(repositoryMock.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('resolves without a value when the repository deletes the task', async () => {
      repositoryMock.delete.mockResolvedValue(true);

      await expect(service.remove(randomUUID())).resolves.toBeUndefined();
    });

    it('passes the given id through to the repository', async () => {
      const id = randomUUID();
      repositoryMock.delete.mockResolvedValue(true);

      await service.remove(id);

      expect(repositoryMock.delete).toHaveBeenCalledWith(id);
    });

    it('throws NotFoundException when the repository finds no match to delete', async () => {
      repositoryMock.delete.mockResolvedValue(false);

      await expect(service.remove(randomUUID())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('makes a deleted task unretrievable via findOne against the same repository', async () => {
      const task = makeTask();
      repositoryMock.delete.mockResolvedValue(true);
      repositoryMock.findById.mockResolvedValue(null);

      await service.remove(task.id);

      await expect(service.findOne(task.id)).rejects.toThrow(NotFoundException);
    });
  });
});
