import { Injectable, signal, computed, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'italia-theme';

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // localStorage unavailable (SSR, private mode)
  }
  return 'system';
}

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly osDark = signal(
    this.isBrowser ? window.matchMedia('(prefers-color-scheme: dark)').matches : false
  );

  readonly theme = signal<ThemePreference>(
    this.isBrowser ? readStoredPreference() : 'system'
  );

  readonly isDark = computed(() => {
    const preference = this.theme();
    if (preference === 'dark') return true;
    if (preference === 'light') return false;
    return this.osDark();
  });

  constructor() {
    effect(() => {
      this.applyTheme(this.isDark());
    });

    if (this.isBrowser) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', (e) => {
        this.osDark.set(e.matches);
      });
    }
  }

  toggleTheme(): void {
    const current = this.theme();
    const next: ThemePreference =
      current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system';

    if (this.isBrowser) {
      const html = document.documentElement;
      html.classList.add('theme-transitioning');
      setTimeout(() => html.classList.remove('theme-transitioning'), 150);
      localStorage.setItem(STORAGE_KEY, next);
    }

    this.theme.set(next);
  }

  private applyTheme(dark: boolean): void {
    if (!this.isBrowser) return;
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
}
