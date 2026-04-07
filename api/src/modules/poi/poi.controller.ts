import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PoiService } from './poi.service';
import { PoiQueryDto, PoiStatsQueryDto } from './dto/poi-query.dto';

@ApiTags('PointsOfInterest')
@Controller('poi')
export class PoiController {
  constructor(private readonly poiService: PoiService) {}

  @Get()
  @Public()
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
  @ApiOperation({ summary: 'List POIs with pagination, optionally filtered by regionId and/or category' })
  async findAll(@Query() query: PoiQueryDto) {
    return this.poiService.findAll(query);
  }

  @Get('stats')
  @Public()
  @Header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  @ApiOperation({ summary: 'POI counts grouped by category, optionally filtered by regionId' })
  async getStats(@Query() query: PoiStatsQueryDto) {
    return this.poiService.getStats(query.regionId);
  }

  @Get(':id')
  @Public()
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
  @ApiOperation({ summary: 'Get a single POI with full details including region' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.poiService.findOne(id);
  }

  @Get(':id/related')
  @Public()
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
  @ApiOperation({ summary: 'Get up to 4 related POIs (same category + region, excluding current)' })
  async findRelated(@Param('id', ParseUUIDPipe) id: string) {
    return this.poiService.findRelated(id);
  }
}
