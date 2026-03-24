import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subscription, tap, catchError, throwError, EMPTY } from 'rxjs';
import { environment } from '../../environments/environment';
import { RegionService } from './region.service';
import { SavedItem, SaveItemRequest, SavedItemCategory, PaginatedSavedItemsResponse } from '../models/saved-item.model';

const DEFAULT_LIMIT = 20;

@Injectable({
  providedIn: 'root',
})
export class SavedItemsService {
  private readonly http = inject(HttpClient);
  private readonly regionService = inject(RegionService);
  private readonly endpoint = `${environment.apiUrl}saved-items`;

  private readonly savedItemsMap = signal<Map<string, SavedItem>>(new Map());
  private readonly loadingSignal = signal(false);
  private readonly loadingMoreSignal = signal(false);
  private readonly errorSignal = signal(false);
  private readonly totalSignal = signal(0);
  private readonly offsetSignal = signal(0);
  private activeSubscription?: Subscription;

  readonly loading = this.loadingSignal.asReadonly();
  readonly loadingMore = this.loadingMoreSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly total = this.totalSignal.asReadonly();
  readonly hasSavedItems = computed(() => this.savedItemsMap().size > 0);
  readonly savedItems = computed(() => Array.from(this.savedItemsMap().values()));
  readonly hasMore = computed(() => this.savedItemsMap().size < this.totalSignal());

  constructor() {
    effect(() => {
      const region = this.regionService.selectedRegion();
      this.activeSubscription?.unsubscribe();
      this.loadingSignal.set(true);
      this.errorSignal.set(false);
      this.totalSignal.set(0);
      this.offsetSignal.set(0);

      this.activeSubscription = this.loadSavedItems(region.id).subscribe({
        error: () => {
          this.errorSignal.set(true);
          this.loadingSignal.set(false);
        },
      });
    });
  }

  isSaved(name: string, region: string, category: string): boolean {
    return this.savedItemsMap().has(this.buildKey(name, region, category));
  }

  getSavedItem(name: string, region: string, category: string): SavedItem | undefined {
    return this.savedItemsMap().get(this.buildKey(name, region, category));
  }

  save(item: SaveItemRequest): Observable<SavedItem> {
    const key = this.buildKey(item.name, item.region, item.category);
    const previousItem = this.savedItemsMap().get(key);
    this.addToMap(key, { id: '', userId: '', savedAt: '', ...item, address: item.address ?? null, mapsUrl: item.mapsUrl ?? null, website: item.website ?? null, imageUrl: item.imageUrl ?? null });

    return this.http.post<SavedItem>(this.endpoint, item).pipe(
      tap((saved) => {
        this.addToMap(key, saved);
        this.totalSignal.update((t) => t + 1);
      }),
      catchError((err) => {
        if (previousItem) {
          this.addToMap(key, previousItem);
        } else {
          this.removeFromMap(key);
        }
        return throwError(() => err);
      }),
    );
  }

  unsave(name: string, region: string, category: string): Observable<void> {
    const key = this.buildKey(name, region, category);
    const previousItem = this.savedItemsMap().get(key);
    if (!previousItem?.id) {
      return EMPTY;
    }

    this.removeFromMap(key);
    this.totalSignal.update((t) => Math.max(0, t - 1));

    return this.http.delete<void>(`${this.endpoint}/${previousItem.id}`).pipe(
      catchError((err) => {
        this.addToMap(key, previousItem);
        this.totalSignal.update((t) => t + 1);
        return throwError(() => err);
      }),
    );
  }

  /** Loads the first page, replacing the map entirely. Called on initial mount and region change. */
  loadSavedItems(region?: string, category?: SavedItemCategory): Observable<PaginatedSavedItemsResponse> {
    const params: Record<string, string> = {
      limit: String(DEFAULT_LIMIT),
      offset: '0',
    };
    if (region) params['region'] = region;
    if (category) params['category'] = category;

    return this.http.get<PaginatedSavedItemsResponse>(this.endpoint, { params }).pipe(
      tap((response) => {
        const map = new Map<string, SavedItem>();
        for (const item of response.data) {
          map.set(this.buildKey(item.name, item.region, item.category), item);
        }
        this.savedItemsMap.set(map);
        this.totalSignal.set(response.total);
        this.offsetSignal.set(response.data.length);
        this.loadingSignal.set(false);
      }),
    );
  }

  /** Loads the next page and merges items into the existing map. Triggered by "Load more". */
  loadMore(region?: string, category?: SavedItemCategory): Observable<PaginatedSavedItemsResponse> {
    const params: Record<string, string> = {
      limit: String(DEFAULT_LIMIT),
      offset: String(this.offsetSignal()),
    };
    if (region) params['region'] = region;
    if (category) params['category'] = category;

    this.loadingMoreSignal.set(true);

    return this.http.get<PaginatedSavedItemsResponse>(this.endpoint, { params }).pipe(
      tap((response) => {
        for (const item of response.data) {
          this.addToMap(this.buildKey(item.name, item.region, item.category), item);
        }
        this.totalSignal.set(response.total);
        this.offsetSignal.update((prev) => prev + response.data.length);
        this.loadingMoreSignal.set(false);
      }),
      catchError((err) => {
        this.loadingMoreSignal.set(false);
        return throwError(() => err);
      }),
    );
  }

  private buildKey(name: string, region: string, category: string): string {
    return `${name}:${region}:${category}`;
  }

  private addToMap(key: string, item: SavedItem): void {
    this.savedItemsMap.update((prev) => {
      const next = new Map(prev);
      next.set(key, item);
      return next;
    });
  }

  private removeFromMap(key: string): void {
    this.savedItemsMap.update((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }
}
