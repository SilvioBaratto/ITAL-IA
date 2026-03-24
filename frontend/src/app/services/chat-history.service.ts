import { Injectable, signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ChatMessage, RichContent } from '../models/chat.model';
import { ConversationService } from './conversation.service';

const STORAGE_PREFIX = 'italia-chat-';
const MAX_MESSAGES = 50;
const DEBOUNCE_MS = 100;

@Injectable({
  providedIn: 'root',
})
export class ChatHistoryService {
  private readonly conversationService = inject(ConversationService);
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Active backend conversation ID per region (in-memory, reset on clearHistory) */
  private readonly activeConversationIds = new Map<string, string>();

  /** Incremented when "New chat" clears history — watchers re-read localStorage */
  readonly clearRequested = signal(0);

  // ── Local storage ─────────────────────────────────────────────────────────

  getMessages(regionId: string): ChatMessage[] {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + regionId);
      if (!raw) return [];
      const msgs: ChatMessage[] = JSON.parse(raw);
      return msgs.slice(-MAX_MESSAGES);
    } catch {
      return [];
    }
  }

  saveMessages(regionId: string, messages: ChatMessage[]): void {
    const existing = this.debounceTimers.get(regionId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(regionId);
      const cleaned = messages
        .slice(-MAX_MESSAGES)
        .map((msg) => ({ ...msg, isStreaming: false }));
      try {
        localStorage.setItem(STORAGE_PREFIX + regionId, JSON.stringify(cleaned));
      } catch {
        // Storage full or unavailable
      }
    }, DEBOUNCE_MS);

    this.debounceTimers.set(regionId, timer);
  }

  clearHistory(regionId: string): void {
    const existing = this.debounceTimers.get(regionId);
    if (existing) clearTimeout(existing);
    this.debounceTimers.delete(regionId);
    localStorage.removeItem(STORAGE_PREFIX + regionId);

    const convId = this.activeConversationIds.get(regionId);
    if (convId) {
      this.activeConversationIds.delete(regionId);
      this.conversationService.delete(convId).subscribe({ error: () => {} });
    }

    this.clearRequested.update((v) => v + 1);
  }

  // ── Backend sync ──────────────────────────────────────────────────────────

  /**
   * On component init: load the most recent backend conversation for this
   * region and hydrate localStorage. Falls back silently if offline.
   */
  async syncFromBackend(regionId: string): Promise<void> {
    try {
      const conversations = await firstValueFrom(
        this.conversationService.list(regionId),
      );
      if (!conversations.length) return;

      const latest = conversations[0]; // ordered by updatedAt desc
      const detail = await firstValueFrom(
        this.conversationService.get(latest.id),
      );

      this.activeConversationIds.set(regionId, latest.id);

      const messages: ChatMessage[] = detail.messages.map((m) => ({
        id: m.id,
        role: m.role === 'USER' ? 'user' : 'assistant',
        content: m.content,
        richContent: m.richContent as RichContent | undefined,
      }));

      if (messages.length > 0) {
        try {
          localStorage.setItem(
            STORAGE_PREFIX + regionId,
            JSON.stringify(messages.slice(-MAX_MESSAGES)),
          );
        } catch {
          // Storage unavailable
        }
      }
    } catch {
      // Network error — localStorage remains the source of truth
    }
  }

  /**
   * Ensures a backend conversation exists for this region.
   * Creates one if needed. Returns the conversation ID, or '' on failure.
   */
  async ensureConversation(regionId: string): Promise<string> {
    const existing = this.activeConversationIds.get(regionId);
    if (existing) return existing;

    try {
      const conv = await firstValueFrom(
        this.conversationService.create(regionId),
      );
      this.activeConversationIds.set(regionId, conv.id);
      return conv.id;
    } catch {
      return '';
    }
  }

  /**
   * Fire-and-forget: persist a single message to the backend.
   * No-ops silently if no conversation ID is set (offline / create failed).
   */
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

  /**
   * Set the conversation title to the first user message (truncated to 80 chars).
   */
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
