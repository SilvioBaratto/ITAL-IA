import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ComuneQueryDto } from './dto/comune-query.dto';

@Injectable()
export class ComuneService {
  private readonly logger = new Logger(ComuneService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByRegion(query: ComuneQueryDto) {
    const where = {
      regionId: query.regionId,
      ...(query.province ? { province: query.province } : {}),
    };

    const limit = query.limit ?? 500;
    const offset = query.offset ?? 0;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.comune.findMany({
        where,
        orderBy: { name: 'asc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.comune.count({ where }),
    ]);

    return { data, total, limit, offset };
  }
}
