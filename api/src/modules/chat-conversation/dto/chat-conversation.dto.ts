import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// ── Shared ────────────────────────────────────────────────────────────────────

export const CHAT_MESSAGE_ROLES = ['USER', 'ASSISTANT'] as const;
export const ChatMessageRoleSchema = z.enum(CHAT_MESSAGE_ROLES);

// ── Request DTOs ──────────────────────────────────────────────────────────────

export const CreateConversationSchema = z.object({
  regionId: z.string().min(1).max(50),
  title: z.string().max(500).optional(),
});

export const AppendMessageSchema = z.object({
  role: ChatMessageRoleSchema,
  content: z.string().min(1),
  richContent: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const UpdateTitleSchema = z.object({
  title: z.string().min(1).max(500),
});

export const ListConversationsQuerySchema = z.object({
  regionId: z.string().max(50).optional(),
});

// ── Response DTOs ─────────────────────────────────────────────────────────────

export const MessageResponseSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: ChatMessageRoleSchema,
  content: z.string(),
  richContent: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.date(),
});

export const ConversationSummarySchema = z.object({
  id: z.string().uuid(),
  regionId: z.string(),
  title: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  _count: z.object({ messages: z.number().int() }),
});

export const ConversationDetailSchema = z.object({
  id: z.string().uuid(),
  regionId: z.string(),
  title: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  messages: z.array(MessageResponseSchema),
});

// ── DTO classes ───────────────────────────────────────────────────────────────

export class CreateConversationDto extends createZodDto(CreateConversationSchema) {}
export class AppendMessageDto extends createZodDto(AppendMessageSchema) {}
export class UpdateTitleDto extends createZodDto(UpdateTitleSchema) {}
export class ListConversationsQueryDto extends createZodDto(ListConversationsQuerySchema) {}
export class MessageResponseDto extends createZodDto(MessageResponseSchema) {}
export class ConversationSummaryDto extends createZodDto(ConversationSummarySchema) {}
export class ConversationDetailDto extends createZodDto(ConversationDetailSchema) {}
