import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const RegionResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  group: z.enum(['NORD', 'CENTRO', 'SUD', 'ISOLE']),
  hasKB: z.boolean(),
});

export class RegionResponseDto extends createZodDto(RegionResponseSchema) {}
