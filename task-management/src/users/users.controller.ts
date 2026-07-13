import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { PublicUser } from './user.schema';
import { UserResponseDto } from './user.schema';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOkResponse({ type: UserResponseDto, isArray: true })
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
