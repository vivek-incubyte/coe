import * as bcrypt from 'bcrypt';
import { ConflictException, Injectable } from '@nestjs/common';
import { CreateUserDto, PublicUser, User } from './user.schema';
import { UsersRepository } from './users.repository';

const UNIQUE_VIOLATION_CODE = '23505';
const PASSWORD_SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(createUserDto: CreateUserDto): Promise<PublicUser> {
    try {
      const hashedPassword = await bcrypt.hash(
        createUserDto.password,
        PASSWORD_SALT_ROUNDS,
      );
      return await this.usersRepository.create({
        ...createUserDto,
        password: hashedPassword,
      });
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

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository.findByEmailWithPassword(email);
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
