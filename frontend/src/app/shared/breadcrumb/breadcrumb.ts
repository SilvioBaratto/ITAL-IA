import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideChevronRight } from '@lucide/angular';

export interface BreadcrumbItem {
  label: string;
  route?: string;
}

@Component({
  selector: 'app-breadcrumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideChevronRight],
  template: `
    <nav aria-label="Breadcrumb" class="overflow-x-auto" tabindex="0">
      <ol class="flex items-center gap-1 whitespace-nowrap text-xs text-text-tertiary min-w-0">
        @for (crumb of crumbs(); track crumb.label; let last = $last) {
          <li class="flex items-center gap-1 min-w-0">
            @if (!last) {
              @if (crumb.route) {
                <a
                  [routerLink]="crumb.route"
                  class="hover:text-text-secondary transition-colors motion-reduce:transition-none truncate"
                >
                  {{ crumb.label }}
                </a>
              } @else {
                <span class="truncate">{{ crumb.label }}</span>
              }
              <svg
                lucideChevronRight
                class="w-3 h-3 shrink-0"
                strokeWidth="2"
                aria-hidden="true"
              ></svg>
            } @else {
              <span aria-current="page" class="text-text-secondary font-medium truncate">
                {{ crumb.label }}
              </span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class BreadcrumbComponent {
  readonly crumbs = input.required<BreadcrumbItem[]>();
}
