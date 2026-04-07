import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { PoiCategory } from '../../../../generated/prisma/client';

export const PoiQuerySchema = z.object({
  regionId: z.string().max(50).optional(),
  category: z.nativeEnum(PoiCategory).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const PoiStatsQuerySchema = z.object({
  regionId: z.string().max(50).optional(),
});

export class PoiQueryDto extends createZodDto(PoiQuerySchema) {}
export class PoiStatsQueryDto extends createZodDto(PoiStatsQuerySchema) {}
