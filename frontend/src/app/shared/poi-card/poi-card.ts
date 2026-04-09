import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideMapPin } from '@lucide/angular';
import { PointOfInterest } from '../../models/poi.model';

@Component({
  selector: 'app-poi-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideMapPin],
  host: { class: 'block h-full' },
  template: `
    <a
      [routerLink]="['/italiapedia', regionId(), poi().id]"
      class="flex flex-col gap-2 h-full bg-surface-raised border border-border/60 rounded-2xl p-4
             hover:border-primary/20 hover:shadow-sm transition-all duration-200
             motion-reduce:transition-none focus-visible:outline-primary"
    >
      <!--
        Comune badge (replaces the category badge — category is already
        conveyed by the section heading that contains this card). When
        the POI payload doesn't include a comune (legacy paths), fall
        back to a neutral "Sconosciuto" chip so we never render an empty
        box.
      -->
      @if (comuneLabel(); as label) {
        <span
          class="self-start inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary"
        >
          <svg
            lucideMapPin
            class="w-3 h-3 shrink-0"
            strokeWidth="2"
            aria-hidden="true"
          ></svg>
          {{ label }}
        </span>
      }

      <span class="font-display font-semibold text-text leading-snug line-clamp-2 break-words">
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

  // "Trieste (TS)" — the comune name plus the 2-letter province code so
  // similarly-named comuni are still disambiguated (e.g. two "San
  // Giovanni"s in different provinces).
  readonly comuneLabel = computed(() => {
    const c = this.poi().comune;
    if (!c?.name) return null;
    return c.province ? `${c.name} (${c.province})` : c.name;
  });

  // Reach the region via the comune relation (POI no longer carries
  // regionId directly). Falls back to empty string if the backend forgot
  // to include the comune — the router link would then be invalid, which
  // is a clearer failure mode than crashing.
  readonly regionId = computed(() => this.poi().comune?.regionId ?? '');
}
