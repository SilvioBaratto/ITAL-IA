import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const NearestComuneResponseSchema = z.object({
  name: z.string(),
  province: z.string(),
  regionId: z.string(),
  distance_km: z.number(),
});

export class NearestComuneResponseDto extends createZodDto(NearestComuneResponseSchema) {}
