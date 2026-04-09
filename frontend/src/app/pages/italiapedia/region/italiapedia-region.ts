import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  signal,
  effect,
  untracked,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import {
  ItaliapediaService,
  buildCategoryKey,
  CategoryPageState,
} from '../../../services/italiapedia.service';
import { RegionService } from '../../../services/region.service';
import { GeolocationService } from '../../../services/geolocation.service';
import { BreadcrumbComponent, BreadcrumbItem } from '../../../shared/breadcrumb/breadcrumb';
import { PoiCardComponent } from '../../../shared/poi-card/poi-card';
import { RegionCardComponent } from '../../../shared/region-card/region-card';
import { ComuneComboboxComponent } from '../../../shared/comune-combobox/comune-combobox';
import { OnVisibleDirective } from '../../../shared/utils/on-visible.directive';
import { getCategoryBadgeConfig } from '../../../shared/utils/category-badge';
import { PoiCategory, PointOfInterest } from '../../../models/poi.model';
import { Comune } from '../../../models/comune.model';
import { HorizontalScrollDirective } from '../../../shared/utils/horizontal-scroll.directive';
import { LucideMapPin, LucideX } from '@lucide/angular';

const ALL_FILTER = 'ALL' as const;
type CategoryFilter = PoiCategory | typeof ALL_FILTER;

const TUTTI_PREVIEW_SIZE = 6;
const GEO_DISTANCE_THRESHOLD_KM = 15;
const DISMISS_STORAGE_KEY = 'italiapedia.geoBanner.dismissed';

export interface CategorySection {
  category: PoiCategory;
  label: string;
  state: CategoryPageState | undefined;
  count: number;
}

/** Haversine distance in kilometres. */
function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

