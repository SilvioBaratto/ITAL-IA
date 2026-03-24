import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SavedItemCategory } from '@generated/prisma';
import { CreateSavedItemDto, ListSavedItemsQueryDto, CheckSavedItemQueryDto } from './dto/saved-item.dto';
import { PoiService } from '../poi/poi.service';

@Injectable()
export class SavedItemsService {
  private readonly logger = new Logger(SavedItemsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly poiService: PoiService,
  ) {}

  async upsert(userId: string, dto: CreateSavedItemDto) {
    this.logger.log(`Upserting saved item "${dto.name}" for user ${userId}`);

    const item = await this.prisma.savedItem.upsert({
      where: {
        userId_name_regionId_category: {
          userId,
          name: dto.name,
          regionId: dto.region,
          category: dto.category as SavedItemCategory,
        },
      },
      create: {
        userId,
        name: dto.name,
        category: dto.category as SavedItemCategory,
        regionId: dto.region,
        description: dto.description,
        address: dto.address ?? null,
        mapsUrl: dto.mapsUrl ?? null,
        website: dto.website ?? null,
        imageUrl: dto.imageUrl ?? null,
      },
      update: {
        description: dto.description,
        address: dto.address ?? null,
        mapsUrl: dto.mapsUrl ?? null,
        website: dto.website ?? null,
        imageUrl: dto.imageUrl ?? null,
      },
    });

    // Best-effort: link to canonical POI without blocking the response
    this.linkPoiAsync(item.id, dto.name, dto.region);

    return item;
  }

  private linkPoiAsync(savedItemId: string, name: string, regionId: string): void {
    this.poiService
      .findByNameAndRegion(name, regionId)
      .then((poi) => {
        if (!poi) return;
        return this.prisma.savedItem.update({
          where: { id: savedItemId },
          data: { poiId: poi.id },
        });
      })
      .then((linked) => {
        if (linked) {
          this.logger.log(`Linked saved item ${savedItemId} to POI ${linked.poiId}`);
        }
      })
      .catch((err: unknown) => {
        this.logger.warn(
          `POI link failed for saved item ${savedItemId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  }

  async listForUser(userId: string, query: ListSavedItemsQueryDto) {
    const where = {
      userId,
      ...(query.region ? { regionId: query.region } : {}),
      ...(query.category ? { category: query.category as SavedItemCategory } : {}),
    };
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.savedItem.findMany({
        where,
        orderBy: { savedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.savedItem.count({ where }),
    ]);

    return { data, total, limit, offset };
  }

  async delete(id: string, userId: string): Promise<void> {
    const item = await this.prisma.savedItem.findFirst({
      where: { id, userId },
    });

    if (!item) {
      throw new NotFoundException(`Saved item ${id} not found`);
    }

    await this.prisma.savedItem.delete({ where: { id } });
    this.logger.log(`Deleted saved item ${id} for user ${userId}`);
  }

  async check(userId: string, query: CheckSavedItemQueryDto) {
    const item = await this.prisma.savedItem.findFirst({
      where: {
        userId,
        name: query.name,
        regionId: query.region,
        category: query.category as SavedItemCategory,
      },
      select: { id: true },
    });

    return {
      isSaved: item !== null,
      ...(item ? { id: item.id } : {}),
    };
  }
}
