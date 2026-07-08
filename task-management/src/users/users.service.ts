import { ConflictException, Injectable } from '@nestjs/common';
import { CreateUserDto, PublicUser } from './user.schema';
import { UsersRepository } from './users.repository';

const UNIQUE_VIOLATION_CODE = '23505';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(createUserDto: CreateUserDto): Promise<PublicUser> {
    try {
      return await this.usersRepository.create(createUserDto);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          `A user with email ${createUserDto.email} is already registered`,
        );
      }
      throw error;
    }
  }

  async findAll(): Promise<PublicUser[]> {
    return this.usersRepository.findAll();
  }

  async findById(id: string): Promise<PublicUser | null> {
    return this.usersRepository.findById(id);
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === UNIQUE_VIOLATION_CODE
    );
  }
}
