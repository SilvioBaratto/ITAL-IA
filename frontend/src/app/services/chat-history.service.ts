import { Injectable, signal } from '@angular/core';
import { ChatMessage } from '../models/chat.model';

const STORAGE_PREFIX = 'italia-chat-';
const MAX_MESSAGES = 50;
const DEBOUNCE_MS = 100;

@Injectable({
  providedIn: 'root',
})
export class ChatHistoryService {
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Incremented when "New chat" clears history — watchers re-read localStorage */
  readonly clearRequested = signal(0);

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
    this.clearRequested.update((v) => v + 1);
  }
}
