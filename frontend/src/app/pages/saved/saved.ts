import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
  viewChild,
  ElementRef,
  afterNextRender,
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
})
export class SavedPageComponent {
  private readonly savedItemsService = inject(SavedItemsService);
  private readonly regionService = inject(RegionService);
  private readonly toastService = inject(ToastService);

  readonly loading = this.savedItemsService.loading;
  readonly error = this.savedItemsService.error;
  readonly hasSavedItems = this.savedItemsService.hasSavedItems;

  readonly selectedCategory = signal<SavedItemCategory | null>(null);
  readonly showAllRegions = signal(false);

  /** The item currently shown in the detail pane (desktop master-detail). */
  readonly selectedItem = signal<SavedItem | null>(null);

  private readonly detailHeading = viewChild<ElementRef<HTMLElement>>('detailHeading');

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

  selectCategory(category: SavedItemCategory | null): void {
    this.selectedCategory.set(category);
    // Clear detail selection when the filter changes so the right pane
    // does not show a stale item that may no longer be in the filtered list.
    this.selectedItem.set(null);
  }

  selectItem(item: SavedItem): void {
    this.selectedItem.set(item);
    // Move focus to the detail heading after Angular renders it.
    afterNextRender(() => {
      this.detailHeading()?.nativeElement.focus();
    });
  }

  clearSelectedItem(): void {
    this.selectedItem.set(null);
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

    // If the removed item is currently selected, clear the detail pane.
    if (this.selectedItem()?.id === item.id) {
      this.selectedItem.set(null);
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
}
