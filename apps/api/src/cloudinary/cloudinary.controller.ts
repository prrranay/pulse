import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';

@Controller('cloudinary')
@UseGuards(JwtAuthGuard)
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('signature')
  getUploadSignature(@CurrentUser('id') userId: string) {
    return this.cloudinaryService.generateSignature(userId);
  }

  @Post('delete')
  async deleteAsset(
    @CurrentUser('id') userId: string,
    @Body('publicId') publicId: string,
  ): Promise<unknown> {
    return this.cloudinaryService.deleteAsset(publicId, userId);
  }
}
