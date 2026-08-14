import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommunitiesService } from './communities.service';
import { CreateCommunityDto } from './dto/communities.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';

@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

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
  @UseGuards(OptionalJwtAuthGuard)
  async getDetails(
    @Param('id') id: string,
    @CurrentUser('id') currentUserId?: string,
  ) {
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
  @UseGuards(OptionalJwtAuthGuard)
  async getPosts(
    @Param('id') id: string,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.communitiesService.getPosts(id, currentUserId);
  }
}
export type { CreateCommunityDto };
