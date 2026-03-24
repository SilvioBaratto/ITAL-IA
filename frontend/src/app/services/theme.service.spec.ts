import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let changeHandler: ((e: Partial<MediaQueryListEvent>) => void) | null = null;

  function setup(options: { prefersDark?: boolean; storedTheme?: string | null } = {}): ThemeService {
    const { prefersDark = false, storedTheme = null } = options;
    changeHandler = null;

    const mockMQL = {
      matches: prefersDark,
      addEventListener: jasmine
        .createSpy('addEventListener')
        .and.callFake((_: string, fn: (e: Partial<MediaQueryListEvent>) => void) => {
          changeHandler = fn;
        }),
      removeEventListener: jasmine.createSpy('removeEventListener'),
    };

    spyOn(window, 'matchMedia').and.returnValue(mockMQL as unknown as MediaQueryList);
    spyOn(localStorage, 'getItem').and.callFake((key: string) =>
      key === 'italia-theme' ? storedTheme : null,
    );
    spyOn(localStorage, 'setItem');

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    return TestBed.inject(ThemeService);
  }

  afterEach(() => {
    document.documentElement.classList.remove('dark', 'theme-transitioning');
  });

  it('defaults to system when no preference is stored', () => {
    const service = setup();
    expect(service.theme()).toBe('system');
  });

  it('isDark is false when theme=system and OS is not dark', () => {
    const service = setup({ prefersDark: false });
    expect(service.isDark()).toBe(false);
  });

  it('isDark is true when theme=system and OS prefers dark', () => {
    const service = setup({ prefersDark: true });
    expect(service.isDark()).toBe(true);
  });

  it('restores stored dark preference', () => {
    const service = setup({ storedTheme: 'dark' });
    expect(service.theme()).toBe('dark');
    expect(service.isDark()).toBe(true);
  });

  it('restores stored light preference and ignores OS dark mode', () => {
    const service = setup({ prefersDark: true, storedTheme: 'light' });
    expect(service.theme()).toBe('light');
    expect(service.isDark()).toBe(false);
  });

  it('falls back to system for an invalid stored value', () => {
    const service = setup({ storedTheme: 'invalid' });
    expect(service.theme()).toBe('system');
  });

  it('toggleTheme cycles system → light → dark → system', () => {
    const service = setup();
    expect(service.theme()).toBe('system');
    service.toggleTheme();
    expect(service.theme()).toBe('light');
    service.toggleTheme();
    expect(service.theme()).toBe('dark');
    service.toggleTheme();
    expect(service.theme()).toBe('system');
  });

  it('toggleTheme persists the new value to localStorage', () => {
    const service = setup();
    service.toggleTheme(); // system → light
    expect(localStorage.setItem).toHaveBeenCalledWith('italia-theme', 'light');
  });

  it('toggleTheme adds theme-transitioning class and removes it after 150ms', () => {
    jasmine.clock().install();
    try {
      const service = setup();
      service.toggleTheme();
      expect(document.documentElement.classList.contains('theme-transitioning')).toBeTrue();
      jasmine.clock().tick(150);
      expect(document.documentElement.classList.contains('theme-transitioning')).toBeFalse();
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('effect adds dark class to documentElement when isDark is true', () => {
    setup({ storedTheme: 'dark' });
    TestBed.flushEffects();
    expect(document.documentElement.classList.contains('dark')).toBeTrue();
  });

  it('effect removes dark class from documentElement when isDark is false', () => {
    document.documentElement.classList.add('dark'); // pre-existing class
    setup({ storedTheme: 'light' });
    TestBed.flushEffects();
    expect(document.documentElement.classList.contains('dark')).toBeFalse();
  });

  it('OS media query change updates isDark when theme is system', () => {
    const service = setup({ prefersDark: false });
    expect(service.isDark()).toBe(false);
    changeHandler?.({ matches: true } as Partial<MediaQueryListEvent>);
    expect(service.isDark()).toBe(true);
  });

  it('OS media query change has no effect when theme is explicitly set to light', () => {
    const service = setup({ prefersDark: false, storedTheme: 'light' });
    changeHandler?.({ matches: true } as Partial<MediaQueryListEvent>);
    expect(service.isDark()).toBe(false); // light override wins
  });
});
