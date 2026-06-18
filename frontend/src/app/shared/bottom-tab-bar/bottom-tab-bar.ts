import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { RegionService } from '../../services/region.service';
import { MobileChatBridgeService } from '../../services/mobile-chat-bridge.service';
import { RegionBottomSheetComponent } from '../region-bottom-sheet/region-bottom-sheet';
import { ChatInputComponent } from '../chat-input/chat-input';
import { NavItem, NAV_ITEMS } from '../nav-item';
import {
  LucideMapPin,
  LucideChevronDown,
  LucideMessageCircle,
  LucideBookmark,
  LucideCompass,
} from '@lucide/angular';

@Component({
  selector: 'app-bottom-tab-bar',
  imports: [
    RouterLink,
    RouterLinkActive,
    RegionBottomSheetComponent,
    ChatInputComponent,
    LucideMapPin,
    LucideChevronDown,
    LucideMessageCircle,
    LucideBookmark,
    LucideCompass,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block md:hidden' },
  template: `
    <!-- Chat input (above tabs, only on chat page) — always visible -->
    @if (bridge.showInput()) {
      <div class="px-3 py-2 bg-surface/80 backdrop-blur-md border-t border-border/40">
        <app-chat-input
          [userInput]="bridge.userInput()"
          [isLoading]="bridge.isLoading()"
          (send)="bridge.send($event)"
          (inputChange)="bridge.notifyInputChange($event)"
        />
      </div>
    }

    <!-- Tab bar -->
    <nav
      class="flex items-center bg-surface-raised/80 backdrop-blur-md border-t border-border/40 pb-safe"
      aria-label="Navigazione principale"
    >
      <!-- Region chip -->
      <button
        type="button"
        (click)="openRegionSheet()"
        class="flex items-center gap-1.5 px-3 py-3 min-h-13 text-xs text-text-secondary active:bg-surface-inset transition-colors"
        aria-label="Cambia regione: {{ currentRegion().name }}"
      >
        <svg lucideMapPin class="w-4 h-4 shrink-0" aria-hidden="true"></svg>
        <span class="truncate max-w-20">{{ currentRegion().name }}</span>
        <svg lucideChevronDown class="w-3 h-3 shrink-0" strokeWidth="2" aria-hidden="true"></svg>
      </button>

      <!-- Divider -->
      <div class="w-px h-6 bg-border" aria-hidden="true"></div>

      <!-- Primary nav tabs — shared with the desktop sidebar via NAV_ITEMS -->
      @for (item of navItems; track item.route) {
        <a
          [routerLink]="item.route"
          routerLinkActive="text-primary"
          [routerLinkActiveOptions]="{ exact: item.exact }"
          class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-13 text-text-secondary transition-colors active:bg-surface-inset"
        >
          @switch (item.icon) {
            @case ('chat') {
              <svg lucideMessageCircle class="w-5 h-5" aria-hidden="true"></svg>
            }
            @case ('italiapedia') {
              <svg lucideCompass class="w-5 h-5" aria-hidden="true"></svg>
            }
            @case ('saved') {
              <svg lucideBookmark class="w-5 h-5" aria-hidden="true"></svg>
            }
          }
          <span class="text-[10px] font-medium">{{ item.mobileLabel }}</span>
        </a>
      }
    </nav>

    <!-- Region bottom sheet -->
    <app-region-bottom-sheet
      [isOpen]="isRegionSheetOpen()"
      (closed)="closeRegionSheet()"
      (regionSelected)="closeRegionSheet()"
    />
  `,
})
export class BottomTabBarComponent {
  private readonly regionService = inject(RegionService);

  /** Exposed so the template can read bridge signals directly. */
  readonly bridge = inject(MobileChatBridgeService);

  readonly currentRegion = this.regionService.selectedRegion;
  readonly isRegionSheetOpen = signal(false);

  /** Primary nav — shared source of truth with the desktop sidebar. */
  readonly navItems: NavItem[] = NAV_ITEMS;

  openRegionSheet(): void {
    this.isRegionSheetOpen.set(true);
  }

  closeRegionSheet(): void {
    this.isRegionSheetOpen.set(false);
  }
}
