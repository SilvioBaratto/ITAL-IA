import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  signal,
  computed,
  viewChild,
  ElementRef,
  effect,
  DestroyRef,
} from '@angular/core';
import { RegionService } from '../../services/region.service';
import { Region, RegionGroup } from '../../models/region.model';
import { LucideX, LucideCheck } from '@lucide/angular';

interface RegionGroupDisplay {
  key: RegionGroup;
  label: string;
  regions: Region[];
}

const GROUP_ORDER: RegionGroup[] = ['nord', 'centro', 'sud', 'isole'];
const GROUP_LABELS: Record<RegionGroup, string> = {
  nord: 'Nord',
  centro: 'Centro',
  sud: 'Sud',
  isole: 'Isole',
};

@Component({
  selector: 'app-region-bottom-sheet',
  imports: [LucideX, LucideCheck],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
  template: `
    @if (isOpen()) {
      <!-- Backdrop -->
      <div
        class="fixed inset-0 z-50 bg-black/30 transition-opacity motion-reduce:transition-none"
        [class.animate-fade-in]="isOpen()"
        (click)="close()"
        aria-hidden="true"
      ></div>

      <!-- Sheet -->
      <div
        #sheetEl
        class="fixed inset-x-0 bottom-0 z-50 bg-surface-raised rounded-t-2xl shadow-2xl max-h-[70dvh] flex flex-col animate-slide-up motion-reduce:animate-none"
        role="dialog"
        aria-modal="true"
        aria-label="Select a region"
        (keydown)="onSheetKeydown($event)"
        (touchstart)="onTouchStart($event)"
        (touchmove)="onTouchMove($event)"
        (touchend)="onTouchEnd()"
      >
        <!-- Handle -->
        <div class="flex justify-center pt-3 pb-1">
          <div class="w-10 h-1 rounded-full bg-border"></div>
        </div>

        <!-- Header -->
        <div class="flex items-center justify-between px-4 pb-2">
          <h2 class="text-base font-display font-bold text-text">Select Region</h2>
          <button
            #closeBtn
            type="button"
            (click)="close()"
            class="flex items-center justify-center min-h-11 min-w-11 -mr-2 rounded-full text-text-secondary hover:text-text hover:bg-surface-inset transition-colors"
            aria-label="Close region selector"
          >
            <svg lucideX class="w-5 h-5" aria-hidden="true"></svg>
          </button>
        </div>

        <!-- Search -->
        <div class="px-4 pb-3">
          <input
            #searchInput
            type="text"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded="true"
            aria-controls="sheet-region-listbox"
            [attr.aria-activedescendant]="activeDescendantId()"
            placeholder="Cerca regione..."
            [value]="searchQuery()"
            (input)="onSearchInput($event)"
            (keydown)="onKeydown($event)"
            class="w-full px-3 py-2.5 text-sm bg-surface-inset border border-border-muted rounded-xl text-text placeholder:text-text-tertiary focus:outline-none focus:border-primary"
            aria-label="Cerca regione"
            autocomplete="off"
          />
        </div>

        <!-- Regions list -->
        <div
          id="sheet-region-listbox"
          role="listbox"
          aria-label="Regioni italiane"
          class="flex-1 overflow-y-auto overscroll-contain px-2 pb-safe"
        >
          @for (group of filteredGroups(); track group.key) {
            <div role="group" [attr.aria-labelledby]="'sheet-group-' + group.key">
              <div class="px-2 pt-3 pb-1" role="presentation">
                <span
                  [id]="'sheet-group-' + group.key"
                  class="text-xs font-semibold uppercase tracking-wider text-text-secondary"
                >
                  {{ group.label }}
                </span>
              </div>
              @for (region of group.regions; track region.id) {
                <button
                  type="button"
                  role="option"
                  tabindex="-1"
                  [id]="'sheet-region-' + region.id"
                  [attr.aria-selected]="region.id === selectedRegion().id"
                  class="w-full flex items-center gap-2.5 px-3 py-3 text-sm rounded-xl transition-colors active:bg-surface-inset min-h-11"
                  [class.bg-primary-light]="region.id === selectedRegion().id"
                  [class.ring-1]="flatIndex(region) === activeIndex()"
                  [class.ring-primary]="flatIndex(region) === activeIndex()"
                  (click)="selectRegion(region)"
                >
                  <span
                    class="flex-1 text-left"
                    [class.text-primary]="region.id === selectedRegion().id"
                    [class.font-medium]="region.id === selectedRegion().id"
                    [class.text-text]="region.id !== selectedRegion().id"
                  >
                    {{ region.name }}
                  </span>
                  @if (!region.hasKB) {
                    <span class="text-[11px] text-text-tertiary italic whitespace-nowrap">
                      (coming soon)
                    </span>
                  }
                  @if (region.id === selectedRegion().id) {
                    <svg
                      lucideCheck
                      class="w-4 h-4 text-primary shrink-0"
                      strokeWidth="2"
                      aria-hidden="true"
                    ></svg>
                  }
                </button>
              }
            </div>
          }
          @if (flatFilteredRegions().length === 0) {
            <div class="px-3 py-6 text-sm text-text-tertiary text-center">
              Nessuna regione trovata
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: `
    @media (prefers-reduced-motion: no-preference) {
      .animate-fade-in {
        animation: fade-in 0.2s ease-out both;
      }
      .animate-slide-up {
        animation: slide-up 0.3s cubic-bezier(0.32, 0.72, 0, 1) both;
      }

      @keyframes fade-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes slide-up {
        from {
          transform: translateY(100%);
        }
        to {
          transform: translateY(0);
        }
      }
    }
  `,
})
export class RegionBottomSheetComponent {
  private readonly regionService = inject(RegionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchInputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly sheetElRef = viewChild<ElementRef<HTMLElement>>('sheetEl');
  private readonly closeBtnRef = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');

  readonly isOpen = input<boolean>(false);
  readonly closed = output<void>();
  readonly regionSelected = output<string>();

  readonly searchQuery = signal('');
  readonly activeIndex = signal(-1);

  readonly selectedRegion = this.regionService.selectedRegion;

  private touchStartY = 0;
  private touchDeltaY = 0;
  private previousOverflow = '';

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.searchQuery.set('');
        this.activeIndex.set(-1);
        this.lockScroll();
        setTimeout(() => this.searchInputRef()?.nativeElement.focus(), 100);
      } else {
        this.unlockScroll();
      }
    });

    this.destroyRef.onDestroy(() => {
      this.unlockScroll();
    });
  }

  readonly filteredGroups = computed<RegionGroupDisplay[]>(() => {
    const query = this.searchQuery().toLowerCase();
    const allRegions = this.regionService.regions();

    return GROUP_ORDER.map((key) => ({
      key,
      label: GROUP_LABELS[key],
      regions: allRegions.filter(
        (r) => r.group === key && (!query || r.name.toLowerCase().includes(query)),
      ),
    })).filter((g) => g.regions.length > 0);
  });

  readonly flatFilteredRegions = computed(() => this.filteredGroups().flatMap((g) => g.regions));

  readonly activeDescendantId = computed(() => {
    const idx = this.activeIndex();
    const regions = this.flatFilteredRegions();
    return idx >= 0 && idx < regions.length ? 'sheet-region-' + regions[idx].id : null;
  });

  close() {
    this.closed.emit();
  }

  onEscape() {
    if (this.isOpen()) this.close();
  }

  selectRegion(region: Region) {
    this.regionService.selectRegion(region.id);
    this.regionSelected.emit(region.id);
    this.close();
  }

  onSearchInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.activeIndex.set(-1);
  }

  flatIndex(region: Region): number {
    return this.flatFilteredRegions().indexOf(region);
  }

  onKeydown(event: KeyboardEvent) {
    const regions = this.flatFilteredRegions();
    const len = regions.length;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (len > 0) {
          this.activeIndex.update((i) => (i + 1) % len);
          this.scrollActiveIntoView();
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (len > 0) {
          this.activeIndex.update((i) => (i <= 0 ? len - 1 : i - 1));
          this.scrollActiveIntoView();
        }
        break;
      case 'Enter':
        event.preventDefault();
        const idx = this.activeIndex();
        if (idx >= 0 && idx < len) this.selectRegion(regions[idx]);
        break;
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
    }
  }

  /** Focus trap — keep Tab/Shift+Tab inside the sheet */
  onSheetKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;

    const sheetEl = this.sheetElRef()?.nativeElement;
    if (!sheetEl) return;

    const focusable = sheetEl.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  onTouchStart(event: TouchEvent) {
    this.touchStartY = event.touches[0].clientY;
    this.touchDeltaY = 0;
  }

  onTouchMove(event: TouchEvent) {
    this.touchDeltaY = event.touches[0].clientY - this.touchStartY;
  }

  onTouchEnd() {
    if (this.touchDeltaY > 80) {
      this.close();
    }
  }

  private scrollActiveIntoView() {
    const regions = this.flatFilteredRegions();
    const idx = this.activeIndex();
    if (idx >= 0 && idx < regions.length) {
      queueMicrotask(() => {
        document
          .getElementById('sheet-region-' + regions[idx].id)
          ?.scrollIntoView({ block: 'nearest' });
      });
    }
  }

  private lockScroll() {
    if (typeof document !== 'undefined') {
      this.previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
  }

  private unlockScroll() {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = this.previousOverflow;
    }
  }
}
