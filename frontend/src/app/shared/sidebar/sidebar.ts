import { Component, computed, input, output, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MobileChatBridgeService } from '../../services/mobile-chat-bridge.service';
import { ThemeService } from '../../services/theme.service';
import { GeolocationService } from '../../services/geolocation.service';
import { RegionSelectorComponent } from '../region-selector/region-selector';
import { NavItem, NAV_ITEMS } from '../nav-item';
import {
  LucideX,
  LucidePlus,
  LucideMessageCircle,
  LucideBookmark,
  LucideBookOpen,
  LucideUser,
  LucideSun,
  LucideMoon,
  LucideLogOut,
  LucideLocate,
  LucideLoader,
} from '@lucide/angular';

@Component({
  selector: 'app-sidebar',
  imports: [
    RouterLink,
    RouterLinkActive,
    RegionSelectorComponent,
    LucideX,
    LucidePlus,
    LucideMessageCircle,
    LucideBookmark,
    LucideBookOpen,
    LucideUser,
    LucideSun,
    LucideMoon,
    LucideLogOut,
    LucideLocate,
    LucideLoader,
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);
  private readonly bridge = inject(MobileChatBridgeService);
  private readonly router = inject(Router);
  readonly themeService = inject(ThemeService);
  readonly geoService = inject(GeolocationService);

  isOpen = input<boolean>(false);
  isMobile = input<boolean>(false);

  closeSidebar = output<void>();

  readonly navItems: NavItem[] = NAV_ITEMS;

  showSidebar = computed(() => !this.isMobile() || this.isOpen());

  onNewChat() {
    this.bridge.resetRequested.update(v => v + 1);
    this.router.navigate(['/']);
    this.closeSidebar.emit();
  }

  onNavClick() {
    this.closeSidebar.emit();
  }

  async requestLocation(): Promise<void> {
    try {
      await this.geoService.getCurrentPosition();
    } catch {
      // permission/denied state is tracked on the service
    }
  }

  onLogout() {
    this.authService.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
    this.closeSidebar.emit();
  }
}
