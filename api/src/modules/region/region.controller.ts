import { Controller, Get, Header, Logger } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { RegionService } from './region.service';

@ApiTags('Regions')
@Controller('regions')
export class RegionController {
  private readonly logger = new Logger(RegionController.name);

  constructor(private readonly regionService: RegionService) {}

  @Get()
  @Public()
  @Header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  @ApiOperation({ summary: 'List all Italian regions with KB availability' })
  async findAll() {
    return this.regionService.findAll();
  }
}
