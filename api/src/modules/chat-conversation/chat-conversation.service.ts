import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatMessageRole } from '../../../generated/prisma/client';
import {
  CreateConversationDto,
  AppendMessageDto,
  UpdateTitleDto,
  ListConversationsQueryDto,
} from './dto/chat-conversation.dto';

@Injectable()
export class ChatConversationService {
  private readonly logger = new Logger(ChatConversationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateConversationDto) {
    this.logger.log(`Creating conversation for user ${userId} in region ${dto.regionId}`);
    return this.prisma.chatConversation.create({
      data: {
        userId,
        regionId: dto.regionId,
        title: dto.title ?? 'Nuova conversazione',
      },
    });
  }

  async listForUser(userId: string, query: ListConversationsQueryDto) {
    return this.prisma.chatConversation.findMany({
      where: {
        userId,
        ...(query.regionId ? { regionId: query.regionId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
  }

  async findOne(id: string, userId: string) {
    const conv = await this.prisma.chatConversation.findFirst({
      where: { id, userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conv) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }
    return conv;
  }

  async appendMessage(conversationId: string, userId: string, dto: AppendMessageDto) {
    const conv = await this.prisma.chatConversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true },
    });
    if (!conv) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        role: dto.role as ChatMessageRole,
        content: dto.content,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        richContent: (dto.richContent ?? undefined) as any,
      },
    });

    // Touch updatedAt so list ordering stays fresh (Prisma @updatedAt only fires on direct model updates)
    await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    this.logger.log(`Appended ${dto.role} message to conversation ${conversationId}`);
    return message;
  }

  async updateTitle(id: string, userId: string, dto: UpdateTitleDto) {
    const conv = await this.prisma.chatConversation.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!conv) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }
    return this.prisma.chatConversation.update({
      where: { id },
      data: { title: dto.title },
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    const conv = await this.prisma.chatConversation.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!conv) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }
    await this.prisma.chatConversation.delete({ where: { id } });
    this.logger.log(`Deleted conversation ${id} for user ${userId}`);
  }
}
