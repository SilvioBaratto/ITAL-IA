import {
  Component,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
  ElementRef,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-inline-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (editing()) {
      @if (type() === 'textarea') {
        <textarea
          #inputEl
          class="inline-edit-input inline-edit-textarea"
          [value]="value()"
          (blur)="save($event)"
          (keydown.enter)="$event.preventDefault(); save($event)"
          (keydown.escape)="cancel()"
        ></textarea>
      } @else {
        <input
          #inputEl
          class="inline-edit-input"
          [type]="type() === 'time' ? 'time' : 'text'"
          [value]="value()"
          (blur)="save($event)"
          (keydown.enter)="save($event)"
          (keydown.escape)="cancel()"
        />
      }
    } @else {
      <span
        class="inline-edit-display"
        [class.inline-edit-placeholder]="!value()"
        (click)="startEdit()"
        tabindex="0"
        (keydown.enter)="startEdit()"
        role="button"
        [attr.aria-label]="'Edit ' + (value() || placeholder())"
      >
        {{ value() || placeholder() }}
        <svg class="inline-edit-pencil" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
        </svg>
      </span>
    }
  `,
  styles: [`
    :host { display: inline; }
    .inline-edit-display {
      cursor: pointer;
      border-radius: 4px;
      padding: 0 2px;
      transition: background-color 0.15s;
      position: relative;
    }
    .inline-edit-display:hover {
      background: var(--color-primary-light, #fef3c7);
    }
    .inline-edit-pencil {
      width: 12px;
      height: 12px;
      display: none;
      vertical-align: middle;
      margin-left: 2px;
      color: var(--color-text-tertiary, #9ca3af);
    }
    .inline-edit-display:hover .inline-edit-pencil {
      display: inline;
    }
    .inline-edit-placeholder {
      color: var(--color-text-tertiary, #9ca3af);
      font-style: italic;
    }
    .inline-edit-input {
      font: inherit;
      color: inherit;
      background: var(--color-surface-raised, #fff);
      border: 1px solid var(--color-primary, #c45d3e);
      border-radius: 4px;
      padding: 1px 4px;
      outline: none;
      width: 100%;
      box-sizing: border-box;
    }
    .inline-edit-textarea {
      resize: vertical;
      min-height: 2.5em;
    }
  `],
})
export class InlineEditComponent {
  value = input.required<string>();
  type = input<'text' | 'time' | 'textarea'>('text');
  placeholder = input('Click to edit');
  saved = output<string>();

  editing = signal(false);
  private readonly inputEl = viewChild<ElementRef<HTMLInputElement | HTMLTextAreaElement>>('inputEl');

  startEdit() {
    this.editing.set(true);
    setTimeout(() => {
      this.inputEl()?.nativeElement.focus();
      this.inputEl()?.nativeElement.select();
    });
  }

  save(event: Event) {
    const el = event.target as HTMLInputElement | HTMLTextAreaElement;
    const newValue = el.value.trim();
    this.editing.set(false);
    if (newValue !== this.value()) {
      this.saved.emit(newValue);
    }
  }

  cancel() {
    this.editing.set(false);
  }
}
