import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// ── Shared ──────────────────────────────────────────────────────────────────

export const SAVED_ITEM_CATEGORIES = [
  'RESTAURANT',
  'MUSEUM',
  'EVENT',
  'PLACE',
  'WINE',
  'EXPERIENCE',
] as const;

export const SavedItemCategorySchema = z.enum(SAVED_ITEM_CATEGORIES);

// ── Request DTOs ─────────────────────────────────────────────────────────────

export const CreateSavedItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(500),
  category: SavedItemCategorySchema,
  region: z.string().min(1, 'Region is required').max(100),
  description: z.string().min(1, 'Description is required'),
  address: z.string().max(500).optional(),
  mapsUrl: z.string().url().max(1000).optional(),
  website: z.string().url().max(1000).optional(),
  imageUrl: z.string().url().max(1000).optional(),
});

export const ListSavedItemsQuerySchema = z.object({
  region: z.string().max(100).optional(),
  category: SavedItemCategorySchema.optional(),
});

export const CheckSavedItemQuerySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  region: z.string().min(1, 'Region is required'),
  category: SavedItemCategorySchema,
});

// ── Response DTOs ─────────────────────────────────────────────────────────────

export const SavedItemResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  category: SavedItemCategorySchema,
  region: z.string(),
  description: z.string(),
  address: z.string().nullable(),
  mapsUrl: z.string().nullable(),
  website: z.string().nullable(),
  imageUrl: z.string().nullable(),
  savedAt: z.date(),
});

export const CheckSavedItemResponseSchema = z.object({
  isSaved: z.boolean(),
  id: z.string().uuid().optional(),
});

// ── DTO classes ───────────────────────────────────────────────────────────────

export class CreateSavedItemDto extends createZodDto(CreateSavedItemSchema) {}
export class ListSavedItemsQueryDto extends createZodDto(ListSavedItemsQuerySchema) {}
export class CheckSavedItemQueryDto extends createZodDto(CheckSavedItemQuerySchema) {}
export class SavedItemResponseDto extends createZodDto(SavedItemResponseSchema) {}
export class CheckSavedItemResponseDto extends createZodDto(CheckSavedItemResponseSchema) {}
