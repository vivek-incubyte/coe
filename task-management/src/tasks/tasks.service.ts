import { Injectable } from '@nestjs/common';
import { Task } from './task.schema';

@Injectable()
export class TasksService {
  private tasks: Task[] = [];

  findAll(): Task[] {
    return this.tasks;
  }
}
