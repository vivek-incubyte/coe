import { Controller, Get } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TaskResponseDto } from './task.schema';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll(): TaskResponseDto[] {
    return this.tasksService.findAll().map((task) => ({
      ...task,
      createdAt: task.createdAt.toISOString(),
    }));
  }
}
