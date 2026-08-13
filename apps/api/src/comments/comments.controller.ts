import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto, CommentQueryDto } from './dto/comments.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { JwtService } from '@nestjs/jwt';

@Controller()
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('posts/:id/comments')
  @UseGuards(JwtAuthGuard)
  @RateLimit(20, 60)
  @HttpCode(HttpStatus.CREATED)
  async createComment(
    @CurrentUser('id') userId: string,
    @Param('id') postId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.createComment(userId, postId, dto);
  }

  @Get('posts/:id/comments')
  async getComments(
    @Param('id') postId: string,
    @Query() query: CommentQueryDto,
    @Headers('authorization') authHeader?: string,
  ) {
    let currentUserId: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const payload: unknown = this.jwtService.decode(token);
        if (payload && typeof payload === 'object') {
          currentUserId = (payload as Record<string, any>).sub as
            string | undefined;
        }
      } catch {
        // Silently treat as anonymous
      }
    }

    return this.commentsService.getComments(postId, query, currentUserId);
  }

  @Post('comments/:id/replies')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createReply(
    @CurrentUser('id') userId: string,
    @Param('id') commentId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.createReply(userId, commentId, dto);
  }
}
export type { CreateCommentDto };
