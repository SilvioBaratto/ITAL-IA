import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { ComuneQueryDto } from './dto/comune-query.dto';

@Injectable()
export class ComuneService {
  private readonly logger = new Logger(ComuneService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findNearest(
    latitude: number,
    longitude: number,
  ): Promise<{ name: string; province: string; regionId: string; distance_km: number } | null> {
    const results = await this.prisma.$queryRaw<
      Array<{ name: string; province: string; regionId: string; distance_km: number }>
    >(Prisma.sql`
      SELECT name, province, region_id AS "regionId",
             (6371 * acos(
               LEAST(1.0, cos(radians(${latitude})) * cos(radians(latitude)) *
               cos(radians(longitude) - radians(${longitude})) +
               sin(radians(${latitude})) * sin(radians(latitude)))
             )) AS distance_km
      FROM comuni
      ORDER BY distance_km ASC
      LIMIT 1
    `);

    return results[0] ?? null;
  }

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
