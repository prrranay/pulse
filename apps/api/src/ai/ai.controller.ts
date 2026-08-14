import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';

import { IsString, IsNotEmpty, IsIn } from 'class-validator';

class RefineTextDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['improve', 'concise', 'professional', 'engaging'])
  tone!: 'improve' | 'concise' | 'professional' | 'engaging';
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('refine')
  @RateLimit(10, 60) // Throttled to 10 requests per minute
  @HttpCode(HttpStatus.OK)
  async refine(@Body() dto: RefineTextDto) {
    const { text, tone } = dto;
    if (!text || !tone) {
      throw new BadRequestException('text and tone parameters are required');
    }

    if (!['improve', 'concise', 'professional', 'engaging'].includes(tone)) {
      throw new BadRequestException('Invalid tone parameter');
    }

    const refined = await this.aiService.refineText(text, tone);
    return { refined };
  }
}
export type { RefineTextDto };
export type { AiService };
