import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ForbiddenToUnauthorizedFilter } from '../common/filters/forbidden-to-unauthorized.filter';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { TasksService } from './tasks.service';
import {
  CreateTaskSchema,
  GetAllTasksReq,
  TaskIdParamSchema,
  UpdateTaskSchema,
} from './task.schema';
import type {
  CreateTaskDto,
  GetAllTasksReq,
  Task,
  TaskResponseDto,
  UpdateTaskDto,
} from './task.schema';

@Controller('tasks')
@UseGuards(AuthGuard)
@UseFilters(ForbiddenToUnauthorizedFilter)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  async findAll(
    @Query(new ZodValidationPipe(GetAllTasksReq))
    pagination: GetAllTasksReq,
  ): Promise<TaskResponseDto[]> {
    const tasks = await this.tasksService.findAll(pagination);
    return tasks.map((task) => this.toResponseDto(task));
  }

  @Get(':id')
  async findOne(
    @Param('id', new ZodValidationPipe(TaskIdParamSchema)) id: string,
  ): Promise<TaskResponseDto> {
    const task = await this.tasksService.findOne(id);
    return this.toResponseDto(task);
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(CreateTaskSchema)) createTaskDto: CreateTaskDto,
  ): Promise<TaskResponseDto> {
    const task = await this.tasksService.create(createTaskDto);
    return this.toResponseDto(task);
  }

  @Patch(':id')
  async update(
    @Param('id', new ZodValidationPipe(TaskIdParamSchema)) id: string,
    @Body(new ZodValidationPipe(UpdateTaskSchema)) updateTaskDto: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    const task = await this.tasksService.update(id, updateTaskDto);
    return this.toResponseDto(task);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id', new ZodValidationPipe(TaskIdParamSchema)) id: string,
  ): Promise<void> {
    await this.tasksService.remove(id);
  }

  private toResponseDto(task: Task): TaskResponseDto {
    return {
      ...task,
      createdAt: task.createdAt.toISOString(),
    };
  }
}
