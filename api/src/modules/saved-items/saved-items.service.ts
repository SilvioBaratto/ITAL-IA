import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SavedItemCategory } from '@generated/prisma';
import { CreateSavedItemDto, ListSavedItemsQueryDto, CheckSavedItemQueryDto } from './dto/saved-item.dto';

@Injectable()
export class SavedItemsService {
  private readonly logger = new Logger(SavedItemsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async upsert(userId: string, dto: CreateSavedItemDto) {
    this.logger.log(`Upserting saved item "${dto.name}" for user ${userId}`);

    return this.prisma.savedItem.upsert({
      where: {
        userId_name_region_category: {
          userId,
          name: dto.name,
          region: dto.region,
          category: dto.category as SavedItemCategory,
        },
      },
      create: {
        userId,
        name: dto.name,
        category: dto.category as SavedItemCategory,
        region: dto.region,
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
  }

  async listForUser(userId: string, query: ListSavedItemsQueryDto) {
    return this.prisma.savedItem.findMany({
      where: {
        userId,
        ...(query.region ? { region: query.region } : {}),
        ...(query.category ? { category: query.category as SavedItemCategory } : {}),
      },
      orderBy: { savedAt: 'desc' },
    });
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
        region: query.region,
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
