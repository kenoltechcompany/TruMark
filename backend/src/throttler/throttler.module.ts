import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { PrismaThrottlerStorageService } from './prisma-throttler-storage.service';
import { RedisThrottlerStorageService } from './redis-throttler-storage.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { ThrottlerBehindProxyGuard } from './throttler-behind-proxy.guard';
import { APP_GUARD } from '@nestjs/core';

export const THROTTLER_STORAGE_TOKEN = 'THROTTLER_STORAGE_TOKEN';

@Module({
  imports: [PrismaModule],
  providers: [
    PrismaThrottlerStorageService,
    {
      provide: THROTTLER_STORAGE_TOKEN,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService): ThrottlerStorage => {
        const mode = (process.env.RATE_LIMIT_STORAGE || 'db').toLowerCase();
        if (mode === 'redis') {
          return new RedisThrottlerStorageService(prisma);
        }
        return new PrismaThrottlerStorageService(prisma);
      },
    },
  ],
  exports: [THROTTLER_STORAGE_TOKEN, PrismaThrottlerStorageService],
})
export class DynamicThrottlerStorageModule {}

@Module({
  imports: [
    PrismaModule,
    DynamicThrottlerStorageModule,
    ThrottlerModule.forRootAsync({
      imports: [DynamicThrottlerStorageModule],
      inject: [THROTTLER_STORAGE_TOKEN],
      useFactory: (storage: ThrottlerStorage) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60000, // 60 seconds
            limit: 120, // 120 requests per minute default
          },
        ],
        storage,
      }),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
  ],
  exports: [DynamicThrottlerStorageModule],
})
export class AppThrottlerModule {}
