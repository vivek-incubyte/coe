import { Injectable } from '@nestjs/common';
import { Task, TaskSchema } from './task.schema';

@Injectable()
export class TasksService {
  private tasks: Task[] = [];

  findAll(): Task[] {
    return this.tasks.map((task) => TaskSchema.parse(task));
  }

  addTask(task: Task): void {
    this.tasks.push(task);
  }
}
