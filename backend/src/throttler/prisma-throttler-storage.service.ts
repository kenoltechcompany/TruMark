import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Database-backed rate limiting storage using PostgreSQL via Prisma.
 * Persists rate limit counters across server restarts and horizontally
 * distributed backend instances.
 */
@Injectable()
export class PrismaThrottlerStorageService implements ThrottlerStorage {
  private readonly logger = new Logger(PrismaThrottlerStorageService.name);
  private cleanupCounter = 0;

  constructor(private readonly prisma: PrismaService) {}

  async increment(
    key: string,
    ttl: number, // in milliseconds
    limit: number,
    blockDuration: number, // in milliseconds
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const now = new Date();
    const expireAt = new Date(now.getTime() + ttl);

    // Opportunistic cleanup of expired keys every 50 requests
    this.cleanupCounter++;
    if (this.cleanupCounter >= 50) {
      this.cleanupCounter = 0;
      this.prisma.rateLimit
        .deleteMany({
          where: { expiresAt: { lt: now } },
        })
        .catch((err) => this.logger.warn(`RateLimit cleanup failed: ${err.message}`));
    }

    try {
      const existing = await this.prisma.rateLimit.findUnique({
        where: { key },
      });

      if (!existing || existing.expiresAt <= now) {
        // First hit or window expired: reset counter
        await this.prisma.rateLimit.upsert({
          where: { key },
          create: {
            key,
            totalHits: 1,
            expiresAt: expireAt,
          },
          update: {
            totalHits: 1,
            expiresAt: expireAt,
          },
        });

        return {
          totalHits: 1,
          timeToExpire: Math.ceil(ttl / 1000),
          isBlocked: false,
          timeToBlockExpire: 0,
        };
      }

      // Existing window still active: increment hits
      const updated = await this.prisma.rateLimit.update({
        where: { key },
        data: {
          totalHits: { increment: 1 },
        },
      });

      const timeToExpireMs = Math.max(0, updated.expiresAt.getTime() - now.getTime());
      const timeToExpire = Math.ceil(timeToExpireMs / 1000);
      const isBlocked = updated.totalHits > limit;
      const timeToBlockExpire = isBlocked
        ? blockDuration > 0
          ? Math.ceil(blockDuration / 1000)
          : timeToExpire
        : 0;

      return {
        totalHits: updated.totalHits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire,
      };
    } catch (err: any) {
      this.logger.error(`Database rate limit failed for key ${key}: ${err.message}`);
      // Fail-open fallback so a momentary DB issue does not block legitimate users
      return {
        totalHits: 1,
        timeToExpire: Math.ceil(ttl / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}
