import type { Page } from '@playwright/test';

export const SUPABASE_URL = 'https://ijvklvrpaogxmslmullb.supabase.co';

export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqdmtsdnJwYW9neG1zbG11bGxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MjU5MDksImV4cCI6MjA4NjQwMTkwOX0.7NmVWkeaZxBxCB4W1hbF7RNAWWOH4gXB6bvGkqN8TWE';

// Supabase JS v2 stores the session under this localStorage key
export const SUPABASE_STORAGE_KEY = 'sb-ijvklvrpaogxmslmullb-auth-token';

/**
 * Authenticates by calling the Supabase REST API and injecting the resulting
 * session into localStorage. Bypasses the app's Google-only login UI.
 * After this call, the page is at '/' and fully authenticated.
 */
export async function loginViaApi(page: Page): Promise<void> {
  const email = process.env['TEST_EMAIL'];
  const password = process.env['TEST_PASSWORD'];
  if (!email || !password) throw new Error('TEST_EMAIL / TEST_PASSWORD env vars required');

  const res = await page.request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    data: { email, password },
  });

  if (!res.ok()) {
    throw new Error(`Supabase login failed: ${res.status()} — ${await res.text()}`);
  }

  const { access_token, refresh_token } = (await res.json()) as {
    access_token: string;
    refresh_token: string;
  };

  // Navigate to the app first so we are on the correct origin for localStorage.
  // guestGuard will allow /login since no session exists yet.
  await page.goto('/login');

  await page.evaluate(
    ({
      accessToken,
      refreshToken,
      storageKey,
    }: {
      accessToken: string;
      refreshToken: string;
      storageKey: string;
    }) => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }),
      );
    },
    { accessToken: access_token, refreshToken: refresh_token, storageKey: SUPABASE_STORAGE_KEY },
  );

  // Full page load — Angular picks up the injected session from localStorage.
  await page.goto('/');
  await page.waitForURL('/', { timeout: 15_000 });
}

/** Removes the Supabase session from localStorage to simulate an unauthenticated state. */
export async function clearSession(page: Page): Promise<void> {
  await page.evaluate((key: string) => {
    localStorage.removeItem(key);
  }, SUPABASE_STORAGE_KEY);
}
