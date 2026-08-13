import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters';
import { TransformInterceptor } from './common/interceptors';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // ── Global prefix ──────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Security ───────────────────────────────────────────
  app.use(helmet());
  const allowedOrigins = [
    configService.get<string>('FRONTEND_URL'),
    configService.get<string>('CORS_ORIGIN'),
    'http://localhost:3000',
  ].filter((o): o is string => !!o);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
      } else if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  // ── Global pipes ───────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ── Global filters & interceptors ──────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // ── Start ──────────────────────────────────────────────
  const port = configService.get<number>('app.port', 4000);
  await app.listen(port);
  logger.log(`🚀 Pulse API running on http://localhost:${port}/api/v1`);
  logger.log(`📋 Health check at http://localhost:${port}/api/v1/health`);
}

void bootstrap();
