import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { PoiCategory } from '../../../../generated/prisma/client';

export const PoiQuerySchema = z.object({
  regionId: z.string().max(50).optional(),
  category: z.nativeEnum(PoiCategory).optional(),
});

export class PoiQueryDto extends createZodDto(PoiQuerySchema) {}
