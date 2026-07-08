import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  DATABASE_CONNECTION,
  type Database,
} from '../infra/database/database.module';
import { TABLE_USERS } from '../infra/database/schema';
import type { PublicUser } from './user.schema';

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
};

@Injectable()
export class UsersRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async create(input: CreateUserInput): Promise<PublicUser> {
    const [row] = await this.db
      .insert(TABLE_USERS)
      .values({
        name: input.name,
        email: input.email,
        password: input.password,
      })
      .returning();
    return this.toUser(row)!;
  }

  async findAll(): Promise<PublicUser[]> {
    const users = await this.db.select().from(TABLE_USERS);
    return users.map((row) => this.toUser(row)!);
  }

  async findById(id: string): Promise<PublicUser | null> {
    const [user] = await this.db
      .select()
      .from(TABLE_USERS)
      .where(eq(TABLE_USERS.id, id));
    return this.toUser(user);
  }

  private toUser(
    user: typeof TABLE_USERS.$inferSelect | null,
  ): PublicUser | null {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };
  }
}
