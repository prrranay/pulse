import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  limit: number;
  ttl: number; // in seconds
}

export const RATE_LIMIT_KEY = 'rate_limit_options';

export const RateLimit = (limit: number, ttl: number = 60) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, ttl });
