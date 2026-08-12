import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailProcessor } from './processors/email.processor';
import { ModerationProcessor } from './processors/moderation.processor';
import { AiModule } from '../ai/ai.module';

@Global()
@Module({
  imports: [
    AiModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl =
          configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';

        // Parse host/port/password from redisUrl or let Bull parse it
        // ioredis / bull supports passing redis url string directly inside connection details
        return {
          url: redisUrl,
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      {
        name: 'email-queue',
      },
      {
        name: 'moderation-queue',
      },
    ),
  ],
  providers: [EmailProcessor, ModerationProcessor],
  exports: [BullModule],
})
export class JobsModule {}
