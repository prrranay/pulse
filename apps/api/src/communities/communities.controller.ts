import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommunitiesService } from './communities.service';
import { CreateCommunityDto } from './dto/communities.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { JwtService } from '@nestjs/jwt';

@Controller('communities')
export class CommunitiesController {
  constructor(
    private readonly communitiesService: CommunitiesService,
    private readonly jwtService: JwtService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCommunityDto,
  ) {
    return this.communitiesService.create(userId, dto);
  }

  @Get(':id')
  async getDetails(
    @Param('id') id: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const currentUserId = this.extractUserId(authHeader);
    return this.communitiesService.getDetails(id, currentUserId);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async join(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.communitiesService.join(userId, id);
  }

  @Delete(':id/leave')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async leave(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.communitiesService.leave(userId, id);
  }

  @Get(':id/posts')
  async getPosts(
    @Param('id') id: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const currentUserId = this.extractUserId(authHeader);
    return this.communitiesService.getPosts(id, currentUserId);
  }

  private extractUserId(authHeader?: string): string | undefined {
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const payload: unknown = this.jwtService.decode(token);
        if (payload && typeof payload === 'object') {
          return (payload as Record<string, any>).sub as string | undefined;
        }
      } catch {
        // Silently treat as anonymous
      }
    }
    return undefined;
  }
}
export type { CreateCommunityDto };
