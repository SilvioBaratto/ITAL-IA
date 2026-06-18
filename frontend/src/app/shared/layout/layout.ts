import { Component, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy, inject, ElementRef, viewChild, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { filter } from 'rxjs';
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly mainContent = viewChild<ElementRef<HTMLElement>>('mainContent');

  routeAnnouncement = signal('');
  currentPageTitle = signal('');

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
