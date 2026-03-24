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
import { PoiQueryDto } from './dto/poi-query.dto';

@ApiTags('PointsOfInterest')
@Controller('poi')
export class PoiController {
  constructor(private readonly poiService: PoiService) {}

  @Get()
  @Public()
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
  @ApiOperation({ summary: 'List POIs, optionally filtered by regionId and/or category' })
  async findAll(@Query() query: PoiQueryDto) {
    return this.poiService.findAll(query);
  }

  @Get(':id')
  @Public()
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
  @ApiOperation({ summary: 'Get a single POI with full details including region' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.poiService.findOne(id);
  }
}
