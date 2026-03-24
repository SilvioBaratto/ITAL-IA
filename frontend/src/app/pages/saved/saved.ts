import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
  viewChild,
  ElementRef,
  afterNextRender,
  DestroyRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SavedItemsService } from '../../services/saved-items.service';
import { RegionService } from '../../services/region.service';
import { ToastService } from '../../services/toast.service';
import { SavedItem, SavedItemCategory, SaveItemRequest } from '../../models/saved-item.model';

interface CategoryDescriptor {
  value: SavedItemCategory;
  label: string;
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

@Component({
  selector: 'app-saved-page',
  imports: [RouterLink],
  templateUrl: './saved.html',
  styleUrl: './saved.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'closeMobileSheet()',
  },
})
export class SavedPageComponent {
  private readonly savedItemsService = inject(SavedItemsService);
  private readonly regionService = inject(RegionService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = this.savedItemsService.loading;
  readonly loadingMore = this.savedItemsService.loadingMore;
  readonly error = this.savedItemsService.error;
  readonly hasSavedItems = this.savedItemsService.hasSavedItems;
  readonly hasMore = this.savedItemsService.hasMore;
  readonly total = this.savedItemsService.total;

  readonly selectedCategory = signal<SavedItemCategory | null>(null);
  readonly showAllRegions = signal(false);

  /** The item currently shown in the detail pane (desktop) or mobile bottom sheet. */
  readonly selectedItem = signal<SavedItem | null>(null);

  /** Controls the mobile bottom sheet visibility. */
  readonly mobileSheetOpen = signal(false);

  private readonly detailHeading = viewChild<ElementRef<HTMLElement>>('detailHeading');
  private readonly mobileSheetEl = viewChild<ElementRef<HTMLElement>>('mobileSheetEl');

  readonly skeletonItems = [0, 1, 2] as const;

  readonly currentRegionName = computed(() => this.regionService.selectedRegion().name);

  readonly availableCategories = computed<CategoryDescriptor[]>(() => {
    const items = this.savedItemsService.savedItems();
    const seen = new Set<SavedItemCategory>();
    for (const item of items) {
      seen.add(item.category);
    }
    return Array.from(seen).map((value) => ({
      value,
      label: CATEGORY_LABELS[value],
    }));
  });

  readonly filteredItems = computed(() => {
    const items = this.savedItemsService.savedItems();
    const category = this.selectedCategory();
    const allRegions = this.showAllRegions();
    const currentRegionId = this.regionService.selectedRegion().id;

    return items.filter((item) => {
      const matchesCategory = category === null || item.category === category;
      const matchesRegion = allRegions || item.region === currentRegionId;
      return matchesCategory && matchesRegion;
    });
  });

  private previousBodyOverflow = '';
  private touchStartY = 0;
  private touchDeltaY = 0;

  constructor() {
    this.destroyRef.onDestroy(() => this.unlockBodyScroll());
  }

  selectCategory(category: SavedItemCategory | null): void {
    this.selectedCategory.set(category);
    this.selectedItem.set(null);
  }

  selectItem(item: SavedItem): void {
    this.selectedItem.set(item);
    afterNextRender(() => {
      this.detailHeading()?.nativeElement.focus();
    });
  }

  clearSelectedItem(): void {
    this.selectedItem.set(null);
  }

  /** Opens the mobile bottom sheet for the given item. */
  openMobileSheet(item: SavedItem): void {
    this.selectedItem.set(item);
    this.mobileSheetOpen.set(true);
    this.lockBodyScroll();
    afterNextRender(() => {
      this.mobileSheetEl()?.nativeElement.focus();
    });
  }

  /** Closes the mobile bottom sheet. */
  closeMobileSheet(): void {
    if (!this.mobileSheetOpen()) return;
    this.mobileSheetOpen.set(false);
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
      this.closeMobileSheet();
    }
  }

  /** Focus trap — keep Tab / Shift+Tab inside the mobile sheet. */
  onSheetKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;

    const sheetEl = this.mobileSheetEl()?.nativeElement;
    if (!sheetEl) return;

    const focusable = sheetEl.querySelectorAll<HTMLElement>(
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

  /** Move focus to adjacent list item (arrow key navigation for listbox pattern). */
  focusListItem(event: Event, direction: 1 | -1): void {
    const target = event.target as HTMLElement;
    const sibling =
      direction === 1
        ? target.nextElementSibling
        : target.previousElementSibling;
    if (sibling instanceof HTMLElement) {
      sibling.focus();
    }
  }

  toggleAllRegions(): void {
    this.showAllRegions.update((v) => !v);
    this.selectedItem.set(null);
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
    const region = this.showAllRegions() ? undefined : this.regionService.selectedRegion().id;
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
      this.selectedItem.set(null);
      this.closeMobileSheet();
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
