import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateTaskDto,
  GetAllTasksReq,
  Task,
  UpdateTaskDto,
} from './task.schema';
import { TasksRepository } from './tasks.repository';
import { UsersService } from '../users/users.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly tasksRepository: TasksRepository,
    private readonly usersService: UsersService,
  ) {}

  async findAll(pagination: GetAllTasksReq): Promise<Task[]> {
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
    if (createTaskDto.userId != null) {
      await this.ensureUserExists(createTaskDto.userId);
    }
    return this.tasksRepository.create(createTaskDto);
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    if (updateTaskDto.userId != null) {
      await this.ensureUserExists(updateTaskDto.userId);
    }
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

  private async ensureUserExists(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException(`User with id ${userId} not found`);
    }
  }
}
