import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const EchoRequestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
});

export const EchoResponseSchema = z.object({
  message: z.string(),
});

export class EchoRequestDto extends createZodDto(EchoRequestSchema) {}
export class EchoResponseDto extends createZodDto(EchoResponseSchema) {}
