import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import {
  appConfig,
  databaseConfig,
  redisConfig,
  jwtConfig,
  googleConfig,
  cloudinaryConfig,
  envValidationSchema,
} from './config';
import { PrismaModule } from './prisma';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { CommentsModule } from './comments/comments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RedisModule } from './redis/redis.module';
import { JobsModule } from './jobs/jobs.module';
import { CommunitiesModule } from './communities/communities.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { AiModule } from './ai/ai.module';
import { AdminModule } from './admin/admin.module';
import { ChatModule } from './chat/chat.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { RateLimiterGuard } from './common/guards/rate-limiter.guard';

@Module({
  imports: [
    // ── Configuration ────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        jwtConfig,
        googleConfig,
        cloudinaryConfig,
      ],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),

    // ── Rate Limiting ────────────────────────────────────
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // ── Database ─────────────────────────────────────────
    PrismaModule,

    // ── Global Redis Module ──────────────────────────────
    RedisModule,
    JobsModule,

    // ── Feature Modules ──────────────────────────────────
    HealthModule,
    AuthModule,
    UsersModule,
    PostsModule,
    CommentsModule,
    NotificationsModule,
    CommunitiesModule,
    DiscoveryModule,
    AiModule,
    AdminModule,
    ChatModule,
    CloudinaryModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RateLimiterGuard,
    },
  ],
})
export class AppModule {}
