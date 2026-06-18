/**
 * Primary navigation — single source of truth shared by the desktop sidebar
 * and the mobile bottom-tab-bar, so the two surfaces cannot drift out of sync
 * (previously each hardcoded its own list and had already diverged).
 *
 * Routes + which entries exist live here. Each surface keeps its own *label*
 * and *glyph* per entry — the desktop sidebar shows "Italiapedia" with a
 * book-open icon, the mobile bar shows the shorter "Esplora" with a compass —
 * because those are presentation choices, while the route set must stay shared.
 */
export type NavIcon = 'chat' | 'italiapedia' | 'saved';

export interface NavItem {
  /** Router path. */
  route: string;
  /** Match the active route exactly (only the chat root '/' needs this). */
  exact: boolean;
  /** Semantic icon key — each surface maps it to its own lucide glyph. */
  icon: NavIcon;
  /** Label shown in the desktop sidebar. */
  sidebarLabel: string;
  /** Shorter label shown in the mobile bottom-tab-bar. */
  mobileLabel: string;
}

export const NAV_ITEMS: NavItem[] = [
  { route: '/',            exact: true,  icon: 'chat',        sidebarLabel: 'Chat',        mobileLabel: 'Chat' },
  { route: '/italiapedia', exact: false, icon: 'italiapedia', sidebarLabel: 'Italiapedia', mobileLabel: 'Esplora' },
  { route: '/saved',       exact: false, icon: 'saved',       sidebarLabel: 'Salvati',     mobileLabel: 'Salvati' },
];
