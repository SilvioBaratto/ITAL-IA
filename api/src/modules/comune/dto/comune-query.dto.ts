import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ComuneQuerySchema = z.object({
  regionId: z.string().max(50),
  province: z.string().max(5).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
  offset: z.coerce.number().int().min(0).default(0),
});

export class ComuneQueryDto extends createZodDto(ComuneQuerySchema) {}
