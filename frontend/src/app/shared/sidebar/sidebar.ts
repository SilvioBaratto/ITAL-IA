import { Component, computed, input, output, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface NavItem {
  name: string;
  route: string;
  icon: 'chat' | 'map';
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  isOpen = input<boolean>(false);
  isMobile = input<boolean>(false);

  closeSidebar = output<void>();

  navItems: NavItem[] = [
    { name: 'Chat', route: '/', icon: 'chat' },
  ];

  showSidebar = computed(() => !this.isMobile() || this.isOpen());

  onNavClick() {
    this.closeSidebar.emit();
  }

  onLogout() {
    this.authService.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
    this.closeSidebar.emit();
  }
}
