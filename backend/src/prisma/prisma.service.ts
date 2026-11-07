import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * PrismaService wraps the Prisma ORM client and manages its lifecycle.
 * Connects on module init and disconnects on module destroy.
 *
 * Configured with a bounded connection pool (max 10 connections by default)
 * to prevent database connection saturation when scaling horizontally.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor() {
    const connectionString =
      process.env.DATABASE_URL || 'postgresql://trumark@localhost:5432/trumark';

    const maxConnections = parseInt(process.env.DB_POOL_MAX || '10', 10);

    const pool = new Pool({
      connectionString,
      max: maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      // Idle client error logging
      new Logger('PgPool').error(`Unexpected error on idle database client: ${err.message}`);
    });

    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
    this.logger.log(`PrismaService initialized with PostgreSQL connection pool (max: ${maxConnections})`);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
