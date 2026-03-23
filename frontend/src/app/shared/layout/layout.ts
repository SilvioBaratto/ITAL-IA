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

  // Chat input bridging — mobile bottom bar communicates with chatbot
  showMobileChatInput = signal(false);
  mobileChatUserInput = signal('');
  mobileChatIsLoading = signal(false);

  private mobileSendCallback: ((text: string) => void) | null = null;
  private mobileInputChangeCallback: ((text: string) => void) | null = null;

  private resizeObserver?: ResizeObserver;

  ngOnInit() {
    this.checkScreenSize();
    this.initializeResizeObserver();
    this.initializeFocusManagement();
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    this.routerSub?.unsubscribe();
  }

  toggleSidebar() {
    this.isSidebarOpen.update((v) => !v);
  }

  closeSidebar() {
    this.isSidebarOpen.set(false);
  }

  // Chat input bridging methods
  registerMobileChatCallbacks(
    sendCb: (text: string) => void,
    inputChangeCb: (text: string) => void,
  ) {
    this.mobileSendCallback = sendCb;
    this.mobileInputChangeCallback = inputChangeCb;
  }

  unregisterMobileChatCallbacks() {
    this.mobileSendCallback = null;
    this.mobileInputChangeCallback = null;
  }

  onMobileChatSend(text: string) {
    this.mobileSendCallback?.(text);
  }

  onMobileChatInputChange(text: string) {
    this.mobileChatUserInput.set(text);
    this.mobileInputChangeCallback?.(text);
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
}
