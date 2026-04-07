import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ComuneResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  province: z.string(),
  regionId: z.string(),
  latitude: z.any(),
  longitude: z.any(),
});

export const PaginatedComuneResponseSchema = z.object({
  data: z.array(ComuneResponseSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export class ComuneResponseDto extends createZodDto(ComuneResponseSchema) {}
export class PaginatedComuneResponseDto extends createZodDto(PaginatedComuneResponseSchema) {}
