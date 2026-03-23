import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subscription, tap, catchError, throwError, EMPTY } from 'rxjs';
import { environment } from '../../environments/environment';
import { RegionService } from './region.service';
import { SavedItem, SaveItemRequest, SavedItemCategory } from '../models/saved-item.model';

@Injectable({
  providedIn: 'root',
})
export class SavedItemsService {
  private readonly http = inject(HttpClient);
  private readonly regionService = inject(RegionService);
  private readonly endpoint = `${environment.apiUrl}saved-items`;

  private readonly savedItemsMap = signal<Map<string, SavedItem>>(new Map());
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal(false);
  private readonly statusSignal = signal<string | null>(null);
  private activeSubscription?: Subscription;

  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly statusMessage = this.statusSignal.asReadonly();
  readonly hasSavedItems = computed(() => this.savedItemsMap().size > 0);
  readonly savedItems = computed(() => Array.from(this.savedItemsMap().values()));

  constructor() {
    effect(() => {
      const region = this.regionService.selectedRegion();
      this.activeSubscription?.unsubscribe();
      this.loadingSignal.set(true);
      this.errorSignal.set(false);

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
    this.statusSignal.set(`${item.name} saved`);

    return this.http.post<SavedItem>(this.endpoint, item).pipe(
      tap((saved) => this.addToMap(key, saved)),
      catchError((err) => {
        if (previousItem) {
          this.addToMap(key, previousItem);
        } else {
          this.removeFromMap(key);
        }
        this.statusSignal.set(`Failed to save ${item.name}`);
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
    this.statusSignal.set(`${name} removed from saved`);

    return this.http.delete<void>(`${this.endpoint}/${previousItem.id}`).pipe(
      catchError((err) => {
        this.addToMap(key, previousItem);
        this.statusSignal.set(`Failed to remove ${name}`);
        return throwError(() => err);
      }),
    );
  }

  loadSavedItems(region?: string, category?: SavedItemCategory): Observable<SavedItem[]> {
    const params: Record<string, string> = {};
    if (region) {
      params['region'] = region;
    }
    if (category) {
      params['category'] = category;
    }

    return this.http.get<SavedItem[]>(this.endpoint, { params }).pipe(
      tap((items) => {
        const map = new Map<string, SavedItem>();
        for (const item of items) {
          map.set(this.buildKey(item.name, item.region, item.category), item);
        }
        this.savedItemsMap.set(map);
        this.loadingSignal.set(false);
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
