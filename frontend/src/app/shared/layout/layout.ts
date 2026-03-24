import { Component, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy, inject, ElementRef, viewChild } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { filter, Subscription } from 'rxjs';
import { SidebarComponent } from '../sidebar/sidebar';
import { BottomTabBarComponent } from '../bottom-tab-bar/bottom-tab-bar';
import { ToastComponent } from '../toast/toast';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, SidebarComponent, BottomTabBarComponent, ToastComponent],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly titleService = inject(Title);
  private readonly mainContent = viewChild<ElementRef<HTMLElement>>('mainContent');
  private routerSub?: Subscription;

  routeAnnouncement = signal('');
  currentPageTitle = signal('');

  isSidebarOpen = signal(false);
  isMobile = signal(false);

  showOverlay = computed(() => this.isSidebarOpen() && this.isMobile());

  private resizeObserver?: ResizeObserver;

  // Arrow function field preserves `this` and keeps a stable reference for removeEventListener.
  // Intercepts clicks on the skip link (which lives in index.html, outside Angular's template)
  // and programmatically focuses #main-content once Angular has rendered it.
  private readonly skipLinkClickHandler = (event: MouseEvent): void => {
    const target = event.target as HTMLAnchorElement;
    if (target.getAttribute('href') === '#main-content') {
      event.preventDefault();
      this.mainContent()?.nativeElement.focus();
    }
  };

  ngOnInit() {
    this.checkScreenSize();
    this.initializeResizeObserver();
    this.initializeFocusManagement();
    this.initializeSkipLink();
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    this.routerSub?.unsubscribe();
    document.removeEventListener('click', this.skipLinkClickHandler);
  }

  toggleSidebar() {
    this.isSidebarOpen.update((v) => !v);
  }

  closeSidebar() {
    this.isSidebarOpen.set(false);
  }

  private checkScreenSize() {
    if (typeof window !== 'undefined') {
      const mobile = window.innerWidth < 768;
      this.isMobile.set(mobile);
      if (mobile) this.isSidebarOpen.set(false);
    }
  }

  private initializeFocusManagement() {
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
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

  private initializeSkipLink() {
    document.addEventListener('click', this.skipLinkClickHandler);
  }
}
