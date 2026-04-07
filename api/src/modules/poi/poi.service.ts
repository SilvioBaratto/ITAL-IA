import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PoiCategory } from '../../../generated/prisma/client';
import { PoiQueryDto } from './dto/poi-query.dto';

@Injectable()
export class PoiService {
  private readonly logger = new Logger(PoiService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PoiQueryDto) {
    const where = {
      ...(query.regionId ? { regionId: query.regionId } : {}),
      ...(query.category ? { category: query.category as PoiCategory } : {}),
    };
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.pointOfInterest.findMany({
        where,
        include: { region: { select: { id: true, name: true, group: true } } },
        orderBy: [{ regionId: 'asc' }, { category: 'asc' }, { name: 'asc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.pointOfInterest.count({ where }),
    ]);

    return { data, total, limit, offset };
  }

  async findOne(id: string) {
    const poi = await this.prisma.pointOfInterest.findUnique({
      where: { id },
      include: {
        region: { select: { id: true, name: true, group: true } },
      },
    });

    if (!poi) {
      throw new NotFoundException(`Point of interest ${id} not found`);
    }

    return poi;
  }

  async getStats(regionId?: string) {
    const where = regionId ? { regionId } : {};

    const rows = await this.prisma.pointOfInterest.groupBy({
      by: ['category'],
      where,
      _count: { _all: true },
      orderBy: { _count: { category: 'desc' } },
    });

    return rows.map((r) => ({ category: r.category, count: r._count._all }));
  }

  async findRelated(id: string) {
    const poi = await this.prisma.pointOfInterest.findUnique({
      where: { id },
      select: { category: true, regionId: true },
    });

    if (!poi) {
      throw new NotFoundException(`Point of interest ${id} not found`);
    }

    return this.prisma.pointOfInterest.findMany({
      where: {
        regionId: poi.regionId,
        category: poi.category,
        id: { not: id },
      },
      select: {
        id: true,
        name: true,
        category: true,
        imageUrl: true,
        address: true,
      },
      take: 4,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Best-effort lookup: find a PointOfInterest by name (case-insensitive) and
   * regionId. Returns null when no match is found.
   * Used by SavedItemsService to link a SavedItem to its canonical POI.
   */
  async findByNameAndRegion(
    name: string,
    regionId: string,
  ): Promise<{ id: string } | null> {
    return this.prisma.pointOfInterest.findFirst({
      where: {
        regionId,
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
  }
}
