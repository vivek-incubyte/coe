import { Inject, Injectable } from '@nestjs/common';
import {
  type HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import {
  DATABASE_CONNECTION,
  type Database,
} from '../infra/database/database.module';

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      await this.db.execute(sql`SELECT 1`);
      return indicator.up();
    } catch {
      return indicator.down();
    }
  }
}
