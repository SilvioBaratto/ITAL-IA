import { Controller, Get, Header, NotFoundException, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { Public } from '../../common/decorators/public.decorator';
import { ComuneService } from './comune.service';
import { ComuneQueryDto } from './dto/comune-query.dto';
import { PaginatedComuneResponseDto } from './dto/comune-response.dto';
import { NearestComuneQueryDto } from './dto/nearest-comune-query.dto';
import { NearestComuneResponseDto } from './dto/nearest-comune-response.dto';

@ApiTags('Comuni')
@Controller('comuni')
export class ComuneController {
  constructor(private readonly comuneService: ComuneService) {}

  @Get('nearest')
  @Public()
  @Header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  @ApiOperation({ summary: 'Find the nearest comune to given coordinates' })
  @ZodSerializerDto(NearestComuneResponseDto)
  async findNearest(@Query() query: NearestComuneQueryDto) {
    const result = await this.comuneService.findNearest(query.latitude, query.longitude);
    if (!result) {
      throw new NotFoundException('No comune found near the given coordinates');
    }
    return result;
  }

  @Get()
  @Public()
  @Header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
  @ApiOperation({ summary: 'List comuni by region with coordinates' })
  @ZodSerializerDto(PaginatedComuneResponseDto)
  async findByRegion(@Query() query: ComuneQueryDto) {
    return this.comuneService.findByRegion(query);
  }
}
