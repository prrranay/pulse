import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import {
  appConfig,
  databaseConfig,
  redisConfig,
  jwtConfig,
  envValidationSchema,
} from './config';
import { PrismaModule } from './prisma';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { CommentsModule } from './comments/comments.module';

@Module({
  imports: [
    // ── Configuration ────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, jwtConfig],
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

    // ── Feature Modules ──────────────────────────────────
    HealthModule,
    AuthModule,
    UsersModule,
    PostsModule,
    CommentsModule,
  ],
})
export class AppModule {}
