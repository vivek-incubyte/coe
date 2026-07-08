import { Controller, Get } from '@nestjs/common';
import type { PublicUser, UserResponseDto } from './user.schema';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.usersService.findAll();
    return users.map((user) => this.toResponseDto(user));
  }

  private toResponseDto(user: PublicUser): UserResponseDto {
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
