import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  viewChild,
  ElementRef,
} from '@angular/core';

@Component({
  selector: 'app-chat-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <form (submit)="$event.preventDefault()" aria-label="Send a message" class="flex items-end gap-3">
      <textarea
        aria-label="Chat message"
        class="flex-1 resize-none rounded-xl border-none bg-surface-raised shadow-sm px-4 py-3 min-h-[44px] text-sm text-text placeholder:text-text-secondary/60 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors"
        rows="1"
        placeholder="Ask me anything about Italy..."
        [value]="userInput()"
        (input)="onInputChange($event)"
        (keydown.enter)="onKeydown($any($event))"
        [disabled]="isLoading()"
        #inputEl></textarea>
      <button
        type="button"
        aria-label="Send message"
        (click)="onSend()"
        [disabled]="isLoading() || !userInput().trim()"
        class="shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
        </svg>
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
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
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
