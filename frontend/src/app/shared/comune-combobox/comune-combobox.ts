import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  effect,
  ElementRef,
  viewChild,
} from '@angular/core';
import { Comune } from '../../models/comune.model';
import { LucideSearch, LucideX, LucideMapPin } from '@lucide/angular';

/// Cap shown while the user is typing — we want the top N matches
/// visible without requiring a scroll. When the input is empty we show
/// the whole comuni list (capped only by `max-h-80 overflow-y-auto` on
/// the dropdown element itself) so the user can mouse-wheel through
/// every comune in the region.
const MAX_SEARCH_RESULTS = 20;

/** Strip diacritics + lowercase for accent-insensitive matching. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Fuzzy score: prefix > word-start > substring > no match.
 * Higher score = better match. 0 means no match.
 */
function scoreComune(query: string, name: string): number {
  const q = normalize(query);
  const n = normalize(name);
  if (!q) return 0;
  if (n.startsWith(q)) return 3; // "trieste" → "Trieste"
  if (n.includes(' ' + q)) return 2; // "daniele" → "San Daniele"
  if (n.includes(q)) return 1; // fallback substring
  return 0;
}

@Component({
  selector: 'app-comune-combobox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideSearch, LucideX, LucideMapPin],
  host: {
    class: 'relative block',
  },
  template: `
    <!-- Input -->
    <div
      class="relative flex items-center gap-2 bg-surface-raised border rounded-full
             px-3 h-9 transition-colors motion-reduce:transition-none"
      [class]="
        selected()
          ? 'border-primary text-text'
          : isOpen()
            ? 'border-primary/50 text-text'
            : 'border-border text-text-secondary'
      "
    >
      <svg
        lucideSearch
        class="w-3.5 h-3.5 shrink-0"
        strokeWidth="2"
        aria-hidden="true"
      ></svg>
      <input
        #inputEl
        type="text"
        role="combobox"
        [attr.aria-expanded]="isOpen()"
        aria-autocomplete="list"
        aria-controls="comune-combobox-listbox"
        [attr.aria-activedescendant]="
          isOpen() && results().length > 0
            ? 'comune-option-' + highlightedIndex()
            : null
        "
        [value]="displayValue()"
        (input)="onInput($any($event.target).value)"
        (focus)="onFocus()"
        (blur)="onBlur()"
        (keydown)="onKeyDown($event)"
        [placeholder]="placeholder()"
        class="flex-1 min-w-0 bg-transparent text-xs outline-none placeholder:text-text-tertiary"
      />
      @if (selected() || query()) {
        <button
          type="button"
          (mousedown)="$event.preventDefault()"
          (click)="clear()"
          class="shrink-0 w-5 h-5 flex items-center justify-center rounded-full
                 text-text-tertiary hover:text-text hover:bg-surface-inset"
          aria-label="Cancella filtro comune"
        >
          <svg
            lucideX
            class="w-3 h-3"
            strokeWidth="2.5"
            aria-hidden="true"
          ></svg>
        </button>
      }
    </div>

    <!-- Dropdown -->
    @if (isOpen() && (results().length > 0 || crossRegionHint())) {
      <ul
        id="comune-combobox-listbox"
        role="listbox"
        class="absolute left-0 right-0 z-50 mt-1 bg-surface-raised border border-border rounded-xl
               shadow-lg overflow-hidden max-h-80 overflow-y-auto min-w-52"
      >
        @for (c of results(); track c.id; let i = $index) {
          <li
            [id]="'comune-option-' + i"
            role="option"
            [attr.aria-selected]="i === highlightedIndex()"
            (mousedown)="$event.preventDefault()"
            (click)="select(c)"
            (mouseenter)="highlightedIndex.set(i)"
            class="px-3 py-2 text-xs cursor-pointer flex items-center justify-between gap-3"
            [class]="
              i === highlightedIndex()
                ? 'bg-primary/10 text-text'
                : 'text-text-secondary hover:bg-surface-inset'
            "
          >
            <span class="truncate font-medium">{{ c.name }}</span>
            <span
              class="shrink-0 font-mono text-[10px] text-text-tertiary uppercase tracking-wider"
            >
              {{ c.province }}
            </span>
          </li>
        }

        @if (results().length === 0 && query()) {
          <li
            class="px-3 py-2 text-xs text-text-tertiary italic"
            role="option"
            aria-disabled="true"
          >
            Nessun comune trovato
          </li>
        }

        @if (crossRegionHint(); as hint) {
          <li
            role="option"
            (mousedown)="$event.preventDefault()"
            (click)="crossRegionNavigate.emit(hint)"
            class="px-3 py-2 text-xs cursor-pointer border-t border-border/60
                   bg-accent/5 hover:bg-accent/10 flex items-center gap-2"
          >
            <svg
              lucideMapPin
              class="w-3 h-3 shrink-0 text-accent"
              strokeWidth="2"
              aria-hidden="true"
            ></svg>
            <span class="text-text-secondary">
              Ti trovi a <strong class="text-text">{{ hint.name }}</strong>
              ({{ hint.province }}) —
              <span class="text-primary font-medium">vai alla regione</span>
            </span>
          </li>
        }
      </ul>
    }
  `,
})
export class ComuneComboboxComponent {
  readonly comuni = input.required<Comune[]>();
  readonly selected = input<Comune | null>(null);
  readonly placeholder = input<string>('Cerca comune…');
  /** When set, shown as a footer hint in the dropdown (user is outside this region). */
  readonly crossRegionHint = input<Comune | null>(null);

