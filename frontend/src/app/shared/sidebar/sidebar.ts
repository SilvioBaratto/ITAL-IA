import { Component, computed, input, output, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ChatHistoryService } from '../../services/chat-history.service';
import { RegionService } from '../../services/region.service';
import { ThemeService } from '../../services/theme.service';
import { RegionSelectorComponent } from '../region-selector/region-selector';

interface NavItem {
  name: string;
  route: string;
  icon: 'chat' | 'map' | 'bookmark';
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, RegionSelectorComponent],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);
  private readonly chatHistoryService = inject(ChatHistoryService);
  private readonly regionService = inject(RegionService);
  private readonly router = inject(Router);
  readonly themeService = inject(ThemeService);

  isOpen = input<boolean>(false);
  isMobile = input<boolean>(false);

  closeSidebar = output<void>();

  navItems: NavItem[] = [
    { name: 'Chat', route: '/', icon: 'chat' },
    { name: 'Salvati', route: '/saved', icon: 'bookmark' },
  ];

  showSidebar = computed(() => !this.isMobile() || this.isOpen());

  onNewChat() {
    this.chatHistoryService.clearHistory(this.regionService.selectedRegion().id);
    this.closeSidebar.emit();
  }

  onNavClick() {
    this.closeSidebar.emit();
  }

  onLogout() {
    this.authService.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
    this.closeSidebar.emit();
  }
}
