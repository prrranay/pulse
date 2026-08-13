import { Controller, Get, Query, Headers } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { JwtService } from '@nestjs/jwt';

@Controller('discovery')
export class DiscoveryController {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly jwtService: JwtService,
  ) {}

  @Get('explore')
  async getExplore(@Headers('authorization') authHeader?: string) {
    const currentUserId = this.extractUserId(authHeader);
    return this.discoveryService.getExploreData(currentUserId);
  }

  @Get('trends')
  async getTrends() {
    return this.discoveryService.getTrendingHashtags();
  }

  @Get('search')
  async search(
    @Query('q') q: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const currentUserId = this.extractUserId(authHeader);
    return this.discoveryService.searchAll(q ?? '', currentUserId);
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
export type { DiscoveryService };
