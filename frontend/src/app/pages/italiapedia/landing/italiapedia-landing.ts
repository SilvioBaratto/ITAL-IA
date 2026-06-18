import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  effect,
  untracked,
  OnInit,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { RegionService } from '../../../services/region.service';
import { ItaliapediaService } from '../../../services/italiapedia.service';
import { GeolocationService } from '../../../services/geolocation.service';
import { RegionCardComponent } from '../../../shared/region-card/region-card';
import { BreadcrumbComponent, BreadcrumbItem } from '../../../shared/breadcrumb/breadcrumb';
import { Region, RegionGroup } from '../../../models/region.model';
import { LucideArrowRight, LucideMapPin } from '@lucide/angular';
import { HorizontalScrollDirective } from '../../../shared/utils/horizontal-scroll.directive';

const GROUP_ORDER: RegionGroup[] = ['nord', 'centro', 'sud', 'isole'];

const GROUP_LABELS: Record<RegionGroup, string> = {
  nord: 'Nord',
  centro: 'Centro',
  sud: 'Sud',
  isole: 'Isole',
};

const GROUP_ARIA_LABELS: Record<RegionGroup, string> = {
  nord: 'Regioni del Nord',
  centro: 'Regioni del Centro',
  sud: 'Regioni del Sud',
  isole: 'Isole',
};

export interface RegionGroupEntry {
  group: RegionGroup;
  label: string;
  ariaLabel: string;
  regions: Region[];
}

@Component({
  selector: 'app-italiapedia-landing',
  templateUrl: './italiapedia-landing.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Match the chatbot layout contract: the page host is a flex child of
  // the layout's main element (`flex-1 flex flex-col min-h-0`), so it
  // must itself own its scrolling. Without this the host grows to its
  // content height, overflows the `h-dvh overflow-hidden` layout root
  // on mobile, and scroll is dead.
  host: { style: 'flex:1; min-height:0; display:block; overflow-y:auto' },
  imports: [
    RouterLink,
    RegionCardComponent,
    BreadcrumbComponent,
    LucideArrowRight,
    LucideMapPin,
    HorizontalScrollDirective,
  ],
})
export class ItaliapediaLandingComponent implements OnInit {
  private readonly regionService = inject(RegionService);
  private readonly italiapediaService = inject(ItaliapediaService);
  private readonly geoService = inject(GeolocationService);
  private readonly titleService = inject(Title);

  constructor() {
    // Warm the user's location the moment we know permission is already
    // granted, so clicking through to a region card auto-filters to their
    // comune with no visible delay. Never prompts — `locateIfGranted` is a
    // no-op unless the permission state is 'granted'.
    effect(() => {
      if (this.geoService.permissionState() === 'granted') {
        untracked(() => void this.geoService.locateIfGranted());
      }
    });
  }

  readonly loading = this.italiapediaService.statsLoading;

  readonly breadcrumbs: BreadcrumbItem[] = [{ label: 'Italiapedia' }];

  readonly featuredRegion = computed<Region | null>(() => {
    return this.regionService.regions().find((r) => r.hasKB) ?? null;
  });

  // Counts derive from the `/stats` aggregate (one row per category, with a
  // full region-wide count each) — the same source the region detail page
  // uses. Counting `pois().length` instead capped the hero at the POI fetch's
  // pagination limit (100), so the landing under-reported the real total.
  readonly featuredPoiCount = computed(() =>
    this.italiapediaService.stats().reduce((acc, s) => acc + s.count, 0),
  );

  readonly featuredCategoryCount = computed(
    () => this.italiapediaService.stats().length,
  );

  readonly regionGroups = computed<RegionGroupEntry[]>(() => {
    const all = this.regionService.regions();
    return GROUP_ORDER
      .map((group) => ({
        group,
        label: GROUP_LABELS[group],
        ariaLabel: GROUP_ARIA_LABELS[group],
        regions: all.filter((r) => r.group === group),
      }))
      .filter((entry) => entry.regions.length > 0);
  });

  ngOnInit(): void {
    this.titleService.setTitle('Italiapedia');
    const featured = this.featuredRegion();
    if (featured) {
      this.italiapediaService.fetchStats(featured.id);
    }
  }
}
