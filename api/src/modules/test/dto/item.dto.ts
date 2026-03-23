import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

export const UpdateItemSchema = CreateItemSchema.partial();

export const ItemResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export class CreateItemDto extends createZodDto(CreateItemSchema) {}
export class UpdateItemDto extends createZodDto(UpdateItemSchema) {}
export class ItemResponseDto extends createZodDto(ItemResponseSchema) {}
