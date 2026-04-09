import { Injectable, inject, signal, computed, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { PoiCategory, PointOfInterest, PaginatedPoiResponse, PoiStatItem } from '../models/poi.model';
import { Comune, PaginatedComuneResponse } from '../models/comune.model';

/// Page size used by the single-category "flat list + auto-load" mode.
const SINGLE_CATEGORY_PAGE_SIZE = 50;

/// Page size used by the Tutti "6 per category" preview.
const TUTTI_PREVIEW_SIZE = 6;

export type CategoryViewMode = 'preview' | 'paginated';

export interface CategoryPageState {
  items: PointOfInterest[];
  total: number;
  loading: boolean;
  mode: CategoryViewMode;
}

/// Key shape: `${regionId}:${comuneId ?? ''}:${category}:${mode}`
/// The empty-string fallback for comuneId keeps the key compact; there's
/// no valid comuneId equal to '' so collisions are impossible.
export function buildCategoryKey(
  regionId: string,
  comuneId: string | null,
  category: PoiCategory,
  mode: CategoryViewMode,
): string {
  return `${regionId}:${comuneId ?? ''}:${category}:${mode}`;
}

@Injectable({
  providedIn: 'root',
})
export class ItaliapediaService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}poi`;
  private readonly comuniEndpoint = `${environment.apiUrl}comuni`;

  // ---------- Legacy flat API (landing page + poi detail page) ----------
  // Kept intact so italiapedia-landing.ts and italiapedia-poi.ts don't
  // need to change. The region page uses the paginated API below.
  private readonly cache = new Map<string, PointOfInterest[]>();
  private readonly poisSignal = signal<PointOfInterest[]>([]);
  private readonly selectedPoiSignal = signal<PointOfInterest | null>(null);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal(false);
  private readonly statsSignal = signal<PoiStatItem[]>([]);
  private readonly relatedPoisSignal = signal<PointOfInterest[]>([]);

  readonly pois = this.poisSignal.asReadonly();
  readonly selectedPoi = this.selectedPoiSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly stats = this.statsSignal.asReadonly();
  readonly relatedPois = this.relatedPoisSignal.asReadonly();

  fetchPois(regionId: string, category?: PoiCategory): void {
    const cacheKey = category ? `${regionId}:${category}` : regionId;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.poisSignal.set(cached);
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(false);

    const params: Record<string, string> = {
      regionId,
      limit: '100',
    };
    if (category) {
      params['category'] = category;
    }

    this.http.get<PaginatedPoiResponse>(this.endpoint, { params }).subscribe({
      next: (response) => {
        this.cache.set(cacheKey, response.data);
        this.poisSignal.set(response.data);
        this.loadingSignal.set(false);
      },
      error: () => {
        this.errorSignal.set(true);
        this.loadingSignal.set(false);
      },
    });
  }

  fetchStats(regionId: string, comuneId?: string | null): void {
    const params: Record<string, string> = { regionId };
    if (comuneId) params['comuneId'] = comuneId;

    this.http
      .get<PoiStatItem[]>(`${this.endpoint}/stats`, { params })
      .subscribe({
        next: (stats) => this.statsSignal.set(stats),
        error: () => { /* stats are non-critical, fail silently */ },
      });
  }

  fetchPoi(poiId: string): void {
    this.loadingSignal.set(true);
    this.errorSignal.set(false);

    this.http.get<PointOfInterest>(`${this.endpoint}/${poiId}`).subscribe({
      next: (poi) => {
        this.selectedPoiSignal.set(poi);
        this.loadingSignal.set(false);
      },
      error: () => {
        this.errorSignal.set(true);
        this.loadingSignal.set(false);
      },
    });
  }

  fetchRelated(poiId: string): void {
    this.http.get<PointOfInterest[]>(`${this.endpoint}/${poiId}/related`).subscribe({
      next: (related) => this.relatedPoisSignal.set(related),
      error: () => { /* related POIs are non-critical, fail silently */ },
    });
  }

  clearSelectedPoi(): void {
    this.selectedPoiSignal.set(null);
  }

  clearRelatedPois(): void {
    this.relatedPoisSignal.set([]);
  }

  // ---------- Comuni (region-scoped list) ----------
  private readonly comuniCache = new Map<string, Comune[]>();
  private readonly comuniByRegionSignal = signal<Map<string, Comune[]>>(new Map());

  /// All comuni currently loaded for the given region. Returns an empty
  /// array until `fetchComuni(regionId)` has resolved.
  comuniForRegion(regionId: string): Comune[] {
    return this.comuniByRegionSignal().get(regionId) ?? [];
  }

  /// Reactive accessor: use this inside `computed()` so the UI updates
  /// when the comune list for a region is loaded asynchronously.
  readonly comuniStore = this.comuniByRegionSignal.asReadonly();

  fetchComuni(regionId: string): void {
    if (this.comuniCache.has(regionId)) return;

    this.http
      .get<PaginatedComuneResponse>(this.comuniEndpoint, {
        params: { regionId, limit: '1000' },
      })
      .subscribe({
        next: (response) => {
          // Prisma Decimal fields come back as strings in JSON — coerce
          // once here so the rest of the app can treat them as numbers.
          const normalized: Comune[] = response.data.map((c) => ({
            ...c,
            latitude: typeof c.latitude === 'string' ? parseFloat(c.latitude) : c.latitude,
            longitude: typeof c.longitude === 'string' ? parseFloat(c.longitude) : c.longitude,
          }));
          this.comuniCache.set(regionId, normalized);
          this.comuniByRegionSignal.update((m) => {
            const next = new Map(m);
            next.set(regionId, normalized);
            return next;
          });
        },
        error: () => { /* non-critical, fail silently */ },
      });
  }

  // ---------- Selected comune (global filter state) ----------
  // Lives in the service so that effects outside the region component
  // (notably the geolocation sync) can write to it without prop drilling.
  private readonly selectedComuneIdSignal = signal<string | null>(null);
  readonly selectedComuneId = this.selectedComuneIdSignal.asReadonly();

  setSelectedComune(comuneId: string | null): void {
    this.selectedComuneIdSignal.set(comuneId);
  }

  /// Derived comune object for the currently-selected id. Returns null
  /// when nothing is selected or when the comune list for the region
  /// hasn't loaded yet.
  readonly selectedComune = computed<Comune | null>(() => {
    const id = this.selectedComuneIdSignal();
    if (!id) return null;
    for (const list of this.comuniByRegionSignal().values()) {
      const found = list.find((c) => c.id === id);
      if (found) return found;
    }
    return null;
  });

  // ---------- Paginated category store (region page) ----------
  private readonly categoryStoreSignal = signal<Map<string, CategoryPageState>>(new Map());

  /// Reactive accessor for the full store. Components build a key via
  /// `buildCategoryKey` and read `categoryStore().get(key)` inside a
  /// `computed()`.
  readonly categoryStore = this.categoryStoreSignal.asReadonly();

  /// Fetches the first 6 POIs for a category, ordered by data richness
  /// (image + description first). Stored under the `:preview` key. Called
  /// once per category in Tutti mode.
  ///
  /// `untracked` wraps the signal read so this method is safe to call
  /// from inside an Angular `effect()` — otherwise the effect would
  /// register `categoryStoreSignal` as a dependency, see its own write
  /// from the HTTP callback, and re-run until the browser dies.
  loadCategoryPreview(
    regionId: string,
    comuneId: string | null,
    category: PoiCategory,
  ): void {
    const key = buildCategoryKey(regionId, comuneId, category, 'preview');
    const current = untracked(() => this.categoryStoreSignal().get(key));
    // Re-use if already fetched; no pagination for previews.
    if (current && !current.loading) return;

    this.updateCategoryState(key, {
      items: current?.items ?? [],
      total: current?.total ?? 0,
      loading: true,
      mode: 'preview',
    });

    const params: Record<string, string> = {
      regionId,
      category,
      limit: String(TUTTI_PREVIEW_SIZE),
      offset: '0',
      order: 'curated',
    };
    if (comuneId) params['comuneId'] = comuneId;

    this.http.get<PaginatedPoiResponse>(this.endpoint, { params }).subscribe({
      next: (response) => {
        this.updateCategoryState(key, {
          items: response.data,
          total: response.total,
          loading: false,
          mode: 'preview',
        });
      },
      error: () => {
        this.updateCategoryState(key, {
          items: [],
          total: 0,
          loading: false,
          mode: 'preview',
        });
      },
    });
  }

  /// Fetches one paginated page (default order) and APPENDS the result to
  /// the existing accumulated list. Used in single-category mode. Offset 0
  /// resets the list; any other offset appends.
  ///
  /// As with `loadCategoryPreview`, the store read is wrapped in
  /// `untracked` so this method stays safe to call from inside an effect.
  loadCategoryPage(
    regionId: string,
    comuneId: string | null,
    category: PoiCategory,
    offset: number,
  ): void {
    const key = buildCategoryKey(regionId, comuneId, category, 'paginated');
    const current = untracked(() => this.categoryStoreSignal().get(key));

    // Guard: if we're already loading, or we've already loaded everything
    // past this offset, skip. Otherwise a sticky intersection observer
    // fires rapidly and double-requests.
    if (current?.loading) return;
    if (current && offset > 0 && current.items.length >= current.total) return;
    if (current && offset > 0 && offset < current.items.length) return;

    this.updateCategoryState(key, {
      items: offset === 0 ? [] : (current?.items ?? []),
      total: current?.total ?? 0,
      loading: true,
      mode: 'paginated',
    });

    const params: Record<string, string> = {
      regionId,
      category,
      limit: String(SINGLE_CATEGORY_PAGE_SIZE),
      offset: String(offset),
      order: 'default',
    };
    if (comuneId) params['comuneId'] = comuneId;

    this.http.get<PaginatedPoiResponse>(this.endpoint, { params }).subscribe({
      next: (response) => {
        const base = offset === 0 ? [] : (this.categoryStoreSignal().get(key)?.items ?? []);
        this.updateCategoryState(key, {
          items: [...base, ...response.data],
          total: response.total,
          loading: false,
          mode: 'paginated',
        });
      },
      error: () => {
        this.updateCategoryState(key, {
          items: this.categoryStoreSignal().get(key)?.items ?? [],
          total: this.categoryStoreSignal().get(key)?.total ?? 0,
          loading: false,
          mode: 'paginated',
        });
      },
    });
  }

  /// Drops every `paginated` entry in the store. Called when the active
  /// comune filter changes so stale single-category lists don't stick
  /// around across filter changes.
  resetPaginatedCategories(): void {
    this.categoryStoreSignal.update((m) => {
      const next = new Map<string, CategoryPageState>();
      for (const [k, v] of m) {
        if (v.mode !== 'paginated') next.set(k, v);
      }
      return next;
    });
  }

  private updateCategoryState(key: string, state: CategoryPageState): void {
    this.categoryStoreSignal.update((m) => {
      const next = new Map(m);
      next.set(key, state);
      return next;
    });
  }
}
