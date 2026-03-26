import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { RegionService } from '../../services/region.service';
import { MobileChatBridgeService } from '../../services/mobile-chat-bridge.service';
import { RegionBottomSheetComponent } from '../region-bottom-sheet/region-bottom-sheet';
import { ChatInputComponent } from '../chat-input/chat-input';

/**
 * Tracks scroll direction and translates the nav tab row off-screen on scroll
 * down, back into view on scroll up. The chat input section always stays
 * visible. Uses requestAnimationFrame for smooth updates and respects
 * prefers-reduced-motion.
 */
@Component({
  selector: 'app-bottom-tab-bar',
  imports: [RouterLink, RouterLinkActive, RegionBottomSheetComponent, ChatInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block md:hidden' },
  template: `
    <!-- Chat input (above tabs, only on chat page) — always visible -->
    @if (bridge.showInput()) {
      <div class="px-3 py-2 bg-surface border-t border-border">
        <app-chat-input
          [userInput]="bridge.userInput()"
          [isLoading]="bridge.isLoading()"
          (send)="bridge.send($event)"
          (inputChange)="bridge.notifyInputChange($event)" />
      </div>
    }

    <!-- Tab bar — hides on scroll down, reveals on scroll up -->
    <nav
      class="flex items-center bg-surface-raised border-t border-border pb-safe"
      [style.transform]="navTransform()"
      [style.transition]="navTransition()"
      aria-label="Navigazione principale">

      <!-- Region chip -->
      <button
        type="button"
        (click)="openRegionSheet()"
        class="flex items-center gap-1.5 px-3 py-3 min-h-[52px] text-xs text-text-secondary active:bg-surface-inset transition-colors"
        aria-label="Cambia regione: {{ currentRegion().name }}">
        <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
        </svg>
        <span class="truncate max-w-[80px]">{{ currentRegion().name }}</span>
        <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      <!-- Divider -->
      <div class="w-px h-6 bg-border" aria-hidden="true"></div>

      <!-- Chat tab -->
      <a
        routerLink="/"
        routerLinkActive="text-primary"
        [routerLinkActiveOptions]="{ exact: true }"
        class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] text-text-secondary transition-colors active:bg-surface-inset">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
        </svg>
        <span class="text-[10px] font-medium">Chat</span>
      </a>

      <!-- Saved tab -->
      <a
        routerLink="/saved"
        routerLinkActive="text-primary"
        class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] text-text-secondary transition-colors active:bg-surface-inset">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
        </svg>
        <span class="text-[10px] font-medium">Salvati</span>
      </a>
    </nav>

    <!-- Region bottom sheet -->
    <app-region-bottom-sheet
      [isOpen]="isRegionSheetOpen()"
      (closed)="closeRegionSheet()"
      (regionSelected)="closeRegionSheet()" />
  `,
})
export class BottomTabBarComponent implements OnInit, OnDestroy {
  private readonly regionService = inject(RegionService);
  private readonly platformId = inject(PLATFORM_ID);

  /** Exposed so the template can read bridge signals directly. */
  readonly bridge = inject(MobileChatBridgeService);

  readonly currentRegion = this.regionService.selectedRegion;
  readonly isRegionSheetOpen = signal(false);

  /** Whether the nav row is currently hidden (translated off-screen). */
  readonly isNavHidden = signal(false);

  /**
   * CSS transform applied to the nav row. Computed signal so OnPush change
   * detection picks it up automatically.
   */
  readonly navTransform = computed<string>(() =>
    this.isNavHidden() ? 'translateY(100%)' : 'translateY(0)',
  );

  /**
   * CSS transition value. Becomes 'none' when prefers-reduced-motion is
   * active; updated once after init via the reducedMotion signal.
   */
  readonly prefersReducedMotionSignal = signal(false);
  readonly navTransition = computed<string>(() =>
    this.prefersReducedMotionSignal()
      ? 'none'
      : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  );

  private readonly lastScrollYMap = new WeakMap<EventTarget, number>();
  private rafId: number | null = null;
  private pendingHide: boolean | null = null;

  /** Minimum scroll delta required before triggering a direction change. */
  private readonly SCROLL_THRESHOLD = 8;

  /** Always show the bar when scrolled this close to the top of the container. */
  private readonly NEAR_TOP_THRESHOLD = 10;

  /** Bound reference so we can remove the exact same listener on destroy. */
  private readonly boundScrollListener = this.onScrollCapture.bind(this);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.prefersReducedMotionSignal.set(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );

    // Capture phase so we receive scroll events from any scrollable child,
    // not just window scroll.
    document.addEventListener('scroll', this.boundScrollListener, {
      capture: true,
      passive: true,
    });
  }

  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.removeEventListener('scroll', this.boundScrollListener, { capture: true });
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
  }

  openRegionSheet(): void {
    this.isRegionSheetOpen.set(true);
  }

  closeRegionSheet(): void {
    this.isRegionSheetOpen.set(false);
  }

  private onScrollCapture(event: Event): void {
    // Ignore programmatic scrolls (e.g. chat auto-scroll while AI streams).
    // ChatbotComponent calls bridge.suppressNavAutoHide() before every
    // scrollToBottom(), which sets this flag for 150 ms.
    if (this.bridge.navAutoHideSuppressed()) return;

    const target = event.target as Element | Document;

    // Resolve the scrollTop of whatever element fired the event.
    const scrollY =
      target === document || target === document.documentElement
        ? window.scrollY
        : (target as Element).scrollTop ?? 0;

    // Track lastScrollY per scroll target to avoid cross-container interference.
    const lastY = this.lastScrollYMap.get(target) ?? scrollY;
    const delta = scrollY - lastY;
    this.lastScrollYMap.set(target, scrollY);

    // Always show when near the top regardless of scroll direction.
    // This is the recovery path after fast mobile momentum scrolling, where
    // deceleration events have small deltas (< threshold) and the bar would
    // otherwise stay hidden even after the user scrolls back up.
    if (scrollY <= this.NEAR_TOP_THRESHOLD) {
      if (this.pendingHide !== false) {
        this.pendingHide = false;
        if (this.rafId !== null) cancelAnimationFrame(this.rafId);
        this.rafId = requestAnimationFrame(() => {
          this.rafId = null;
          this.isNavHidden.set(false);
        });
      }
      return;
    }

    // Ignore tiny jitter.
    if (Math.abs(delta) < this.SCROLL_THRESHOLD) return;

    // Hide on scroll-down, show on scroll-up.
    const shouldHide = delta > 0;

    // Batch updates through rAF; only schedule a new frame if the intent changed.
    if (shouldHide === this.pendingHide) return;
    this.pendingHide = shouldHide;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }

    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.isNavHidden.set(this.pendingHide ?? false);
    });
  }
}
