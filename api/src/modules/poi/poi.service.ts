import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PoiCategory, Prisma } from '../../../generated/prisma/client';
import { PoiQueryDto } from './dto/poi-query.dto';

/**
 * Shared `include` shape: pull the POI's comune with its region. Every
 * POI response needs this so the client can display "{venue} — {comune},
 * {province}" and link back up to the region page.
 */
const COMUNE_WITH_REGION_INCLUDE = {
  comune: {
    select: {
      id: true,
      name: true,
      province: true,
      regionId: true,
      region: { select: { id: true, name: true, group: true } },
    },
  },
} satisfies Prisma.PointOfInterestInclude;

@Injectable()
export class PoiService {
  private readonly logger = new Logger(PoiService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PoiQueryDto) {
    // POIs no longer carry region_id directly — region filtering goes
    // through the comune join. `comuneId` is the more specific filter; if
    // both `comuneId` and `regionId` are provided, we apply both and the
    // comuneId wins in practice because it's more restrictive.
    const where: Prisma.PointOfInterestWhereInput = {
      ...(query.comuneId ? { comuneId: query.comuneId } : {}),
      ...(query.regionId ? { comune: { regionId: query.regionId } } : {}),
      ...(query.category ? { category: query.category as PoiCategory } : {}),
    };
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    // Curated order prioritizes POIs with richer data: image first, then
    // description, then name. Default order groups by region → comune →
    // category → name, which is useful for global listings but terrible
    // for a per-category cherry-pick of 6.
    const orderBy: Prisma.PointOfInterestOrderByWithRelationInput[] =
      query.order === 'curated'
        ? [
            { imageUrl: { sort: 'desc', nulls: 'last' } },
            { description: { sort: 'desc', nulls: 'last' } },
            { name: 'asc' },
          ]
        : [
            { comune: { regionId: 'asc' } },
            { comune: { name: 'asc' } },
            { category: 'asc' },
            { name: 'asc' },
          ];

    const [data, total] = await this.prisma.$transaction([
      this.prisma.pointOfInterest.findMany({
        where,
        include: COMUNE_WITH_REGION_INCLUDE,
        orderBy,
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
      include: COMUNE_WITH_REGION_INCLUDE,
    });

    if (!poi) {
      throw new NotFoundException(`Point of interest ${id} not found`);
    }

    return poi;
  }

  async getStats(regionId?: string, comuneId?: string) {
    const where: Prisma.PointOfInterestWhereInput = {
      ...(comuneId ? { comuneId } : {}),
      ...(regionId ? { comune: { regionId } } : {}),
    };

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
      select: { category: true, comune: { select: { regionId: true } } },
    });

    if (!poi) {
      throw new NotFoundException(`Point of interest ${id} not found`);
    }

    // Related = same region + same category, excluding self. We go by
    // region rather than comune because small comuni have too few POIs
    // for a meaningful "related" list, and users typically care about
    // nearby venues of the same type, not literally same-comune ones.
    return this.prisma.pointOfInterest.findMany({
      where: {
        comune: { regionId: poi.comune.regionId },
        category: poi.category,
        id: { not: id },
      },
      select: {
        id: true,
        name: true,
        category: true,
        imageUrl: true,
        address: true,
        // Include comune so the related-POIs card can show "{venue} —
        // {comune}" and the user can tell neighbouring venues apart.
        comune: { select: { id: true, name: true, province: true, regionId: true } },
      },
      take: 4,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Best-effort lookup: find a PointOfInterest by name (case-insensitive)
   * somewhere in the given region. Returns null when no match is found.
   * Used by SavedItemsService to link a SavedItem to its canonical POI.
   *
   * Note: since POIs are now scoped by comune, a region-level name lookup
   * may match multiple rows in different comuni (e.g. two "Bar Sport").
   * We return the first one — saved items are a best-effort convenience,
   * not an authoritative link.
   */
  async findByNameAndRegion(
    name: string,
    regionId: string,
  ): Promise<{ id: string } | null> {
    return this.prisma.pointOfInterest.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        comune: { regionId },
      },
      select: { id: true },
    });
  }
}
