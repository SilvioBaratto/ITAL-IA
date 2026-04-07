import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { Public } from '@/common/decorators/public.decorator';
import { ComuneService } from './comune.service';
import { ComuneQueryDto } from './dto/comune-query.dto';
import { PaginatedComuneResponseDto } from './dto/comune-response.dto';

@ApiTags('Comuni')
@Controller('comuni')
export class ComuneController {
  constructor(private readonly comuneService: ComuneService) {}

  @Get()
  @Public()
  @Header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
  @ApiOperation({ summary: 'List comuni by region with coordinates' })
  @ZodSerializerDto(PaginatedComuneResponseDto)
  async findByRegion(@Query() query: ComuneQueryDto) {
    return this.comuneService.findByRegion(query);
  }
}
