import {
  Component,
  signal,
  inject,
  viewChild,
  ElementRef,
  DestroyRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChatService } from '../../services/chat.service';
import { ChatMessage, RichContent } from '../../models/chat.model';
import { MarkdownPipe } from '../../shared/pipes/markdown.pipe';

@Component({
  selector: 'app-chatbot',
  imports: [MarkdownPipe],
  templateUrl: './chatbot.html',
  styleUrl: './chatbot.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'flex:1; display:flex; flex-direction:column; min-height:0' },
})
export class ChatbotComponent {
  private readonly chatService = inject(ChatService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private readonly inputEl = viewChild<ElementRef<HTMLTextAreaElement>>('inputEl');

  messages = signal<ChatMessage[]>([]);
  isLoading = signal(false);
  userInput = signal('');

  quickPrompt(text: string) {
    this.userInput.set(text);
    this.onSend();
  }

  onInputChange(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    this.userInput.set(textarea.value);

    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  onKeydown(event: KeyboardEvent) {
    if (!event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.onSend();
    }
  }

  onSend() {
    const question = this.userInput().trim();
    if (!question || this.isLoading()) return;

    this.messages.update((msgs) => [
      ...msgs,
      { id: crypto.randomUUID(), role: 'user', content: question },
    ]);
    this.userInput.set('');
    this.isLoading.set(true);
    this.scrollToBottom();

    const textarea = this.inputEl()?.nativeElement;
    if (textarea) textarea.style.height = 'auto';

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

    this.chatService
      .streamMessage(question, history)
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
          this.scrollToBottom();
        },
        complete: () => {
          this.isLoading.set(false);
          this.scrollToBottom();
        },
      });
  }

  onImageError(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  private scrollToBottom() {
    setTimeout(() => {
      const el = this.scrollContainer()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }
}
