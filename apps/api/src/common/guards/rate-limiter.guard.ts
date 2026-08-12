import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../redis/redis.service';
import {
  RATE_LIMIT_KEY,
  RateLimitOptions,
} from '../decorators/rate-limit.decorator';
import { Request } from 'express';

@Injectable()
export class RateLimiterGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return true; // No rate limit set on this route
    }

    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = request.ip ?? '127.0.0.1';

    // Attempt to extract userId if request is already authenticated
    const req = request as unknown as Record<string, unknown>;
    const userPayload = req.user as Record<string, unknown> | undefined;
    const identifier = (userPayload?.id as string | undefined) ?? clientIp;

    const routeName = `${context.getClass().name}:${context.getHandler().name}`;
    const redisKey = `rate_limit:${identifier}:${routeName}`;

    const client = this.redisService.getClient();

    // Increment request count
    const current = await client.incr(redisKey);

    if (current === 1) {
      // Set TTL for this rate limit window
      await client.expire(redisKey, options.ttl);
    }

    if (current > options.limit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests, please try again later.',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
