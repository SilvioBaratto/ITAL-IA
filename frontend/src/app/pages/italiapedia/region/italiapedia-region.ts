import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  signal,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { ItaliapediaService } from '../../../services/italiapedia.service';
import { RegionService } from '../../../services/region.service';
import { BreadcrumbComponent, BreadcrumbItem } from '../../../shared/breadcrumb/breadcrumb';
import { PoiCardComponent } from '../../../shared/poi-card/poi-card';
import { RegionCardComponent } from '../../../shared/region-card/region-card';
import { getCategoryBadgeConfig } from '../../../shared/utils/category-badge';
import { PoiCategory, PointOfInterest } from '../../../models/poi.model';
import { HorizontalScrollDirective } from '../../../shared/utils/horizontal-scroll.directive';

const ALL_FILTER = 'ALL' as const;
type CategoryFilter = PoiCategory | typeof ALL_FILTER;

export interface CategorySection {
  category: PoiCategory;
  label: string;
  pois: PointOfInterest[];
}

@Component({
  selector: 'app-italiapedia-region',
  templateUrl: './italiapedia-region.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BreadcrumbComponent,
    PoiCardComponent,
    RegionCardComponent,
    HorizontalScrollDirective,
  ],
})
export class ItaliapediaRegionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly titleService = inject(Title);
  private readonly italiapediaService = inject(ItaliapediaService);
  private readonly regionService = inject(RegionService);

  readonly loading = this.italiapediaService.loading;
  readonly error = this.italiapediaService.error;
  readonly stats = this.italiapediaService.stats;

  /** Tracks which categories are expanded on mobile. */
  readonly expandedCategories = signal<Set<PoiCategory>>(new Set());

  /** Active filter pill. */
  readonly activeFilter = signal<CategoryFilter>(ALL_FILTER);

  readonly regionId = computed<string>(() => this.route.snapshot.paramMap.get('regionId') ?? '');

  readonly region = computed(() =>
    this.regionService.regions().find((r) => r.id === this.regionId()) ?? null,
  );

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const name = this.region()?.name ?? 'Regione';
    return [
      { label: 'Italiapedia', route: '/italiapedia' },
      { label: name },
    ];
  });

  readonly totalPoiCount = computed(() => this.italiapediaService.pois().length);

  readonly categoryCount = computed(() => {
    const cats = new Set(this.italiapediaService.pois().map((p) => p.category));
    return cats.size;
  });

  /**
   * All POIs filtered by the active category pill.
   * When ALL_FILTER is active every POI is included.
   */
  readonly filteredPois = computed<PointOfInterest[]>(() => {
    const filter = this.activeFilter();
    const all = this.italiapediaService.pois();
    if (filter === ALL_FILTER) return all;
    return all.filter((p) => p.category === filter);
  });

  /**
   * Sections grouped by category, preserving only non-empty groups.
   * When a single category is selected only one section is produced.
   */
  readonly categorySections = computed<CategorySection[]>(() => {
    const pois = this.filteredPois();
    const grouped = new Map<PoiCategory, PointOfInterest[]>();

    for (const poi of pois) {
      const existing = grouped.get(poi.category);
      if (existing) {
        existing.push(poi);
      } else {
        grouped.set(poi.category, [poi]);
      }
    }

    return Array.from(grouped.entries()).map(([category, items]) => ({
      category,
      label: getCategoryBadgeConfig(category).label,
      pois: items,
    }));
  });

  /**
   * Filter pills built from stats when available, falling back to the
   * categories found in the current POI list.
   */
  readonly filterPills = computed<Array<{ filter: CategoryFilter; label: string; count: number }>>(() => {
    const total = this.totalPoiCount();
    const statItems = this.stats();

    const categoryPills = statItems.length > 0
      ? statItems.map((s) => ({
          filter: s.category as CategoryFilter,
          label: getCategoryBadgeConfig(s.category).label,
          count: s.count,
        }))
      : this.categorySections().map((s) => ({
          filter: s.category as CategoryFilter,
          label: s.label,
          count: s.pois.length,
        }));

    return [
      { filter: ALL_FILTER, label: 'Tutti', count: total },
      ...categoryPills,
    ];
  });

  /** Text announced by the aria-live region when the filter changes. */
  readonly filteredResultsAnnouncement = computed(() => `${this.filteredPois().length} risultati`);

  /** Related regions: same group, excluding current. */
  readonly relatedRegions = computed(() => {
    const current = this.region();
    if (!current) return [];
    return this.regionService
      .regions()
      .filter((r) => r.group === current.group && r.id !== current.id);
  });

  ngOnInit(): void {
    const id = this.regionId();
    const found = this.regionService.regions().find((r) => r.id === id);

    if (!found) {
      this.router.navigate(['/italiapedia']);
      return;
    }

    this.titleService.setTitle(`${found.name} — Italiapedia`);
    this.italiapediaService.fetchPois(id);
    this.italiapediaService.fetchStats(id);
  }

  setFilter(filter: CategoryFilter): void {
    this.activeFilter.set(filter);
  }

  isFilterActive(filter: CategoryFilter): boolean {
    return this.activeFilter() === filter;
  }

  toggleCategory(category: PoiCategory): void {
    this.expandedCategories.update((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  isCategoryExpanded(category: PoiCategory): boolean {
    return this.expandedCategories().has(category);
  }

  /** Returns the POIs to show for a section, honouring mobile collapse. */
  visiblePois(section: CategorySection): PointOfInterest[] {
    if (this.isCategoryExpanded(section.category) || section.pois.length <= 3) {
      return section.pois;
    }
    return section.pois.slice(0, 3);
  }

  hiddenCount(section: CategorySection): number {
    return Math.max(0, section.pois.length - 3);
  }

  navigateToChat(): void {
    const id = this.regionId();
    this.regionService.selectRegion(id);
    this.router.navigate(['/']);
  }

  retry(): void {
    const id = this.regionId();
    this.italiapediaService.fetchPois(id);
    this.italiapediaService.fetchStats(id);
  }

  onFilterKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    const container = event.currentTarget as HTMLElement;
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
    if (buttons.length === 0) return;

    const currentIndex = buttons.findIndex((btn) => btn === document.activeElement);
    if (currentIndex === -1) return;

    event.preventDefault();

    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + delta + buttons.length) % buttons.length;
    buttons[nextIndex].focus();
  }

  /** TrackBy helpers */
  trackByCategory(_: number, section: CategorySection): PoiCategory {
    return section.category;
  }

  trackByPoiId(_: number, poi: PointOfInterest): string {
    return poi.id;
  }
}
