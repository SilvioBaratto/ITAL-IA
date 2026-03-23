import {
  Component,
  signal,
  inject,
  viewChild,
  ElementRef,
  DestroyRef,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  effect,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChatService } from '../../services/chat.service';
import { RegionService } from '../../services/region.service';
import { ChatHistoryService } from '../../services/chat-history.service';
import { ExploreService } from '../../services/explore.service';
import { SavedItemsService } from '../../services/saved-items.service';
import { ToastService } from '../../services/toast.service';
import { ChatMessage, RichContent } from '../../models/chat.model';
import { SavedItemCategory } from '../../models/saved-item.model';
import { MarkdownPipe } from '../../shared/pipes/markdown.pipe';
import { ChatInputComponent } from '../../shared/chat-input/chat-input';
import { LayoutComponent } from '../../shared/layout/layout';

@Component({
  selector: 'app-chatbot',
  imports: [MarkdownPipe, ChatInputComponent],
  templateUrl: './chatbot.html',
  styleUrl: './chatbot.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'flex:1; display:flex; flex-direction:column; min-height:0' },
})
export class ChatbotComponent implements OnInit, OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly regionService = inject(RegionService);
  private readonly chatHistoryService = inject(ChatHistoryService);
  private readonly exploreService = inject(ExploreService);
  private readonly savedItemsService = inject(SavedItemsService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly layout = inject(LayoutComponent);
  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private readonly desktopChatInput = viewChild<ChatInputComponent>('desktopChatInput');

  messages = signal<ChatMessage[]>([]);
  isLoading = signal(false);
  userInput = signal('');
  lastCompletedSummary = signal('');
  hasExistingHistory = signal(false);
  historyPreview = signal<ChatMessage[]>([]);
  readonly currentRegion = this.regionService.selectedRegion;
  readonly currentRegionHasKB = this.regionService.selectedRegionHasKB;
  private pendingLang: string | undefined;
  private previousRegionId: string | null = null;

  /** Load/save chat history on region change or "New chat" clear */
  private readonly historyEffect = effect(() => {
    const region = this.regionService.selectedRegion();
    this.chatHistoryService.clearRequested(); // track clear requests

    // Save messages for previous region on region switch (skip if history card was showing)
    if (this.previousRegionId && this.previousRegionId !== region.id) {
      const prevMessages = untracked(() => this.messages());
      if (prevMessages.length > 0) {
        this.chatHistoryService.saveMessages(this.previousRegionId, prevMessages);
      }
    }

    // Check for existing history — show continue card instead of auto-loading
    const stored = this.chatHistoryService.getMessages(region.id);
    if (stored.length > 0) {
      this.hasExistingHistory.set(true);
      this.historyPreview.set(stored.slice(-2));
      this.messages.set([]);
    } else {
      this.hasExistingHistory.set(false);
      this.historyPreview.set([]);
      this.messages.set([]);
    }

    this.isLoading.set(false);
    this.layout.mobileChatIsLoading.set(false);
    this.lastCompletedSummary.set('');
    this.previousRegionId = region.id;
  });

  readonly explorePrompts = this.exploreService.prompts;
  readonly exploreLoading = this.exploreService.loading;

  ngOnInit() {
    // Register mobile chat input callbacks with layout
    this.layout.registerMobileChatCallbacks(
      (text) => this.onMobileSend(text),
      (text) => this.userInput.set(text),
    );
    this.layout.showMobileChatInput.set(true);
  }

  ngOnDestroy() {
    // Flush current messages — skip if empty to avoid overwriting stored history
    const currentMessages = this.messages();
    if (currentMessages.length > 0) {
      this.chatHistoryService.saveMessages(
        this.regionService.selectedRegion().id,
        currentMessages,
      );
    }
    this.layout.unregisterMobileChatCallbacks();
    this.layout.showMobileChatInput.set(false);
  }

  onNewChat() {
    this.chatHistoryService.clearHistory(this.regionService.selectedRegion().id);
  }

  continueConversation() {
    const stored = this.chatHistoryService.getMessages(this.regionService.selectedRegion().id);
    this.messages.set(stored);
    this.hasExistingHistory.set(false);
    this.historyPreview.set([]);
    this.scrollToBottom();
    this.focusAfterCardDismiss();
  }

  startFresh() {
    this.hasExistingHistory.set(false);
    this.historyPreview.set([]);
    this.chatHistoryService.clearHistory(this.regionService.selectedRegion().id);
    this.focusAfterCardDismiss();
  }

  dismissContinueCard() {
    this.hasExistingHistory.set(false);
    this.historyPreview.set([]);
    this.focusAfterCardDismiss();
  }

  private focusAfterCardDismiss() {
    setTimeout(() => {
      const desktopInput = this.desktopChatInput();
      if (desktopInput) {
        desktopInput.focus();
      } else {
        this.scrollContainer()?.nativeElement.focus();
      }
    }, 0);
  }

  previewContent(msg: ChatMessage): string {
    const text = msg.content.replace(/<[^>]*>/g, '');
    return text.length > 100 ? text.substring(0, 100) + '…' : text;
  }

  quickPrompt(fullPrompt: string, lang = 'it') {
    this.userInput.set(fullPrompt);
    this.syncMobileInput(fullPrompt);
    this.pendingLang = lang;
    this.sendMessage(fullPrompt);
    // Move focus to a valid target after prompt buttons are destroyed (WCAG 2.4.3)
    setTimeout(() => {
      const desktopInput = this.desktopChatInput();
      if (desktopInput) {
        desktopInput.focus();
      } else {
        this.scrollContainer()?.nativeElement.focus();
      }
    }, 0);
  }

  /** Called from desktop ChatInputComponent */
  onChatInputSend(text: string) {
    this.sendMessage(text);
  }

  /** Called from desktop ChatInputComponent */
  onInputChange(text: string) {
    this.userInput.set(text);
    this.syncMobileInput(text);
  }

  /** Called from mobile bottom bar via layout bridge */
  private onMobileSend(text: string) {
    this.sendMessage(text);
  }

  private sendMessage(question: string) {
    question = question.trim();
    if (!question || this.isLoading()) return;

    // Clear previous follow-up suggestions
    this.messages.update((msgs) =>
      msgs.map((m) => (m.suggestions ? { ...m, suggestions: undefined } : m)),
    );

    const lang = this.pendingLang;
    this.pendingLang = undefined;

    this.messages.update((msgs) => [
      ...msgs,
      { id: crypto.randomUUID(), role: 'user', content: question, lang },
    ]);
    this.userInput.set('');
    this.syncMobileInput('');
    this.lastCompletedSummary.set('');
    this.isLoading.set(true);
    this.layout.mobileChatIsLoading.set(true);

    // Persist user message
    const regionId = this.regionService.selectedRegion().id;
    this.chatHistoryService.saveMessages(regionId, this.messages());
    this.scrollToBottom();

    const history = this.messages().map((m) => `${m.role}: ${m.content}`);

    const assistantId = crypto.randomUUID();
    const emptyRich: RichContent = {
      images: [],
      links: [],
      map_links: [],
      tables: [],
      sources: [],
    };

    this.messages.update((msgs) => [
      ...msgs,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        richContent: { ...emptyRich },
        isStreaming: true,
      },
    ]);
    this.scrollToBottom();

    const region = this.regionService.selectedRegion().name;

    this.chatService
      .streamMessage(question, history, region)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (chunk) => {
          this.messages.update((msgs) =>
            msgs.map((m) => {
              if (m.id !== assistantId) return m;
              const data = chunk.data;
              return {
                ...m,
                content: data.text ?? m.content,
                richContent: {
                  images: data.images ?? m.richContent?.images ?? [],
                  links: data.links ?? m.richContent?.links ?? [],
                  map_links: data.map_links ?? m.richContent?.map_links ?? [],
                  tables: data.tables ?? m.richContent?.tables ?? [],
                  sources: data.sources ?? m.richContent?.sources ?? [],
                },
                isStreaming: !chunk.done,
              };
            }),
          );
          // Debounced save during streaming
          this.chatHistoryService.saveMessages(regionId, this.messages());
          this.scrollToBottom();
        },
        error: () => {
          this.messages.update((msgs) =>
            msgs.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: 'Something went wrong. Please try again.',
                    isStreaming: false,
                    isError: true,
                  }
                : m,
            ),
          );
          this.isLoading.set(false);
          this.layout.mobileChatIsLoading.set(false);
          this.scrollToBottom();
        },
        complete: () => {
          const completed = this.messages().find((m) => m.id === assistantId);
          if (completed?.content) {
            const text = completed.content.replace(/<[^>]*>/g, '');
            this.lastCompletedSummary.set(
              text.length > 200
                ? `Assistant replied: ${text.substring(0, 200)}…`
                : `Assistant replied: ${text}`,
            );
          }

          // Compute follow-up suggestions from explore data
          const suggestions = this.computeSuggestions(question);
          if (suggestions.length) {
            this.messages.update((msgs) =>
              msgs.map((m) =>
                m.id === assistantId ? { ...m, suggestions } : m,
              ),
            );
            // Announce to screen readers (WCAG 4.1.3)
            this.lastCompletedSummary.update(
              (prev) =>
                prev + ` ${suggestions.length} suggerimenti di follow-up disponibili.`,
            );
          }

          this.isLoading.set(false);
          this.layout.mobileChatIsLoading.set(false);
          // Final save after streaming completes
          this.chatHistoryService.saveMessages(regionId, this.messages());
          this.scrollToBottom();
        },
      });
  }

  onImageError(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  /** Handle citation link clicks — smooth scroll to the scoped source element */
  onCitationClick(event: Event) {
    const target = event.target as HTMLElement;
    const link = target.closest('.citation-link');
    if (!link) return;

    event.preventDefault();
    const citationId = link.getAttribute('data-citation');
    if (!citationId) return;

    const sourceEl = document.getElementById(`source-${citationId}`);
    if (!sourceEl) return;

    sourceEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // Trigger highlight class for visual feedback
    sourceEl.classList.add('citation-target-active');
    setTimeout(() => sourceEl.classList.remove('citation-target-active'), 1500);
  }

  isItemSaved(name: string, category: SavedItemCategory): boolean {
    return this.savedItemsService.isSaved(name, this.regionService.selectedRegion().id, category);
  }

  toggleBookmark(event: Event, type: 'image' | 'link' | 'map', name: string, imageOrUrl: string, mapsUrl: string, website: string) {
    const region = this.regionService.selectedRegion().id;
    const category: SavedItemCategory = 'PLACE';
    const saved = this.savedItemsService.isSaved(name, region, category);
    const itemData = {
      name, category, region, description: name,
      imageUrl: type === 'image' ? imageOrUrl : undefined,
      mapsUrl: type === 'map' ? mapsUrl : undefined,
      website: type === 'link' ? website : undefined,
    };

    // Trigger scale animation on the button
    const btn = (event.currentTarget as HTMLElement);
    btn.classList.remove('bookmark-pop');
    void btn.offsetWidth; // force reflow
    btn.classList.add('bookmark-pop');

    if (saved) {
      this.savedItemsService.unsave(name, region, category)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe();

      this.toastService.show('Rimosso dai preferiti', () => {
        this.savedItemsService.save(itemData)
          .pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
      });
    } else {
      this.savedItemsService.save(itemData)
        .pipe(takeUntilDestroyed(this.destroyRef)).subscribe();

      this.toastService.show('Salvato nei preferiti', () => {
        this.savedItemsService.unsave(name, region, category)
          .pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
      });
    }
  }

  private static readonly STOP_WORDS_IT = new Set([
    'sono', 'come', 'cosa', 'dove', 'quali', 'quale', 'della', 'delle',
    'dello', 'degli', 'nella', 'nelle', 'nello', 'negli', 'dalla', 'dalle',
    'posso', 'anche', 'questo', 'questa', 'quello', 'quella', 'molto',
    'tutti', 'tutto', 'ogni', 'alcuni', 'altre', 'altri', 'fare', 'essere',
    'avere', 'loro', 'nostro', 'perché', 'quando', 'ancora', 'proprio',
    'dopo', 'prima', 'senza', 'circa', 'oltre', 'lungo',
  ]);

  private computeSuggestions(userQuestion: string): string[] {
    const categories = this.exploreService.prompts();
    if (!categories.length) return [];

    const questionLower = userQuestion.toLowerCase();
    const questionWords = questionLower
      .split(/\s+/)
      .filter(
        (w) => w.length > 3 && !ChatbotComponent.STOP_WORDS_IT.has(w),
      );

    // Score each category by keyword overlap with its prompts
    let bestCategory: (typeof categories)[0] | null = null;
    let bestScore = 0;

    for (const cat of categories) {
      for (const prompt of cat.prompts) {
        const promptWords = prompt.fullPrompt.toLowerCase().split(/\s+/);
        const overlap = questionWords.filter((w) =>
          promptWords.some((pw) => pw.includes(w)),
        ).length;
        if (overlap > bestScore) {
          bestScore = overlap;
          bestCategory = cat;
        }
      }
    }

    // If no strong match, pick a random category for variety
    if (!bestCategory || bestScore < 2) {
      bestCategory = categories[Math.floor(Math.random() * categories.length)];
    }

    // Pick up to 3 prompts, excluding the one matching the user's question
    const available = bestCategory.prompts.filter(
      (p) => p.fullPrompt.toLowerCase() !== questionLower,
    );

    // Fisher-Yates shuffle for unbiased randomization
    const shuffled = [...available];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 3).map((p) => p.fullPrompt);
  }

  private syncMobileInput(text: string) {
    this.layout.mobileChatUserInput.set(text);
  }

  private scrollToBottom() {
    setTimeout(() => {
      const el = this.scrollContainer()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }
}
