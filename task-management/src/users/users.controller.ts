import { Body, Controller, Get, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CreateUserSchema } from './user.schema';
import type { CreateUserDto, User, UserResponseDto } from './user.schema';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.usersService.findAll();
    return users.map((user) => this.toResponseDto(user));
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(CreateUserSchema)) createUserDto: CreateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.create(createUserDto);
    return this.toResponseDto(user);
  }

  private toResponseDto(user: User): UserResponseDto {
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