@Component({
  selector: 'app-italiapedia-region',
  templateUrl: './italiapedia-region.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Own the scroll container on this page — see the comment in
  // italiapedia-landing.ts for the rationale. The sticky filter bar
  // inside `italiapedia-region.html` uses this host as its scroll
  // ancestor, so positioning stays correct on mobile.
  host: { style: 'flex:1; min-height:0; display:block; overflow-y:auto' },
  imports: [
    BreadcrumbComponent,
    PoiCardComponent,
    RegionCardComponent,
    ComuneComboboxComponent,
    OnVisibleDirective,
    HorizontalScrollDirective,
    LucideMapPin,
    LucideX,
  ],
})
export class ItaliapediaRegionComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly titleService = inject(Title);
  private readonly italiapediaService = inject(ItaliapediaService);
  private readonly regionService = inject(RegionService);
  private readonly geoService = inject(GeolocationService);

  readonly loading = this.italiapediaService.loading;
  readonly error = this.italiapediaService.error;
  readonly stats = this.italiapediaService.stats;

  /** Active category filter pill. */
  readonly activeFilter = signal<CategoryFilter>(ALL_FILTER);

  readonly regionId = computed<string>(
    () => this.route.snapshot.paramMap.get('regionId') ?? '',
  );

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

  /** All comuni for the current region, reactive. */
  readonly comuni = computed<Comune[]>(() =>
    this.italiapediaService.comuniStore().get(this.regionId()) ?? [],
  );

  /** Currently-selected comune (full object, derived from service signal). */
  readonly selectedComune = this.italiapediaService.selectedComune;

  readonly totalPoiCount = computed(() => {
    // Sum counts from stats rather than POI arrays — stats reflect the
    // filtered (regionId + comuneId) total, which is what we display.
    return this.stats().reduce((acc, s) => acc + s.count, 0);
  });

  readonly categoryCount = computed(() => this.stats().length);

  /**
   * Category sections. The shape depends on the active filter:
   *   - ALL / Tutti → one section per category in stats, each carrying
   *     its curated-preview state (the top 6 for that category).
   *   - Single category → exactly one section with the paginated state.
   */
  readonly categorySections = computed<CategorySection[]>(() => {
    const store = this.italiapediaService.categoryStore();
    const filter = this.activeFilter();
    const regionId = this.regionId();
    const comuneId = this.selectedComune()?.id ?? null;
    const statItems = this.stats();

    if (filter === ALL_FILTER) {
      return statItems.map((s) => {
        const key = buildCategoryKey(regionId, comuneId, s.category, 'preview');
        return {
          category: s.category,
          label: getCategoryBadgeConfig(s.category).label,
          state: store.get(key),
          count: s.count,
        };
      });
    }

    const key = buildCategoryKey(regionId, comuneId, filter, 'paginated');
    const state = store.get(key);
    const statEntry = statItems.find((s) => s.category === filter);
    return [
      {
        category: filter,
        label: getCategoryBadgeConfig(filter).label,
        state,
        count: statEntry?.count ?? state?.total ?? 0,
      },
    ];
  });

  /** Filter pills: "Tutti" + one per category that has > 0 POIs. */
  readonly filterPills = computed<
    Array<{ filter: CategoryFilter; label: string; count: number }>
  >(() => {
    const total = this.totalPoiCount();
    return [
      { filter: ALL_FILTER, label: 'Tutti', count: total },
      ...this.stats().map((s) => ({
        filter: s.category as CategoryFilter,
        label: getCategoryBadgeConfig(s.category).label,
        count: s.count,
      })),
    ];
  });

  /** Text announced by the aria-live region when the filter changes. */
  readonly filteredResultsAnnouncement = computed(() => {
    const filter = this.activeFilter();
    const total =
      filter === ALL_FILTER
        ? this.totalPoiCount()
        : (this.stats().find((s) => s.category === filter)?.count ?? 0);
    return `${total} risultati`;
  });

  /** Related regions: same group, excluding current. */
  readonly relatedRegions = computed(() => {
    const current = this.region();
    if (!current) return [];
    return this.regionService
      .regions()
      .filter((r) => r.group === current.group && r.id !== current.id);
  });

  // ---------- Geolocation banner state ----------

  /** Has the user dismissed this banner for the current comune/region pair? */
  private readonly dismissedKeys = signal<Set<string>>(this.loadDismissedKeys());

  /**
   * The geo-detected comune in the CURRENT region, if any. When the
   * detected comune is in a different region, this is null (but
   * `crossRegionGeoHint` below surfaces that case separately).
   */
  readonly geoSuggestion = computed<Comune | null>(() => {
    const name = this.geoService.comuneName();
    if (!name) return null;
    // Distance guard: geolocation may be wrong by ≥15 km on desktop Wi-Fi.
    const pos = this.geoService.position();
    const comuni = this.comuni();
    const match = comuni.find(
      (c) => c.name.toLowerCase() === name.toLowerCase(),
    );
    if (!match) return null;
    if (pos) {
      const dist = haversineKm(
        pos.latitude,
        pos.longitude,
        match.latitude,
        match.longitude,
      );
      if (dist > GEO_DISTANCE_THRESHOLD_KM) return null;
    }
    return match;
  });

  /** Whether to show the suggestion banner (not already dismissed, not already selected). */
  readonly showGeoBanner = computed<boolean>(() => {
    const s = this.geoSuggestion();
    if (!s) return false;
    if (this.selectedComune()?.id === s.id) return false;
    const key = `${s.id}:${this.regionId()}`;
    return !this.dismissedKeys().has(key);
  });

  /**
   * Cross-region hint for the combobox: when the user's detected comune
   * lives in a DIFFERENT region, surface a deep-link hint inside the
   * combobox dropdown instead of a full banner on the wrong page.
   */
  readonly crossRegionGeoHint = computed<Comune | null>(() => {
    const name = this.geoService.comuneName();
    if (!name) return null;
    // Only show if we DON'T have a match in the current region.
    if (this.geoSuggestion()) return null;
    // Look across every region's loaded comuni list.
    for (const list of this.italiapediaService.comuniStore().values()) {
      const match = list.find(
        (c) =>
          c.name.toLowerCase() === name.toLowerCase() &&
          c.regionId !== this.regionId(),
      );
      if (match) return match;
    }
    return null;
  });

  /** Raw ?comune= slug captured from the initial URL; resolved async once comuni load. */
  private readonly initialComuneSlug: string | null;
  private initialComuneResolved = false;

  constructor() {
    // Hydrate synchronous state from URL query params BEFORE any effect
    // runs. The route snapshot is stable once the component is
    // constructed, so reading it here is safe and avoids a flash of
    // default state before the URL sync kicks in.
    const params = this.route.snapshot.queryParamMap;
    const categoryParam = params.get('category') as PoiCategory | null;
    if (categoryParam) {
      this.activeFilter.set(categoryParam);
    }
    this.initialComuneSlug = params.get('comune');

    // Data loader effect. Reads only the signals we want to react to and
    // wraps all service calls in `untracked` — the service methods read
    // `categoryStoreSignal` internally for their dedup check, and
    // without `untracked` this effect would register that signal as a
    // dependency and loop on its own writes.
    effect(() => {
      const regionId = this.regionId();
      if (!regionId) return;
      const filter = this.activeFilter();
      const comuneId = this.selectedComune()?.id ?? null;
      const statItems = this.stats();

      untracked(() => {
        if (filter === ALL_FILTER) {
          for (const s of statItems) {
            this.italiapediaService.loadCategoryPreview(
              regionId,
              comuneId,
              s.category,
            );
          }
        } else {
          // Single category: load the first paginated page. Subsequent
          // pages fire via the intersection observer sentinel in the
          // template.
          this.italiapediaService.loadCategoryPage(
            regionId,
            comuneId,
            filter,
            0,
          );
        }
      });
    });

    // URL sync: write ?category and ?comune back whenever they change.
    effect(() => {
      const filter = this.activeFilter();
      const comune = this.selectedComune();
      if (!this.regionId()) return;
      untracked(() => {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {
            category: filter === ALL_FILTER ? null : filter,
            comune: comune?.name.toLowerCase() ?? null,
          },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
    });

    // One-shot comune slug resolver. Fires every time `comuni()` changes
    // but early-returns once we've matched (or once we know there's no
    // slug to resolve). Structured as an effect because we need to wait
    // for the async `fetchComuni` call to populate the list.
    effect(() => {
      if (this.initialComuneResolved) return;
      const slug = this.initialComuneSlug;
      if (!slug) {
        this.initialComuneResolved = true;
        return;
      }
      const list = this.comuni();
      if (list.length === 0) return;
      this.initialComuneResolved = true;
      const match = list.find(
        (c) => c.name.toLowerCase() === slug.toLowerCase(),
      );
      if (!match) return;
      untracked(() => {
        this.italiapediaService.setSelectedComune(match.id);
        this.italiapediaService.fetchStats(this.regionId(), match.id);
      });
    });
  }

  ngOnInit(): void {
    const id = this.regionId();
    const found = this.regionService.regions().find((r) => r.id === id);

    if (!found) {
      this.router.navigate(['/italiapedia']);
      return;
    }

    this.titleService.setTitle(`${found.name} — Italiapedia`);

    // Kick off the comuni fetch. Stats are fetched here too (without a
    // comune filter); if the URL carried ?comune=, the resolver effect
    // above will re-fetch stats with the right filter once comuni land.
    this.italiapediaService.fetchComuni(id);
    this.italiapediaService.fetchStats(id);
  }

  ngOnDestroy(): void {
    // Clear the selected comune so navigating away doesn't leak a stale
    // filter into the next region page.
    this.italiapediaService.setSelectedComune(null);
  }

  // ---------- User actions ----------

  setFilter(filter: CategoryFilter): void {
    this.activeFilter.set(filter);
  }

  isFilterActive(filter: CategoryFilter): boolean {
    return this.activeFilter() === filter;
  }

  /** Deep-link from a Tutti section's "Vedi tutti N →" button. */
  seeAllCategory(category: PoiCategory): void {
    this.activeFilter.set(category);
    // Scroll back to the top of the content so the user sees the first
    // page of the newly-expanded list immediately.
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /** Called by the intersection observer at the bottom of a single-category list. */
  loadMoreCategory(category: PoiCategory): void {
    const regionId = this.regionId();
    const comuneId = this.selectedComune()?.id ?? null;
    const key = buildCategoryKey(regionId, comuneId, category, 'paginated');
    const state = this.italiapediaService.categoryStore().get(key);
    if (!state || state.loading) return;
    if (state.items.length >= state.total) return;
    this.italiapediaService.loadCategoryPage(
      regionId,
      comuneId,
      category,
      state.items.length,
    );
  }

  /** Keyboard arrow-key navigation across the filter pill row. */
  onFilterKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    const container = event.currentTarget as HTMLElement;
    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button'),
    );
    if (buttons.length === 0) return;

    const currentIndex = buttons.findIndex(
      (btn) => btn === document.activeElement,
    );
    if (currentIndex === -1) return;

    event.preventDefault();

    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + delta + buttons.length) % buttons.length;
    buttons[nextIndex].focus();
  }

  // ---------- Comune combobox wiring ----------

  onComuneSelected(comune: Comune | null): void {
    this.italiapediaService.setSelectedComune(comune?.id ?? null);
    // Dropping the previous paginated single-category pages keeps stale
    // lists from leaking across comune changes.
    this.italiapediaService.resetPaginatedCategories();
    // Refresh stats so pill counts reflect the new filter (e.g. 80
    // ristoranti in Trieste vs 1.347 in all of FVG).
    this.italiapediaService.fetchStats(this.regionId(), comune?.id ?? null);
  }

  onCrossRegionNavigate(comune: Comune): void {
    this.router.navigate(['/italiapedia', comune.regionId], {
      queryParams: { comune: comune.name.toLowerCase() },
    });
  }

  // ---------- Geolocation banner wiring ----------

  applyGeoSuggestion(): void {
    const s = this.geoSuggestion();
    if (!s) return;
    this.onComuneSelected(s);
  }

  dismissGeoBanner(): void {
    const s = this.geoSuggestion();
    if (!s) return;
    const key = `${s.id}:${this.regionId()}`;
    this.dismissedKeys.update((set) => {
      const next = new Set(set);
      next.add(key);
      return next;
    });
    this.persistDismissedKeys();
  }

  private loadDismissedKeys(): Set<string> {
    if (typeof localStorage === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  }

  private persistDismissedKeys(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(
        DISMISS_STORAGE_KEY,
        JSON.stringify(Array.from(this.dismissedKeys())),
      );
    } catch {
      // Quota errors or private mode — best effort.
    }
  }

  // ---------- Navigation helpers ----------

  navigateToChat(): void {
    const id = this.regionId();
    this.regionService.selectRegion(id);
    this.router.navigate(['/']);
  }

  retry(): void {
    const id = this.regionId();
    this.italiapediaService.fetchStats(
      id,
      this.selectedComune()?.id ?? null,
    );
  }

  // ---------- Template helpers ----------

  /**
   * POIs to render for a given section. In Tutti mode we cap at the
   * preview size (6); in single-category mode we return the whole
   * accumulated list.
   */
  poisForSection(section: CategorySection): PointOfInterest[] {
    if (!section.state) return [];
    if (this.activeFilter() === ALL_FILTER) {
      return section.state.items.slice(0, TUTTI_PREVIEW_SIZE);
    }
    return section.state.items;
  }

  /** Whether the current (single-category) section has more pages to load. */
  hasMore(section: CategorySection): boolean {
    if (this.activeFilter() === ALL_FILTER) return false;
    if (!section.state) return false;
    return section.state.items.length < section.state.total;
  }

  /** Whether the single-category section is currently fetching a page. */
  isLoadingMore(section: CategorySection): boolean {
    return section.state?.loading ?? false;
  }

  /** Short skeleton placeholder count for a category preview while loading. */
  previewSkeletonCount(): number[] {
    return [1, 2, 3, 4, 5, 6];
  }

  /** TrackBy helpers */
  trackByCategory(_: number, section: CategorySection): PoiCategory {
    return section.category;
  }

  trackByPoiId(_: number, poi: PointOfInterest): string {
    return poi.id;
  }
}
