import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const NearestComuneQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export class NearestComuneQueryDto extends createZodDto(NearestComuneQuerySchema) {}
