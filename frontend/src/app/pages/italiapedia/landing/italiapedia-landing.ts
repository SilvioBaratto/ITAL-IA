import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  OnInit,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { RegionService } from '../../../services/region.service';
import { ItaliapediaService } from '../../../services/italiapedia.service';
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
  private readonly titleService = inject(Title);

  readonly loading = this.italiapediaService.loading;

  readonly breadcrumbs: BreadcrumbItem[] = [{ label: 'Italiapedia' }];

  readonly featuredRegion = computed<Region | null>(() => {
    return this.regionService.regions().find((r) => r.hasKB) ?? null;
  });

  readonly featuredPoiCount = computed(() => this.italiapediaService.pois().length);

  readonly featuredCategoryCount = computed(() => {
    const categories = new Set(
      this.italiapediaService.pois().map((p) => p.category),
    );
    return categories.size;
  });

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
      this.italiapediaService.fetchPois(featured.id);
    }
  }
}
