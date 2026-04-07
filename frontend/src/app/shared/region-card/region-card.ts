import { Component, ChangeDetectionStrategy, input, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Region, RegionGroup } from '../../models/region.model';
import { LucideMapPin } from '@lucide/angular';
import { getRegionImageUrl } from '../utils/region-images';

export interface RegionCardStats {
  poiCount?: number;
}

const GROUP_LABELS: Record<RegionGroup, string> = {
  nord:   'Nord Italia',
  centro: 'Centro Italia',
  sud:    'Sud Italia',
  isole:  'Isole',
};

const GROUP_GRADIENTS: Record<RegionGroup, string> = {
  nord:   'bg-gradient-to-br from-accent/5 to-surface-raised',
  centro: 'bg-gradient-to-br from-primary/5 to-surface-raised',
  sud:    'bg-gradient-to-br from-gold/5 to-surface-raised',
  isole:  'bg-gradient-to-br from-accent/10 to-surface-raised',
};

@Component({
  selector: 'app-region-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideMapPin],
  template: `
    @if (region().hasKB) {
      <a
        [routerLink]="['/italiapedia', region().id]"
        class="relative overflow-hidden flex flex-col justify-between w-44 h-52 md:w-48 md:h-56 rounded-2xl border border-border/60 p-4
               transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-primary
               motion-reduce:transition-none motion-reduce:hover:translate-y-0 min-h-11"
        [class]="imageError() ? gradientClass() : ''"
        [attr.aria-label]="region().name + (stats().poiCount !== undefined ? ' — ' + stats().poiCount + ' luoghi' : '')"
      >
        @if (!imageError() && imageUrl()) {
          <img
            [src]="imageUrl()"
            [alt]="region().name"
            loading="lazy"
            (error)="onImageError()"
            class="absolute inset-0 w-full h-full object-cover rounded-2xl"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent rounded-2xl"></div>
        }

        <div class="relative z-10 flex items-start justify-between gap-2">
          <svg lucideMapPin
            class="w-5 h-5 shrink-0 mt-0.5"
            [class]="imageError() ? 'text-primary' : 'text-white'"
            strokeWidth="1.5"
            aria-hidden="true"
          ></svg>
        </div>

        <div class="relative z-10 flex flex-col gap-1 min-w-0">
          <span class="font-display font-semibold leading-snug" [class]="imageError() ? 'text-text' : 'text-white'">
            {{ region().name }}
          </span>
          <span class="text-xs" [class]="imageError() ? 'text-text-tertiary' : 'text-white/70'">
            {{ groupLabel() }}
          </span>
          @if (stats().poiCount !== undefined) {
            <span class="text-xs mt-1" [class]="imageError() ? 'text-text-secondary' : 'text-white/80'">
              {{ stats().poiCount }} luoghi
            </span>
          }
        </div>
      </a>
    } @else {
      <div
        class="relative overflow-hidden flex flex-col justify-between w-44 h-52 md:w-48 md:h-56 rounded-2xl border border-border/60 p-4
               opacity-60 min-h-11"
        [class]="imageError() ? gradientClass() : ''"
        role="group"
        [attr.aria-label]="region().name + ' — In arrivo'"
        aria-disabled="true"
        tabindex="-1"
      >
        @if (!imageError() && imageUrl()) {
          <img
            [src]="imageUrl()"
            [alt]="region().name"
            loading="lazy"
            (error)="onImageError()"
            class="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-40"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent rounded-2xl"></div>
        }

        <div class="relative z-10 flex items-start justify-between gap-2">
          <svg lucideMapPin
            class="w-5 h-5 shrink-0 mt-0.5"
            [class]="imageError() ? 'text-text-tertiary' : 'text-white/60'"
            strokeWidth="1.5"
            aria-hidden="true"
          ></svg>
          <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-surface-inset text-text-tertiary whitespace-nowrap">
            In arrivo
          </span>
        </div>

        <div class="relative z-10 flex flex-col gap-1 min-w-0">
          <span class="font-display font-semibold leading-snug" [class]="imageError() ? 'text-text' : 'text-white'">
            {{ region().name }}
          </span>
          <span class="text-xs" [class]="imageError() ? 'text-text-tertiary' : 'text-white/70'">
            {{ groupLabel() }}
          </span>
        </div>
      </div>
    }
  `,
})
export class RegionCardComponent {
  readonly region = input.required<Region>();
  readonly stats = input<RegionCardStats>({});

  readonly gradientClass = computed(() => GROUP_GRADIENTS[this.region().group]);
  readonly groupLabel = computed(() => GROUP_LABELS[this.region().group]);
  readonly imageUrl = computed(() => getRegionImageUrl(this.region().id));
  readonly imageError = signal(false);

  onImageError(): void {
    this.imageError.set(true);
  }
}
