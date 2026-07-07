import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateTaskDto,
  PaginationQuery,
  Task,
  UpdateTaskDto,
} from './task.schema';
import { TasksRepository } from './tasks.repository';

@Injectable()
export class TasksService {
  constructor(private readonly tasksRepository: TasksRepository) {}

  async findAll(pagination: PaginationQuery): Promise<Task[]> {
    return this.tasksRepository.findAll(pagination);
  }

  async findOne(id: string): Promise<Task> {
    const existingTask = await this.tasksRepository.findById(id);
    if (!existingTask) {
      throw new NotFoundException(`Task with id ${id} not found`);
    }
    return existingTask;
  }

  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    return this.tasksRepository.create(createTaskDto);
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    const existingTask = await this.tasksRepository.update(id, updateTaskDto);
    if (!existingTask) {
      throw new NotFoundException(`Task with id ${id} not found`);
    }
    return existingTask;
  }

  async remove(id: string): Promise<void> {
    const existingTask = await this.tasksRepository.delete(id);
    if (!existingTask) {
      throw new NotFoundException(`Task with id ${id} not found`);
    }
  }
}
