import { Injectable, signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ChatMessage, RichContent } from '../models/chat.model';
import { ConversationService } from './conversation.service';

@Injectable({ providedIn: 'root' })
export class ChatHistoryService {
  private readonly conversationService = inject(ConversationService);
  private readonly activeConversationIds = new Map<string, string>();

  private readonly _storedMessages = signal<ChatMessage[]>([]);
  private readonly _loading = signal(false);

  readonly storedMessages = this._storedMessages.asReadonly();
  readonly loading = this._loading.asReadonly();

  /** Load the latest conversation for a region from the backend. */
  async loadForRegion(regionId: string): Promise<void> {
    this._loading.set(true);
    this._storedMessages.set([]);
    try {
      const conversations = await firstValueFrom(this.conversationService.list(regionId));
      if (!conversations.length) { this._loading.set(false); return; }

      const latest = conversations[0];
      const detail = await firstValueFrom(this.conversationService.get(latest.id));
      this.activeConversationIds.set(regionId, latest.id);

      const messages: ChatMessage[] = detail.messages.map((m) => ({
        id: m.id,
        role: m.role === 'USER' ? 'user' : 'assistant',
        content: m.content,
        richContent: m.richContent as RichContent | undefined,
      }));
      this._storedMessages.set(messages);
    } catch {
      // Network failure — storedMessages stays empty
    }
    this._loading.set(false);
  }

  /** Delete the current conversation from the backend and clear in-memory state. */
  clearHistory(regionId: string): void {
    const convId = this.activeConversationIds.get(regionId);
    this._storedMessages.set([]);
    this.activeConversationIds.delete(regionId);
    if (convId) {
      this.conversationService.delete(convId).subscribe({ error: () => {} });
    }
  }

  /** Ensure a backend conversation exists for this region. Creates one if needed. */
  async ensureConversation(regionId: string): Promise<string> {
    const existing = this.activeConversationIds.get(regionId);
    if (existing) return existing;
    try {
      const conv = await firstValueFrom(this.conversationService.create(regionId));
      this.activeConversationIds.set(regionId, conv.id);
      return conv.id;
    } catch {
      return '';
    }
  }

  /** Fire-and-forget: persist a single message to the backend. */
  persistMessage(
    regionId: string,
    role: 'USER' | 'ASSISTANT',
    content: string,
    richContent?: RichContent,
  ): void {
    const convId = this.activeConversationIds.get(regionId);
    if (!convId) return;
    this.conversationService
      .appendMessage(convId, {
        role,
        content,
        richContent: richContent as Record<string, unknown> | undefined,
      })
      .subscribe({ error: () => {} });
  }

  /** Set conversation title to the first user message (truncated to 80 chars). */
  autoTitle(regionId: string, firstUserMessage: string): void {
    const convId = this.activeConversationIds.get(regionId);
    if (!convId) return;
    const title =
      firstUserMessage.length > 80
        ? firstUserMessage.substring(0, 80) + '…'
        : firstUserMessage;
    this.conversationService.updateTitle(convId, title).subscribe({ error: () => {} });
  }
}
