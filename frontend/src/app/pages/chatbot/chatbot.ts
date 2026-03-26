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
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChatService } from '../../services/chat.service';
import { RegionService } from '../../services/region.service';
import { ExploreService } from '../../services/explore.service';
import { SavedItemsService } from '../../services/saved-items.service';
import { ToastService } from '../../services/toast.service';
import { MobileChatBridgeService } from '../../services/mobile-chat-bridge.service';
import { ThemeService } from '../../services/theme.service';
import { ChatMessage, RichContent } from '../../models/chat.model';
import { SavedItemCategory } from '../../models/saved-item.model';
import { MarkdownPipe } from '../../shared/pipes/markdown.pipe';
import { ChatInputComponent } from '../../shared/chat-input/chat-input';
import {
  LucidePlus,
  LucideTriangleAlert,
  LucideCircleAlert,
  LucideRotateCcw,
  LucideBookmark,
  LucideExternalLink,
  LucideMapPin,
  LucideFileText,
  LucideSun,
  LucideMoon,
} from '@lucide/angular';

@Component({
  selector: 'app-chatbot',
  imports: [
    MarkdownPipe,
    ChatInputComponent,
    LucidePlus,
    LucideTriangleAlert,
    LucideCircleAlert,
    LucideRotateCcw,
    LucideBookmark,
    LucideExternalLink,
    LucideMapPin,
    LucideFileText,
    LucideSun,
    LucideMoon,
  ],
  templateUrl: './chatbot.html',
  styleUrl: './chatbot.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'flex:1; display:flex; flex-direction:column; min-height:0' },
})
export class ChatbotComponent implements OnInit, OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly regionService = inject(RegionService);
  private readonly exploreService = inject(ExploreService);
  private readonly savedItemsService = inject(SavedItemsService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly bridge = inject(MobileChatBridgeService);
  readonly themeService = inject(ThemeService);
  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private readonly desktopChatInput = viewChild<ChatInputComponent>('desktopChatInput');

  messages = signal<ChatMessage[]>([]);
  isLoading = signal(false);
  userInput = signal('');
  lastCompletedSummary = signal('');

  readonly currentRegion = this.regionService.selectedRegion;
  readonly currentRegionHasKB = this.regionService.selectedRegionHasKB;
  private pendingLang: string | undefined;

  /** Reset chat state on every region change. */
  private readonly regionResetEffect = effect(() => {
    this.regionService.selectedRegion();
    this.messages.set([]);
    this.isLoading.set(false);
    this.bridge.isLoading.set(false);
    this.lastCompletedSummary.set('');
  });

  /** Reset chat when sidebar requests a new chat. */
  private readonly chatResetEffect = effect(() => {
    this.bridge.resetRequested();
    this.messages.set([]);
    this.isLoading.set(false);
    this.bridge.isLoading.set(false);
    this.lastCompletedSummary.set('');
  });

  readonly explorePrompts = this.exploreService.prompts;
  readonly exploreLoading = this.exploreService.loading;
  readonly exploreError = this.exploreService.error;

  ngOnInit() {
    this.bridge.register({
      send: (text) => this.onMobileSend(text),
      inputChange: (text) => this.userInput.set(text),
    });
    this.bridge.showInput.set(true);
  }

  ngOnDestroy() {
    this.bridge.unregister();
    this.bridge.showInput.set(false);
  }

  onNewChat() {
    this.messages.set([]);
    this.isLoading.set(false);
    this.bridge.isLoading.set(false);
    this.lastCompletedSummary.set('');
  }

  quickPrompt(fullPrompt: string, lang = 'it') {
    this.userInput.set(fullPrompt);
    this.syncMobileInput(fullPrompt);
    this.pendingLang = lang;
    this.sendMessage(fullPrompt);
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

  /** Called from mobile bottom bar via bridge service */
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
    this.bridge.isLoading.set(true);

    this.scrollToBottom();

    const history = this.messages()
      .filter((m) => !m.isStreaming && m.content.trim().length > 0)
      .slice(-20)
      .map((m) => `${m.role}: ${m.content}`);

    const assistantId = crypto.randomUUID();
    const emptyRich: RichContent = {
      images: [],
      links: [],
      map_links: [],
      tables: [],
      sources: [],
      item_categories: [],
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
                  item_categories: data.item_categories ?? m.richContent?.item_categories ?? [],
                },
                isStreaming: !chunk.done,
              };
            }),
          );
          this.scrollToBottom();
        },
        error: (err: Error) => {
          this.messages.update((msgs) =>
            msgs.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: err?.message || 'Something went wrong. Please try again.',
                    isStreaming: false,
                    isError: true,
                  }
                : m,
            ),
          );
          this.isLoading.set(false);
          this.bridge.isLoading.set(false);
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

          const suggestions = this.computeSuggestions(question);
          if (suggestions.length) {
            this.messages.update((msgs) =>
              msgs.map((m) =>
                m.id === assistantId ? { ...m, suggestions } : m,
              ),
            );
            this.lastCompletedSummary.update(
              (prev) =>
                prev + ` ${suggestions.length} suggerimenti di follow-up disponibili.`,
            );
          }

          this.isLoading.set(false);
          this.bridge.isLoading.set(false);
          this.scrollToBottom();
        },
      });
  }

  retryExplore(): void {
    this.exploreService.retry();
  }

  retryLastMessage(): void {
    if (this.isLoading()) return;

    const msgs = this.messages();
    const errorIndex = msgs.findLastIndex((m: ChatMessage) => m.isError);
    if (errorIndex === -1) return;

    const userIndex = errorIndex - 1;
    if (userIndex < 0 || msgs[userIndex].role !== 'user') return;

    const question = msgs[userIndex].content;
    const lang = msgs[userIndex].lang;

    this.messages.update((all) => all.filter((_, i) => i !== errorIndex && i !== userIndex));

    this.pendingLang = lang;
    this.sendMessage(question);
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
    sourceEl.classList.add('citation-target-active');
    setTimeout(() => sourceEl.classList.remove('citation-target-active'), 1500);
  }

  private static resolveCategory(name: string, richContent?: RichContent): SavedItemCategory {
    const entry = richContent?.item_categories?.find(
      (e) => e.name.toLowerCase() === name.toLowerCase(),
    );
    if (entry) return entry.category as SavedItemCategory;

    const lower = name.toLowerCase();
    if (/ristorante|osteria|trattoria|bar|café|cafe|pizzeria|locanda/.test(lower)) return 'RESTAURANT';
    if (/museo|galleria|pinacoteca|fondazione|mostra/.test(lower)) return 'MUSEUM';
    if (/festival|evento|sagra|fiera|concerto|mercato/.test(lower)) return 'EVENT';
    if (/cantina|vino|viticolt|enoteca|winery|vigna|friulano|collio|ribolla/.test(lower)) return 'WINE';
    if (/tour|escursione|trekking|esperienza|attività|degustazione|crociera/.test(lower)) return 'EXPERIENCE';
    return 'PLACE';
  }

  getItemCategory(name: string, richContent?: RichContent): SavedItemCategory {
    return ChatbotComponent.resolveCategory(name, richContent);
  }

  isItemSaved(name: string, category: SavedItemCategory): boolean {
    return this.savedItemsService.isSaved(name, this.regionService.selectedRegion().id, category);
  }

  toggleBookmark(event: Event, type: 'image' | 'link' | 'map', name: string, imageOrUrl: string, mapsUrl: string, website: string, richContent?: RichContent) {
    const region = this.regionService.selectedRegion().id;
    const category = ChatbotComponent.resolveCategory(name, richContent);
    const saved = this.savedItemsService.isSaved(name, region, category);
    const itemData = {
      name, category, region, description: name,
      imageUrl: type === 'image' ? imageOrUrl : undefined,
      mapsUrl: type === 'map' ? mapsUrl : undefined,
      website: type === 'link' ? website : undefined,
    };

    const btn = (event.currentTarget as HTMLElement);
    btn.classList.remove('bookmark-pop');
    void btn.offsetWidth;
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

    if (!bestCategory || bestScore < 2) {
      bestCategory = categories[Math.floor(Math.random() * categories.length)];
    }

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
    this.bridge.userInput.set(text);
  }

  private scrollToBottom() {
    this.bridge.suppressNavAutoHide();
    setTimeout(() => {
      const el = this.scrollContainer()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }
}
