import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { PoiCategory } from '../../../../generated/prisma/client';

export const PoiQuerySchema = z.object({
  regionId: z.string().max(50).optional(),
  comuneId: z.string().uuid().optional(),
  category: z.nativeEnum(PoiCategory).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  // `curated` orders by data richness (POIs with an image and description
  // bubble to the top). Used by the Italiapedia "Tutti" preview, which
  // cherry-picks the top 6 per category — alphabetical-by-name would
  // just surface whatever happens to start with "A".
  order: z.enum(['default', 'curated']).default('default'),
});

export const PoiStatsQuerySchema = z.object({
  regionId: z.string().max(50).optional(),
  comuneId: z.string().uuid().optional(),
});

export class PoiQueryDto extends createZodDto(PoiQuerySchema) {}
export class PoiStatsQueryDto extends createZodDto(PoiStatsQuerySchema) {}
