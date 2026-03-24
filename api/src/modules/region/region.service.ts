import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RegionService {
  private readonly logger = new Logger(RegionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    this.logger.log('Fetching all regions');
    const regions = await this.prisma.region.findMany({
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, group: true, hasKb: true },
    });

    return regions.map((r) => ({
      id: r.id,
      name: r.name,
      group: r.group,
      hasKB: r.hasKb,
    }));
  }
}
