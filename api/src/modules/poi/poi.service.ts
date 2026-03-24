import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PoiCategory } from '@generated/prisma';
import { PoiQueryDto } from './dto/poi-query.dto';

@Injectable()
export class PoiService {
  private readonly logger = new Logger(PoiService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PoiQueryDto) {
    return this.prisma.pointOfInterest.findMany({
      where: {
        ...(query.regionId ? { regionId: query.regionId } : {}),
        ...(query.category ? { category: query.category as PoiCategory } : {}),
      },
      orderBy: [{ regionId: 'asc' }, { category: 'asc' }, { name: 'asc' }],
    });
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
