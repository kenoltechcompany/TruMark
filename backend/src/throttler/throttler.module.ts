import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaThrottlerStorageService } from './prisma-throttler-storage.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ThrottlerBehindProxyGuard } from './throttler-behind-proxy.guard';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [PrismaModule],
  providers: [PrismaThrottlerStorageService],
  exports: [PrismaThrottlerStorageService],
})
export class PrismaThrottlerStorageModule {}

@Module({
  imports: [
    PrismaModule,
    PrismaThrottlerStorageModule,
    ThrottlerModule.forRootAsync({
      imports: [PrismaThrottlerStorageModule],
      inject: [PrismaThrottlerStorageService],
      useFactory: (storage: PrismaThrottlerStorageService) => ({
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
  exports: [PrismaThrottlerStorageModule],
})
export class AppThrottlerModule {}
