import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('cloudinary.cloudName'),
      api_key: this.configService.get<string>('cloudinary.apiKey'),
      api_secret: this.configService.get<string>('cloudinary.apiSecret'),
    });
  }

  generateSignature(userId: string) {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = `pulse_posts/${userId}`;
    const params = {
      timestamp,
      folder,
    };

    const apiSecret = this.configService.get<string>('cloudinary.apiSecret');
    const signature = cloudinary.utils.api_sign_request(
      params,
      apiSecret || '',
    );

    return {
      signature,
      timestamp,
      folder,
      apiKey: this.configService.get<string>('cloudinary.apiKey'),
      cloudName: this.configService.get<string>('cloudinary.cloudName'),
    };
  }

  async deleteAsset(publicId: string, userId: string): Promise<unknown> {
    // Security check: ensure users can only delete their own assets
    const expectedPrefix = `pulse_posts/${userId}/`;
    if (!publicId.startsWith(expectedPrefix)) {
      throw new ForbiddenException('You do not own this asset');
    }

    try {
      const result = (await cloudinary.uploader.destroy(publicId)) as unknown;
      return result;
    } catch (error) {
      // Log error but avoid failing the entire sequence (e.g. database deletes) if Cloudinary is temporarily unreachable
      console.error(`Failed to delete Cloudinary asset ${publicId}:`, error);
      return { result: 'error', message: String(error) };
    }
  }
}
