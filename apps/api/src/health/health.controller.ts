import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  async check() {
    let dbStatus = 'unhealthy';
    let redisStatus = 'unhealthy';
    let overallHealthy = true;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'healthy';
    } catch {
      overallHealthy = false;
    }

    try {
      const ping = await this.redisService.getClient().ping();
      if (ping === 'PONG') {
        redisStatus = 'healthy';
      } else {
        overallHealthy = false;
      }
    } catch {
      overallHealthy = false;
    }

    const response = {
      status: overallHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
    };

    if (!overallHealthy) {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }
}
