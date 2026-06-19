import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
  viewChild,
  ElementRef,
  DestroyRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SavedItemsService } from '../../services/saved-items.service';
import { RegionService } from '../../services/region.service';
import { ToastService } from '../../services/toast.service';
import { ThemeService } from '../../services/theme.service';
import { SavedItem, SavedItemCategory, SaveItemRequest } from '../../models/saved-item.model';
import {
  LucideMapPin,
  LucideTriangleAlert,
  LucideRotateCcw,
  LucideBookmark,
  LucideMessageCircle,
  LucideChevronRight,
  LucideArrowDown,
  LucideLoader,
  LucideX,
  LucideMap,
  LucideGlobe,
  LucideSun,
  LucideMoon,
  LucideUtensils,
  LucideLandmark,
  LucideCalendar,
  LucideWine,
  LucideStar,
} from '@lucide/angular';

interface CategoryDescriptor {
  value: SavedItemCategory;
  label: string;
}

interface RegionDescriptor {
  id: string;
  name: string;
}

const CATEGORY_LABELS: Record<SavedItemCategory, string> = {
  RESTAURANT: 'Ristorante',
  MUSEUM: 'Museo',
  EVENT: 'Evento',
  PLACE: 'Luogo',
  WINE: 'Vino',
  EXPERIENCE: 'Esperienza',
};

const CATEGORY_BADGE_CLASSES: Record<SavedItemCategory, string> = {
  RESTAURANT: 'bg-primary-light text-primary',
  MUSEUM: 'bg-accent-light text-accent',
  EVENT: 'bg-gold/10 text-gold',
  PLACE: 'bg-success/10 text-success',
  WINE: 'bg-info/10 text-info',
  EXPERIENCE: 'bg-warning/10 text-warning',
};

/** Region filter value: a region id, or 'all' to show every saved region. */
type RegionFilter = string | 'all';