  readonly selectedChange = output<Comune | null>();
  readonly crossRegionNavigate = output<Comune>();

  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  readonly query = signal('');
  readonly isOpen = signal(false);
  readonly highlightedIndex = signal(0);

  /// What's shown in the input. While typing, it's the query. Otherwise
  /// it's the selected comune's name (or empty).
  readonly displayValue = computed(() => {
    const q = this.query();
    if (q) return q;
    return this.selected()?.name ?? '';
  });

  readonly results = computed<Comune[]>(() => {
    const q = this.query().trim();
    const list = this.comuni();
    if (!q) {
      // Browse mode — show every comune sorted alphabetically and let
      // the dropdown's own `overflow-y-auto` handle the scroll. No cap,
      // because 216 comuni in FVG is fine and the user expects to be
      // able to scroll through the whole list when they just clicked to
      // search without typing.
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list
      .map((c) => ({ c, s: scoreComune(q, c.name) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name))
      .slice(0, MAX_SEARCH_RESULTS)
      .map((r) => r.c);
  });

  constructor() {
    // Keep highlighted index in bounds when the result list shrinks.
    effect(() => {
      const len = this.results().length;
      if (this.highlightedIndex() >= len) this.highlightedIndex.set(0);
    });
  }

  onInput(value: string): void {
    this.query.set(value);
    this.isOpen.set(true);
    this.highlightedIndex.set(0);
  }

  onFocus(): void {
    this.isOpen.set(true);
  }

  onBlur(): void {
    // Delay close so a click on a list item still fires before the
    // dropdown is gone. The mousedown handlers also call preventDefault
    // to avoid losing focus in the first place — belt and suspenders.
    setTimeout(() => this.isOpen.set(false), 150);
  }

  onKeyDown(e: KeyboardEvent): void {
    const results = this.results();

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.isOpen.set(true);
        if (results.length > 0) {
          this.highlightedIndex.update((i) => (i + 1) % results.length);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.isOpen.set(true);
        if (results.length > 0) {
          this.highlightedIndex.update(
            (i) => (i - 1 + results.length) % results.length,
          );
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (this.isOpen() && results.length > 0) {
          this.select(results[this.highlightedIndex()]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        this.isOpen.set(false);
        this.query.set('');
        this.inputEl()?.nativeElement.blur();
        break;
    }
  }

  select(comune: Comune): void {
    this.selectedChange.emit(comune);
    this.query.set('');
    this.isOpen.set(false);
    this.inputEl()?.nativeElement.blur();
  }

  clear(): void {
    this.selectedChange.emit(null);
    this.query.set('');
    this.isOpen.set(false);
  }
}
