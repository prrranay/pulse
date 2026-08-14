import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';

@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get('explore')
  @UseGuards(OptionalJwtAuthGuard)
  async getExplore(@CurrentUser('id') currentUserId?: string) {
    return this.discoveryService.getExploreData(currentUserId);
  }

  @Get('trends')
  async getTrends() {
    return this.discoveryService.getTrendingHashtags();
  }

  @Get('search')
  @UseGuards(OptionalJwtAuthGuard)
  async search(
    @Query('q') q: string,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.discoveryService.searchAll(q ?? '', currentUserId);
  }
}
export type { DiscoveryService };
