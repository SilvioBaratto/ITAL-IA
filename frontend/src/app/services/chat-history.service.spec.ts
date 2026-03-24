import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ChatHistoryService } from './chat-history.service';
import { ConversationService } from './conversation.service';
import { ChatMessage } from '../models/chat.model';
import { ConversationDetail, ConversationSummary } from '../models/conversation.model';

const REGION = 'friuli-venezia-giulia';
const STORAGE_KEY = `italia-chat-${REGION}`;

function makeMessage(id: string, content = 'hello', isStreaming = false): ChatMessage {
  return { id, role: 'user', content, isStreaming };
}

function makeSummary(id = 'conv-1'): ConversationSummary {
  return { id, regionId: REGION, title: 'T', createdAt: '', updatedAt: '', _count: { messages: 0 } };
}

describe('ChatHistoryService', () => {
  let service: ChatHistoryService;
  let conversationSpy: jasmine.SpyObj<ConversationService>;

  beforeEach(() => {
    conversationSpy = jasmine.createSpyObj<ConversationService>('ConversationService', [
      'create',
      'list',
      'get',
      'appendMessage',
      'updateTitle',
      'delete',
    ]);

    spyOn(localStorage, 'getItem').and.returnValue(null);
    spyOn(localStorage, 'setItem');
    spyOn(localStorage, 'removeItem');

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: ConversationService, useValue: conversationSpy },
      ],
    });

    service = TestBed.inject(ChatHistoryService);
  });

  // ── getMessages ──────────────────────────────────────────────────────────

  it('getMessages returns [] when key is absent from localStorage', () => {
    expect(service.getMessages(REGION)).toEqual([]);
  });

  it('getMessages parses and returns stored messages', () => {
    const msgs = [makeMessage('1'), makeMessage('2')];
    (localStorage.getItem as jasmine.Spy).and.returnValue(JSON.stringify(msgs));
    expect(service.getMessages(REGION)).toEqual(msgs);
  });

  it('getMessages returns only the last 50 messages', () => {
    const msgs = Array.from({ length: 60 }, (_, i) => makeMessage(String(i)));
    (localStorage.getItem as jasmine.Spy).and.returnValue(JSON.stringify(msgs));
    const result = service.getMessages(REGION);
    expect(result.length).toBe(50);
    expect(result[0].id).toBe('10');
  });

  it('getMessages returns [] for malformed JSON', () => {
    (localStorage.getItem as jasmine.Spy).and.returnValue('not-json{{{');
    expect(service.getMessages(REGION)).toEqual([]);
  });

  // ── saveMessages ─────────────────────────────────────────────────────────

  describe('saveMessages debounce (jasmine.clock)', () => {
    beforeEach(() => jasmine.clock().install());
    afterEach(() => jasmine.clock().uninstall());

    it('writes to localStorage after 100ms debounce', () => {
      service.saveMessages(REGION, [makeMessage('1')]);
      expect(localStorage.setItem).not.toHaveBeenCalled();
      jasmine.clock().tick(100);
      expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, jasmine.any(String));
    });

    it('debounces rapid calls into one write', () => {
      service.saveMessages(REGION, [makeMessage('1')]);
      service.saveMessages(REGION, [makeMessage('1'), makeMessage('2')]);
      jasmine.clock().tick(100);
      expect(localStorage.setItem).toHaveBeenCalledTimes(1);
      const persisted: ChatMessage[] = JSON.parse(
        (localStorage.setItem as jasmine.Spy).calls.mostRecent().args[1] as string,
      );
      expect(persisted.length).toBe(2);
    });

    it('strips isStreaming from persisted messages', () => {
      service.saveMessages(REGION, [makeMessage('1', 'hello', true)]);
      jasmine.clock().tick(100);
      const persisted: ChatMessage[] = JSON.parse(
        (localStorage.setItem as jasmine.Spy).calls.mostRecent().args[1] as string,
      );
      expect(persisted[0].isStreaming).toBe(false);
    });

    it('enforces the 50-message limit', () => {
      const msgs = Array.from({ length: 60 }, (_, i) => makeMessage(String(i)));
      service.saveMessages(REGION, msgs);
      jasmine.clock().tick(100);
      const persisted: ChatMessage[] = JSON.parse(
        (localStorage.setItem as jasmine.Spy).calls.mostRecent().args[1] as string,
      );
      expect(persisted.length).toBe(50);
    });

    it('clearHistory cancels a pending debounced save', () => {
      service.saveMessages(REGION, [makeMessage('1')]);
      service.clearHistory(REGION);
      jasmine.clock().tick(100);
      expect(localStorage.setItem).not.toHaveBeenCalled();
    });
  });

  // ── clearHistory ──────────────────────────────────────────────────────────

  it('clearHistory removes the key from localStorage', () => {
    service.clearHistory(REGION);
    expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('clearHistory increments clearRequested signal', () => {
    const before = service.clearRequested();
    service.clearHistory(REGION);
    expect(service.clearRequested()).toBe(before + 1);
  });

  it('clearHistory calls conversationService.delete when a conversation is active', async () => {
    conversationSpy.create.and.returnValue(of(makeSummary('conv-1')));
    conversationSpy.delete.and.returnValue(of(undefined));
    await service.ensureConversation(REGION);
    service.clearHistory(REGION);
    expect(conversationSpy.delete).toHaveBeenCalledWith('conv-1');
  });

  it('clearHistory does not call delete when no conversation is active', () => {
    service.clearHistory(REGION);
    expect(conversationSpy.delete).not.toHaveBeenCalled();
  });

  // ── ensureConversation ────────────────────────────────────────────────────

  it('ensureConversation creates a conversation and returns its id', async () => {
    conversationSpy.create.and.returnValue(of(makeSummary('conv-1')));
    const id = await service.ensureConversation(REGION);
    expect(id).toBe('conv-1');
    expect(conversationSpy.create).toHaveBeenCalledTimes(1);
  });

  it('ensureConversation returns cached id on subsequent calls', async () => {
    conversationSpy.create.and.returnValue(of(makeSummary('conv-1')));
    await service.ensureConversation(REGION);
    await service.ensureConversation(REGION);
    expect(conversationSpy.create).toHaveBeenCalledTimes(1);
  });

  it('ensureConversation returns empty string when creation fails', async () => {
    conversationSpy.create.and.returnValue(throwError(() => new Error('Network')));
    const id = await service.ensureConversation(REGION);
    expect(id).toBe('');
  });

  // ── persistMessage ────────────────────────────────────────────────────────

  it('persistMessage is a no-op when no conversation is active', () => {
    service.persistMessage(REGION, 'USER', 'hello');
    expect(conversationSpy.appendMessage).not.toHaveBeenCalled();
  });

  it('persistMessage calls appendMessage when a conversation is active', async () => {
    conversationSpy.create.and.returnValue(of(makeSummary('conv-1')));
    conversationSpy.appendMessage.and.returnValue(
      of({ id: 'm1', conversationId: 'conv-1', role: 'USER', content: 'hi', richContent: null, createdAt: '' }),
    );
    await service.ensureConversation(REGION);
    service.persistMessage(REGION, 'USER', 'hi');
    expect(conversationSpy.appendMessage).toHaveBeenCalledWith('conv-1', {
      role: 'USER',
      content: 'hi',
      richContent: undefined,
    });
  });

  // ── autoTitle ─────────────────────────────────────────────────────────────

  it('autoTitle truncates messages longer than 80 chars', async () => {
    conversationSpy.create.and.returnValue(of(makeSummary('conv-1')));
    conversationSpy.updateTitle.and.returnValue(of(makeSummary('conv-1')));
    await service.ensureConversation(REGION);
    service.autoTitle(REGION, 'a'.repeat(100));
    const called = (conversationSpy.updateTitle as jasmine.Spy).calls.mostRecent().args[1];
    expect(called).toBe('a'.repeat(80) + '…');
  });

  it('autoTitle uses the full message when it is 80 chars or fewer', async () => {
    conversationSpy.create.and.returnValue(of(makeSummary('conv-1')));
    conversationSpy.updateTitle.and.returnValue(of(makeSummary('conv-1')));
    await service.ensureConversation(REGION);
    service.autoTitle(REGION, 'Short message');
    expect(conversationSpy.updateTitle).toHaveBeenCalledWith('conv-1', 'Short message');
  });

  it('autoTitle is a no-op when no conversation is active', () => {
    service.autoTitle(REGION, 'hello');
    expect(conversationSpy.updateTitle).not.toHaveBeenCalled();
  });

  // ── syncFromBackend ───────────────────────────────────────────────────────

  it('syncFromBackend hydrates localStorage from the latest conversation', async () => {
    const detail: ConversationDetail = {
      id: 'conv-1',
      regionId: REGION,
      title: 'T',
      createdAt: '',
      updatedAt: '',
      messages: [
        { id: 'm1', conversationId: 'conv-1', role: 'USER', content: 'hello', richContent: null, createdAt: '' },
      ],
    };
    conversationSpy.list.and.returnValue(of([makeSummary('conv-1')]));
    conversationSpy.get.and.returnValue(of(detail));
    await service.syncFromBackend(REGION);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      jasmine.stringContaining('hello'),
    );
  });

  it('syncFromBackend does nothing when conversations list is empty', async () => {
    conversationSpy.list.and.returnValue(of([]));
    await service.syncFromBackend(REGION);
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('syncFromBackend swallows network errors silently', async () => {
    conversationSpy.list.and.returnValue(throwError(() => new Error('Network')));
    await expectAsync(service.syncFromBackend(REGION)).toBeResolved();
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });
});