@Component({
  selector: 'app-saved-page',
  imports: [
    RouterLink,
    LucideMapPin,
    LucideTriangleAlert,
    LucideRotateCcw,
    LucideBookmark,
    LucideMessageCircle,
    LucideChevronRight,
    LucideArrowDown,
    LucideLoader,
    LucideX,
    LucideMap,
    LucideGlobe,
    LucideSun,
    LucideMoon,
    LucideUtensils,
    LucideLandmark,
    LucideCalendar,
    LucideWine,
    LucideStar,
  ],
  templateUrl: './saved.html',
  styleUrl: './saved.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'closeDetail()',
  },
})
export class SavedPageComponent {
  private readonly savedItemsService = inject(SavedItemsService);
  private readonly regionService = inject(RegionService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly themeService = inject(ThemeService);

  readonly loading = this.savedItemsService.loading;
  readonly loadingMore = this.savedItemsService.loadingMore;
  readonly error = this.savedItemsService.error;
  readonly hasSavedItems = this.savedItemsService.hasSavedItems;
  readonly hasMore = this.savedItemsService.hasMore;
  readonly total = this.savedItemsService.total;

  readonly selectedCategory = signal<SavedItemCategory | null>(null);
  /** Region scope: 'all' (default) or a specific region id. */
  readonly regionFilter = signal<RegionFilter>('all');

  /** Item shown in the detail dialog (centered modal on desktop, bottom sheet on mobile). */
  readonly selectedItem = signal<SavedItem | null>(null);
  /** Whether the detail dialog is open. */
  readonly detailOpen = signal(false);

  private readonly detailHeading = viewChild<ElementRef<HTMLElement>>('detailHeading');
  private readonly dialogEl = viewChild<ElementRef<HTMLElement>>('dialogEl');

  readonly skeletonItems = [0, 1, 2, 3, 4, 5] as const;

  readonly currentRegionName = computed(() => this.regionService.selectedRegion().name);

  /** Distinct categories present across all saved items. */
  readonly availableCategories = computed<CategoryDescriptor[]>(() => {
    const seen = new Set<SavedItemCategory>();
    for (const item of this.savedItemsService.savedItems()) {
      seen.add(item.category);
    }
    return Array.from(seen).map((value) => ({ value, label: CATEGORY_LABELS[value] }));
  });

  /** Distinct regions present across all saved items, resolved to display names. */
  readonly availableRegions = computed<RegionDescriptor[]>(() => {
    const seen = new Set<string>();
    for (const item of this.savedItemsService.savedItems()) {
      seen.add(item.region);
    }
    return Array.from(seen)
      .map((id) => ({ id, name: this.regionName(id) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'it'));
  });

  readonly filteredItems = computed(() => {
    const items = this.savedItemsService.savedItems();
    const category = this.selectedCategory();
    const region = this.regionFilter();

    return items.filter((item) => {
      const matchesCategory = category === null || item.category === category;
      const matchesRegion = region === 'all' || item.region === region;
      return matchesCategory && matchesRegion;
    });
  });

  /** Collection stats for the header strip (based on the whole collection, not the filter). */
  readonly statCategories = computed(() => this.availableCategories().length);
  readonly statRegions = computed(() => this.availableRegions().length);

  private previousBodyOverflow = '';
  private touchStartY = 0;
  private touchDeltaY = 0;

  constructor() {
    this.destroyRef.onDestroy(() => this.unlockBodyScroll());
  }

  /** Map a region id (slug) to its display name, falling back to the id. */
  regionName(id: string): string {
    return this.regionService.regions().find((r) => r.id === id)?.name ?? id;
  }

  selectCategory(category: SavedItemCategory | null): void {
    this.selectedCategory.set(category);
  }

  selectRegion(region: RegionFilter): void {
    this.regionFilter.set(region);
  }

  /** Opens the detail dialog for the given item (modal on desktop, sheet on mobile). */
  openDetail(item: SavedItem): void {
    this.selectedItem.set(item);
    this.detailOpen.set(true);
    this.lockBodyScroll();
    setTimeout(() => this.detailHeading()?.nativeElement.focus(), 0);
  }

  closeDetail(): void {
    if (!this.detailOpen()) return;
    this.detailOpen.set(false);
    this.selectedItem.set(null);
    this.unlockBodyScroll();
  }

  onSheetTouchStart(event: TouchEvent): void {
    this.touchStartY = event.touches[0].clientY;
    this.touchDeltaY = 0;
  }

  onSheetTouchMove(event: TouchEvent): void {
    this.touchDeltaY = event.touches[0].clientY - this.touchStartY;
  }

  onSheetTouchEnd(): void {
    if (this.touchDeltaY > 80) {
      this.closeDetail();
    }
  }

  /** Focus trap — keep Tab / Shift+Tab inside the dialog. */
  onDialogKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;

    const el = this.dialogEl()?.nativeElement;
    if (!el) return;

    const focusable = el.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
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

  retryLoad(): void {
    const region = this.regionService.selectedRegion();
    this.savedItemsService.loadSavedItems(region.id).subscribe({
      error: () => {
        // error state is managed by the service
      },
    });
  }

  loadMore(): void {
    const region = this.regionFilter() === 'all' ? undefined : this.regionFilter();
    const category = this.selectedCategory() ?? undefined;
    this.savedItemsService.loadMore(region, category).subscribe({
      error: () => {
        // loadingMore is reset in the service catchError
      },
    });
  }

  removeItem(item: SavedItem): void {
    const request: SaveItemRequest = {
      name: item.name,
      category: item.category,
      region: item.region,
      description: item.description,
      address: item.address ?? undefined,
      mapsUrl: item.mapsUrl ?? undefined,
      website: item.website ?? undefined,
      imageUrl: item.imageUrl ?? undefined,
    };

    if (this.selectedItem()?.id === item.id) {
      this.closeDetail();
    }

    this.savedItemsService.unsave(item.name, item.region, item.category).subscribe();

    this.toastService.show(`"${item.name}" rimosso dai salvati`, () => {
      this.savedItemsService.save(request).subscribe();
    });
  }

  getCategoryLabel(category: SavedItemCategory): string {
    return CATEGORY_LABELS[category];
  }

  getCategoryBadgeClass(category: SavedItemCategory): string {
    return CATEGORY_BADGE_CLASSES[category];
  }

  private lockBodyScroll(): void {
    this.previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  private unlockBodyScroll(): void {
    document.body.style.overflow = this.previousBodyOverflow;
  }
}
