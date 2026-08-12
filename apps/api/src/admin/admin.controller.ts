import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

class ActionContentDto {
  type!: 'POST' | 'COMMENT';
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('metrics')
  async getMetrics() {
    return this.adminService.getMetrics();
  }

  @Get('users')
  async listUsers(@Query('search') search?: string) {
    return this.adminService.listUsers(search);
  }

  @Patch('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspendUser(@Param('id') id: string) {
    return this.adminService.suspendUser(id);
  }

  @Patch('users/:id/unsuspend')
  @HttpCode(HttpStatus.OK)
  async unsuspendUser(@Param('id') id: string) {
    return this.adminService.unsuspendUser(id);
  }

  @Get('moderation')
  async listFlaggedContent() {
    return this.adminService.listFlaggedContent();
  }

  @Patch('moderation/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveContent(@Param('id') id: string, @Body() dto: ActionContentDto) {
    const { type } = dto;
    if (!type || !['POST', 'COMMENT'].includes(type)) {
      throw new BadRequestException('type must be POST or COMMENT');
    }
    return this.adminService.approveContent(id, type);
  }

  @Patch('moderation/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectContent(@Param('id') id: string, @Body() dto: ActionContentDto) {
    const { type } = dto;
    if (!type || !['POST', 'COMMENT'].includes(type)) {
      throw new BadRequestException('type must be POST or COMMENT');
    }
    return this.adminService.rejectContent(id, type);
  }

  @Get('analytics')
  async getAnalytics() {
    return this.adminService.getAnalytics();
  }
}
export type { ActionContentDto };
