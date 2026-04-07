import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { ItaliapediaService } from '../../../services/italiapedia.service';
import { RegionService } from '../../../services/region.service';
import { SavedItemsService } from '../../../services/saved-items.service';
import { MobileChatBridgeService } from '../../../services/mobile-chat-bridge.service';
import { BreadcrumbComponent, BreadcrumbItem } from '../../../shared/breadcrumb/breadcrumb';
import { PoiCardComponent } from '../../../shared/poi-card/poi-card';
import { getCategoryBadgeConfig } from '../../../shared/utils/category-badge';
import { poiCategoryToSavedCategory } from '../../../models/poi.model';
import {
  LucideMapPin,
  LucideExternalLink,
  LucideBookmark,
  LucideBookmarkCheck,
} from '@lucide/angular';
import { HorizontalScrollDirective } from '../../../shared/utils/horizontal-scroll.directive';

@Component({
  selector: 'app-italiapedia-poi',
  templateUrl: './italiapedia-poi.html',
  styleUrl: './italiapedia-poi.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BreadcrumbComponent,
    PoiCardComponent,
    LucideMapPin,
    LucideExternalLink,
    LucideBookmark,
    LucideBookmarkCheck,
    HorizontalScrollDirective,
  ],
})
export class ItaliapediaPoiComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly titleService = inject(Title);
  private readonly italiapediaService = inject(ItaliapediaService);
  private readonly regionService = inject(RegionService);
  private readonly savedItemsService = inject(SavedItemsService);
  private readonly mobileChatBridge = inject(MobileChatBridgeService);

  readonly loading = this.italiapediaService.loading;
  readonly error = this.italiapediaService.error;
  readonly poi = this.italiapediaService.selectedPoi;
  readonly relatedPois = this.italiapediaService.relatedPois;

  /** True while the cover image is still loading from the network. */
  readonly imageLoading = signal(true);

  /** True if the cover image failed to load (src is invalid or request errored). */
  readonly imageError = signal(false);

  readonly poiId = computed<string>(
    () => this.route.snapshot.paramMap.get('poiId') ?? '',
  );

  readonly regionId = computed<string>(
    () => this.route.snapshot.paramMap.get('regionId') ?? '',
  );

  readonly region = computed(() =>
    this.regionService.regions().find((r) => r.id === this.regionId()) ?? null,
  );

  readonly badgeConfig = computed(() => {
    const p = this.poi();
    if (!p) return null;
    return getCategoryBadgeConfig(p.category);
  });

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const regionName = this.region()?.name ?? 'Regione';
    const poiName = this.poi()?.name ?? 'Dettaglio';
    const badgeLabel = this.badgeConfig()?.label ?? '';
    return [
      { label: 'Italiapedia', route: '/italiapedia' },
      { label: regionName, route: `/italiapedia/${this.regionId()}` },
      { label: badgeLabel || poiName },
    ];
  });

  readonly coordinates = computed(() => {
    const p = this.poi();
    if (!p || p.latitude === null || p.longitude === null) return null;
    return `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`;
  });

  readonly isSaved = computed(() => {
    const p = this.poi();
    const region = this.region();
    if (!p || !region) return false;
    return this.savedItemsService.isSaved(p.name, region.name, poiCategoryToSavedCategory(p.category));
  });

  readonly showRelated = computed(() => this.relatedPois().length >= 2);

  readonly chatPrompt = computed(() => {
    const p = this.poi();
    const regionName = this.region()?.name ?? '';
    if (!p) return '';
    return `Parlami di ${p.name} a ${regionName}`;
  });

  ngOnInit(): void {
    const poiId = this.poiId();
    const regionId = this.regionId();

    if (!poiId || !regionId) {
      this.router.navigate(['/italiapedia']);
      return;
    }

    this.italiapediaService.fetchPoi(poiId);
    this.italiapediaService.fetchRelated(poiId);
  }

  ngOnDestroy(): void {
    this.italiapediaService.clearSelectedPoi();
    this.italiapediaService.clearRelatedPois();
  }

  toggleSave(): void {
    const p = this.poi();
    const region = this.region();
    if (!p || !region) return;

    const savedCategory = poiCategoryToSavedCategory(p.category);

    if (this.isSaved()) {
      this.savedItemsService
        .unsave(p.name, region.name, savedCategory)
        .subscribe();
    } else {
      this.savedItemsService
        .save({
          name: p.name,
          category: savedCategory,
          region: region.name,
          description: p.description ?? '',
          address: p.address ?? undefined,
          mapsUrl: p.mapsUrl ?? undefined,
          website: p.websiteUrl ?? undefined,
          imageUrl: p.imageUrl ?? undefined,
        })
        .subscribe();
    }
  }

  openInChat(): void {
    const prompt = this.chatPrompt();
    if (!prompt) return;
    this.mobileChatBridge.notifyInputChange(prompt);
    this.router.navigate(['/']);
  }

  retry(): void {
    const poiId = this.poiId();
    this.italiapediaService.fetchPoi(poiId);
    this.italiapediaService.fetchRelated(poiId);
  }

  onImageLoad(): void {
    this.imageLoading.set(false);
  }

  onImageError(): void {
    this.imageLoading.set(false);
    this.imageError.set(true);
  }

  trackByPoiId(_: number, poi: { id: string }): string {
    return poi.id;
  }
}
