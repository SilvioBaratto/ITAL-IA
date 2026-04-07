import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PointOfInterest } from '../../models/poi.model';
import { getCategoryBadgeConfig } from '../utils/category-badge';

@Component({
  selector: 'app-poi-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <a
      [routerLink]="['/italiapedia', poi().regionId, poi().id]"
      class="flex flex-col gap-2 bg-surface-raised border border-border/60 rounded-2xl p-4
             hover:border-primary/20 hover:shadow-sm transition-all duration-200
             motion-reduce:transition-none focus-visible:outline-primary min-h-11"
    >
      <span
        class="self-start text-[11px] font-medium px-2 py-0.5 rounded-full"
        [class]="badgeConfig().classes"
      >
        {{ badgeConfig().label }}
      </span>

      <span class="font-display font-semibold text-text leading-snug">
        {{ poi().name }}
      </span>

      @if (poi().address) {
        <span class="text-xs text-text-tertiary truncate">
          {{ poi().address }}
        </span>
      }

      @if (poi().description) {
        <span class="text-sm text-text-secondary line-clamp-2">
          {{ poi().description }}
        </span>
      }
    </a>
  `,
})
export class PoiCardComponent {
  readonly poi = input.required<PointOfInterest>();

  readonly badgeConfig = computed(() => getCategoryBadgeConfig(this.poi().category));
}
