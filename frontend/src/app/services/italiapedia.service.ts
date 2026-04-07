import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { PoiCategory, PointOfInterest, PaginatedPoiResponse, PoiStatItem } from '../models/poi.model';

@Injectable({
  providedIn: 'root',
})
export class ItaliapediaService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}poi`;
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

  fetchStats(regionId: string): void {
    this.http
      .get<PoiStatItem[]>(`${this.endpoint}/stats`, { params: { regionId } })
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
}
