import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { PoiCategory, RegionGroup } from '../../../../generated/prisma/client';

// ── Shared ──────────────────────────────────────────────────────────────────

const RegionSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  group: z.nativeEnum(RegionGroup),
});

// ── Response DTOs ───────────────────────────────────────────────────────────

export const PoiResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  regionId: z.string(),
  category: z.nativeEnum(PoiCategory),
  address: z.string().nullable(),
  neighborhood: z.string().nullable(),
  latitude: z.any().nullable(),
  longitude: z.any().nullable(),
  websiteUrl: z.string().nullable(),
  mapsUrl: z.string().nullable(),
  imageUrl: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  region: RegionSummarySchema.optional(),
});

export const PaginatedPoiResponseSchema = z.object({
  data: z.array(PoiResponseSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export const PoiStatItemSchema = z.object({
  category: z.nativeEnum(PoiCategory),
  count: z.number().int().nonnegative(),
});

export const RelatedPoiItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: z.nativeEnum(PoiCategory),
  imageUrl: z.string().nullable(),
  address: z.string().nullable(),
});

// ── DTO classes ─────────────────────────────────────────────────────────────

export class PoiResponseDto extends createZodDto(PoiResponseSchema) {}
export class PaginatedPoiResponseDto extends createZodDto(PaginatedPoiResponseSchema) {}
export class PoiStatItemDto extends createZodDto(PoiStatItemSchema) {}
export class RelatedPoiItemDto extends createZodDto(RelatedPoiItemSchema) {}
