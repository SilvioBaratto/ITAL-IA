import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  viewChild,
  ElementRef,
} from '@angular/core';
import { LucideArrowUp } from '@lucide/angular';

/**
 * Chat input — Gemini-style pill, identical on mobile and desktop (shared by
 * the desktop chatbot and the mobile bottom tab bar). The textarea and send
 * button sit inline (items-end) inside a single rounded pill, so the send
 * stays pinned bottom-right as the text grows. The textarea auto-grows up to a
 * ~168px cap (Gemini's 7-line max), then scrolls internally.
 *
 * Structure ported from the project-initializer template (the more stable
 * reference); colours come straight from this app's design tokens — the
 * `surface-inset` / `border` / `primary` / `text` tokens swap automatically
 * under the global `.dark` theme.
 */
@Component({
  selector: 'app-chat-input',
  imports: [LucideArrowUp],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <form
      (submit)="$event.preventDefault()"
      aria-label="Send a message"
      class="flex items-end gap-2 rounded-[26px] border border-border bg-surface-inset px-2 py-1.5 shadow-sm transition-colors focus-within:border-primary/40 focus-within:shadow"
    >
      <textarea
        aria-label="Chat message"
        class="flex-1 resize-none border-0 bg-transparent px-3 py-1.5 text-[15px]/6 text-text placeholder:text-text-secondary/60
               [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
               focus:outline-none focus:ring-0"
        rows="1"
        placeholder="Ask me anything about Italy..."
        [value]="userInput()"
        (input)="onInputChange($event)"
        (keydown.enter)="onKeydown($any($event))"
        [disabled]="isLoading()"
        #inputEl
      ></textarea>
      <button
        type="button"
        aria-label="Send message"
        (click)="onSend()"
        [disabled]="isLoading() || !userInput().trim()"
        class="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
      >
        <svg lucideArrowUp class="w-5 h-5" strokeWidth="2" aria-hidden="true"></svg>
      </button>
    </form>
  `,
})
export class ChatInputComponent {
  readonly userInput = input<string>('');
  readonly isLoading = input<boolean>(false);

  readonly send = output<string>();
  readonly inputChange = output<string>();

  private readonly inputEl = viewChild<ElementRef<HTMLTextAreaElement>>('inputEl');

  onInputChange(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    this.inputChange.emit(textarea.value);

    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 168) + 'px';
  }

  onKeydown(event: KeyboardEvent) {
    if (!event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.onSend();
    }
  }

  onSend() {
    const text = this.userInput().trim();
    if (!text || this.isLoading()) return;
    this.send.emit(text);

    const textarea = this.inputEl()?.nativeElement;
    if (textarea) textarea.style.height = 'auto';
  }

  focus() {
    this.inputEl()?.nativeElement.focus();
  }
}
