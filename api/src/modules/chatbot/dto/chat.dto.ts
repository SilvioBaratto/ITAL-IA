import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// Request
export const ChatRequestSchema = z.object({
  user_question: z.string().min(1, 'Question is required').max(2000),
  conversation_history: z
    .object({ messages: z.array(z.string().max(5000)).max(50) })
    .optional(),
  region: z.string().optional(),
});

// Rich response sub-types
export const ImageItemSchema = z.object({
  url: z.string(),
  alt: z.string(),
});

export const LinkItemSchema = z.object({
  text: z.string(),
  url: z.string(),
});

export const MapLinkSchema = z.object({
  place_name: z.string(),
  address: z.string(),
  maps_url: z.string(),
});

export const TableDataSchema = z.object({
  title: z.string(),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

export const SourceCitationSchema = z.object({
  title: z.string(),
  url: z.string(),
});

export const ItemCategoryMapSchema = z.object({
  name: z.string(),
  category: z.enum(['RESTAURANT', 'MUSEUM', 'EVENT', 'WINE', 'EXPERIENCE', 'PLACE']),
});

// Full rich response
export const RichChatResponseSchema = z.object({
  text: z.string(),
  images: z.array(ImageItemSchema),
  links: z.array(LinkItemSchema),
  map_links: z.array(MapLinkSchema),
  tables: z.array(TableDataSchema),
  sources: z.array(SourceCitationSchema),
  item_categories: z.array(ItemCategoryMapSchema).optional().default([]),
});

// Stream chunk
export const StreamChunkSchema = z.object({
  type: z.enum(['partial', 'complete', 'error']),
  data: RichChatResponseSchema.partial(),
  done: z.boolean(),
});

// Legacy response (backward compat)
export const ChatResponseSchema = z.object({
  answer: z.string(),
});

export class ChatRequestDto extends createZodDto(ChatRequestSchema) {}
export class RichChatResponseDto extends createZodDto(RichChatResponseSchema) {}
export class StreamChunkDto extends createZodDto(StreamChunkSchema) {}
export class ChatResponseDto extends createZodDto(ChatResponseSchema) {}
