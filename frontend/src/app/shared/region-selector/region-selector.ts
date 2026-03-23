import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  ElementRef,
  viewChild,
} from '@angular/core';
import { RegionService } from '../../services/region.service';
import { Region, RegionGroup } from '../../models/region.model';

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
  selector: 'app-region-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'hidden md:block relative',
  },
  template: `
    <!-- Trigger -->
    <button
      type="button"
      #triggerBtn
      (click)="toggle()"
      aria-haspopup="listbox"
      [attr.aria-expanded]="isOpen()"
      class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary
             hover:text-text hover:bg-surface-inset rounded-md transition-colors">
      <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"
        stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
      </svg>
      <span class="truncate flex-1 text-left">{{ selectedRegion().name }}</span>
      <svg
        class="w-3 h-3 shrink-0 transition-transform motion-reduce:transition-none"
        [class.rotate-180]="isOpen()"
        fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
      </svg>
    </button>

    @if (isOpen()) {
      <!-- Backdrop -->
      <div class="fixed inset-0 z-40" aria-hidden="true" (click)="close()"></div>

      <!-- Dropdown -->
      <div
        class="absolute left-2 right-2 z-50 mt-1 bg-surface-raised border border-border
               rounded-lg shadow-lg overflow-hidden animate-fade-in-up">

        <!-- Search (combobox) -->
        <div class="p-2 border-b border-border-muted">
          <input
            #searchInput
            type="text"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded="true"
            aria-controls="region-listbox"
            [attr.aria-activedescendant]="activeDescendantId()"
            placeholder="Cerca regione..."
            [value]="searchQuery()"
            (input)="onSearchInput($event)"
            (keydown)="onKeydown($event)"
            class="w-full px-2.5 py-1.5 text-sm bg-surface-inset border border-border-muted
                   rounded-md text-text placeholder:text-text-tertiary
                   focus:outline-none focus:border-primary"
            aria-label="Cerca regione"
            autocomplete="off" />
        </div>

        <!-- Regions list -->
        <div id="region-listbox" role="listbox" aria-label="Regioni italiane"
          class="max-h-64 overflow-y-auto overscroll-contain py-1">
          @for (group of filteredGroups(); track group.key) {
            <div role="group" [attr.aria-labelledby]="'group-' + group.key">
              <div class="px-3 pt-2.5 pb-1" role="presentation">
                <span [id]="'group-' + group.key"
                  class="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  {{ group.label }}
                </span>
              </div>
              @for (region of group.regions; track region.id) {
                <button
                  type="button"
                  role="option"
                  tabindex="-1"
                  [id]="'region-' + region.id"
                  [attr.aria-selected]="region.id === selectedRegion().id"
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md
                         transition-colors hover:bg-surface-inset cursor-pointer"
                  [class.bg-primary-light]="region.id === selectedRegion().id"
                  [class.ring-1]="flatIndex(region) === activeIndex()"
                  [class.ring-primary]="flatIndex(region) === activeIndex()"
                  (click)="selectRegion(region)"
                  (pointerenter)="activeIndex.set(flatIndex(region))">
                  <span
                    class="flex-1 text-left"
                    [class.text-primary]="region.id === selectedRegion().id"
                    [class.font-medium]="region.id === selectedRegion().id"
                    [class.text-text]="region.id !== selectedRegion().id">
                    {{ region.name }}
                  </span>
                  @if (!region.hasKB) {
                    <span class="text-[11px] text-text-tertiary italic whitespace-nowrap">
                      (coming soon)
                    </span>
                  }
                  @if (region.id === selectedRegion().id) {
                    <svg class="w-3.5 h-3.5 text-primary shrink-0" fill="none"
                      stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round"
                        d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  }
                </button>
              }
            </div>
          }
          @if (flatFilteredRegions().length === 0) {
            <div class="px-3 py-4 text-sm text-text-tertiary text-center">
              Nessuna regione trovata
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class RegionSelectorComponent {
  private readonly regionService = inject(RegionService);
  private readonly searchInputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly triggerBtnRef = viewChild<ElementRef<HTMLButtonElement>>('triggerBtn');

  readonly isOpen = signal(false);
  readonly searchQuery = signal('');
  readonly activeIndex = signal(-1);

  readonly selectedRegion = this.regionService.selectedRegion;

  readonly filteredGroups = computed<RegionGroupDisplay[]>(() => {
    const query = this.searchQuery().toLowerCase();
    const allRegions = this.regionService.regions();

    return GROUP_ORDER
      .map(key => ({
        key,
        label: GROUP_LABELS[key],
        regions: allRegions.filter(
          r => r.group === key && (!query || r.name.toLowerCase().includes(query)),
        ),
      }))
      .filter(g => g.regions.length > 0);
  });

  readonly flatFilteredRegions = computed(() =>
    this.filteredGroups().flatMap(g => g.regions),
  );

  readonly activeDescendantId = computed(() => {
    const idx = this.activeIndex();
    const regions = this.flatFilteredRegions();
    return idx >= 0 && idx < regions.length
      ? 'region-' + regions[idx].id
      : null;
  });

  toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.isOpen.set(true);
      this.searchQuery.set('');
      this.activeIndex.set(-1);
      setTimeout(() => this.searchInputRef()?.nativeElement.focus());
    }
  }

  close(): void {
    this.isOpen.set(false);
    this.searchQuery.set('');
    this.activeIndex.set(-1);
    this.triggerBtnRef()?.nativeElement.focus();
  }

  selectRegion(region: Region): void {
    this.regionService.selectRegion(region.id);
    this.close();
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.activeIndex.set(-1);
  }

  flatIndex(region: Region): number {
    return this.flatFilteredRegions().indexOf(region);
  }

  onKeydown(event: KeyboardEvent): void {
    const regions = this.flatFilteredRegions();
    const len = regions.length;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (len > 0) {
          this.activeIndex.update(i => (i + 1) % len);
          this.scrollActiveIntoView();
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (len > 0) {
          this.activeIndex.update(i => (i <= 0 ? len - 1 : i - 1));
          this.scrollActiveIntoView();
        }
        break;

      case 'Home':
        event.preventDefault();
        if (len > 0) {
          this.activeIndex.set(0);
          this.scrollActiveIntoView();
        }
        break;

      case 'End':
        event.preventDefault();
        if (len > 0) {
          this.activeIndex.set(len - 1);
          this.scrollActiveIntoView();
        }
        break;

      case 'Enter':
        event.preventDefault();
        const idx = this.activeIndex();
        if (idx >= 0 && idx < len) {
          this.selectRegion(regions[idx]);
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.close();
        break;

      case 'Tab':
        event.preventDefault();
        break;
    }
  }

  private scrollActiveIntoView(): void {
    const regions = this.flatFilteredRegions();
    const idx = this.activeIndex();
    if (idx >= 0 && idx < regions.length) {
      queueMicrotask(() => {
        document
          .getElementById('region-' + regions[idx].id)
          ?.scrollIntoView({ block: 'nearest' });
      });
    }
  }
}
