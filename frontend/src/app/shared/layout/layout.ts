import { Component, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy, inject, ElementRef, viewChild, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, NavigationEnd, RouterOutlet, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { filter } from 'rxjs';
import { SidebarComponent } from '../sidebar/sidebar';
import { BottomTabBarComponent } from '../bottom-tab-bar/bottom-tab-bar';
import { ToastComponent } from '../toast/toast';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';
import { LucideSun, LucideMoon, LucidePlus, LucideLocate, LucideLoader } from '@lucide/angular';
import { GeolocationService } from '../../services/geolocation.service';
import { MobileChatBridgeService } from '../../services/mobile-chat-bridge.service';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, SidebarComponent, BottomTabBarComponent, ToastComponent, LucideSun, LucideMoon, LucidePlus, LucideLocate, LucideLoader],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly titleService = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mainContent = viewChild<ElementRef<HTMLElement>>('mainContent');

  readonly themeService = inject(ThemeService);
  readonly geoService = inject(GeolocationService);
  private readonly authService = inject(AuthService);
  private readonly bridge = inject(MobileChatBridgeService);

  routeAnnouncement = signal('');
  currentPageTitle = signal('');

  /** 1–2 letter initials for the mobile profile avatar button. */
  readonly userInitials = computed(() => {
    const u = this.authService.currentUser();
    const meta = u?.user_metadata as Record<string, unknown> | undefined;
    const name = (meta?.['full_name'] ?? meta?.['name']) as string | undefined;
    const src = (name || u?.email || '').trim();
    if (!src) return '?';
    const parts = src.split(/[\s@.]+/).filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const second = parts.length > 1 ? (parts[1]?.[0] ?? '') : '';
    return (first + second).toUpperCase() || '?';
  });

  isSidebarOpen = signal(false);
  isMobile = signal(false);

  showOverlay = computed(() => this.isSidebarOpen() && this.isMobile());

  private resizeObserver?: ResizeObserver;

  ngOnInit() {
    this.checkScreenSize();
    this.initializeResizeObserver();
    this.initializeFocusManagement();
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
  }

  toggleSidebar() {
    this.isSidebarOpen.update((v) => !v);
  }

  closeSidebar() {
    this.isSidebarOpen.set(false);
  }

  /** Start a fresh chat from any page (shared mobile top bar). */
  newChat(): void {
    this.bridge.resetRequested.update((v) => v + 1);
    this.router.navigate(['/']);
  }

  async requestLocation(): Promise<void> {
    try {
      await this.geoService.getCurrentPosition();
    } catch {
      // permission/denied state is tracked on the service
    }
  }

  private checkScreenSize() {
    if (typeof window !== 'undefined') {
      const mobile = window.innerWidth < 768;
      this.isMobile.set(mobile);
      if (mobile) this.isSidebarOpen.set(false);
    }
  }

  private initializeFocusManagement() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.handleRouteChange());

    // Handle initial load — NavigationEnd may have already fired before ngOnInit
    setTimeout(() => this.handleRouteChange(), 150);
  }

  private handleRouteChange() {
    const title = this.titleService.getTitle();
    this.routeAnnouncement.set(`Navigated to ${title}`);
    this.currentPageTitle.set(title);
    this.mainContent()?.nativeElement.focus();
  }

  private initializeResizeObserver() {
    if (typeof window === 'undefined' || !('ResizeObserver' in window)) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const mobile = entry.contentRect.width < 768;
        this.isMobile.set(mobile);
        if (mobile && this.isSidebarOpen()) {
          this.isSidebarOpen.set(false);
        }
      }
    });
    this.resizeObserver.observe(document.body);
  }
}
