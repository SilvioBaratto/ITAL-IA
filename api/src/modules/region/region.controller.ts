import { Controller, Get, Logger, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { RegionService } from './region.service';
import type { Response } from 'express';

@ApiTags('Regions')
@Controller('regions')
export class RegionController {
  private readonly logger = new Logger(RegionController.name);

  constructor(private readonly regionService: RegionService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all Italian regions with KB availability' })
  async findAll(@Res({ passthrough: true }) res: Response) {
    const regions = await this.regionService.findAll();
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    return regions;
  }
}
