import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ExploreCategory, ExploreData } from '../models/explore.model';
import { RegionService } from './region.service';

@Injectable({
  providedIn: 'root',
})
export class ExploreService {
  private readonly http = inject(HttpClient);
  private readonly regionService = inject(RegionService);

  private readonly cache = new Map<string, ExploreCategory[]>();
  private readonly categoriesSignal = signal<ExploreCategory[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal(false);

  readonly prompts = this.categoriesSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  readonly hasPrompts = computed(() => this.categoriesSignal().length > 0);

  constructor() {
    effect(() => {
      const region = this.regionService.selectedRegion();
      this.loadPrompts(region.id);
    });
  }

  retry(): void {
    const regionId = this.regionService.selectedRegion().id;
    this.cache.delete(regionId);
    this.loadPrompts(regionId);
  }

  private loadPrompts(regionId: string): void {
    const cached = this.cache.get(regionId);
    if (cached) {
      this.categoriesSignal.set(cached);
      this.errorSignal.set(false);
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(false);

    this.http.get<ExploreData>(`assets/explore/${regionId}.json`).subscribe({
      next: (data) => {
        this.cache.set(regionId, data.categories);
        this.categoriesSignal.set(data.categories);
        this.loadingSignal.set(false);
      },
      error: () => {
        this.loadDefault();
      },
    });
  }

  private loadDefault(): void {
    const defaultCached = this.cache.get('_default');
    if (defaultCached) {
      this.categoriesSignal.set(defaultCached);
      this.loadingSignal.set(false);
      return;
    }

    this.http.get<ExploreData>('assets/explore/_default.json').subscribe({
      next: (data) => {
        this.cache.set('_default', data.categories);
        this.categoriesSignal.set(data.categories);
        this.loadingSignal.set(false);
      },
      error: () => {
        this.categoriesSignal.set([]);
        this.errorSignal.set(true);
        this.loadingSignal.set(false);
      },
    });
  }
}
