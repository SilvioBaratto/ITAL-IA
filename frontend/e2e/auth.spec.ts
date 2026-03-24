import { test, expect } from '@playwright/test';
import { loginViaApi, SUPABASE_STORAGE_KEY } from './helpers/auth';

// ---------------------------------------------------------------------------
// Test 17: Signup Flow
// ---------------------------------------------------------------------------
test.describe('Signup flow', () => {
  test('signup route not yet implemented', async ({ page: _page }) => {
    test.skip(true, 'Signup route /auth/signup not yet implemented — requires issue #32');
  });
});

// ---------------------------------------------------------------------------
// Test 18: Forgot Password Flow
// ---------------------------------------------------------------------------
test.describe('Forgot password flow', () => {
  test('renders form, submits email, and shows confirmation message', async ({ page }) => {
    // Mock the Supabase recover endpoint to avoid real emails and rate limits
    await page.route(/\/auth\/v1\/recover/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/auth/forgot-password');

    await expect(page.locator('h1', { hasText: 'Reset password' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();

    await page.getByLabel('Email').fill('test@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    // Success state — form replaces with confirmation message
    await expect(
      page.getByText('Check your email for a reset link.'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: /send reset link/i })).not.toBeVisible();
  });

  test('guestGuard redirects authenticated user to home', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL / TEST_PASSWORD env vars required');

    await loginViaApi(page);
    await page.goto('/auth/forgot-password');
    await page.waitForURL('/', { timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Test 19: Update Password Flow
// ---------------------------------------------------------------------------
test.describe('Update password flow', () => {
  test('shows form when user is authenticated', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL / TEST_PASSWORD env vars required');

    await loginViaApi(page);
    await page.goto('/auth/update-password');

    // Authenticated users can use the form — condition is !isPasswordRecovery() && !isAuthenticated()
    await expect(page.locator('h1', { hasText: 'Update password' })).toBeVisible();
    await expect(page.getByLabel('New password')).toBeVisible();
    await expect(page.getByLabel('Confirm password')).toBeVisible();
    await expect(page.getByRole('button', { name: /update password/i })).toBeVisible();
  });

  test('shows error when passwords do not match', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL / TEST_PASSWORD env vars required');

    await loginViaApi(page);
    await page.goto('/auth/update-password');

    await page.getByLabel('New password').fill('Password123!');
    await page.getByLabel('Confirm password').fill('DifferentPassword!');
    await page.getByRole('button', { name: /update password/i }).click();

    await expect(page.getByText('Passwords do not match.')).toBeVisible();
  });

  test('shows success message and redirects to home after update', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL / TEST_PASSWORD env vars required');

    await loginViaApi(page);

    // Mock the Supabase updateUser endpoint — avoids actually changing the password
    await page.route(/\/auth\/v1\/user$/, async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'mock-user-id', email }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/auth/update-password');

    const newPassword = `TestPass${Date.now()}!`;
    await page.getByLabel('New password').fill(newPassword);
    await page.getByLabel('Confirm password').fill(newPassword);
    await page.getByRole('button', { name: /update password/i }).click();

    await expect(page.getByText('Password updated successfully.')).toBeVisible({ timeout: 5_000 });
    // Component auto-redirects to / after 2 s
    await page.waitForURL('/', { timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// Test 20: Direct URL to /auth/update-password Without Recovery Session
// ---------------------------------------------------------------------------
test.describe('Update password without recovery session', () => {
  test('shows no-session error when visiting directly without auth', async ({ page }) => {
    // Navigate first to establish the origin, then clear any leftover session and reload
    await page.goto('/auth/update-password');
    await page.evaluate((key: string) => localStorage.removeItem(key), SUPABASE_STORAGE_KEY);
    await page.reload();

    await expect(
      page.getByText('No password recovery session found.'),
    ).toBeVisible({ timeout: 5_000 });
    // Link to reset-password page is present
    await expect(page.getByRole('link', { name: /reset password/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test 21: Logout → Re-Login Flow
// ---------------------------------------------------------------------------
test.describe('Logout and re-login flow', () => {
  test('logout clears session, then re-login restores access', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL / TEST_PASSWORD env vars required');
    test.skip(test.info().project.name !== 'desktop', 'Desktop only — logout button in sidebar');

    await loginViaApi(page);
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();

    // Click the sidebar logout button
    await page.getByRole('button', { name: /sign out/i }).click();
    await page.waitForURL('/login', { timeout: 10_000 });

    // Supabase session must be cleared from localStorage
    const storedSession = await page.evaluate(
      (key: string) => localStorage.getItem(key),
      SUPABASE_STORAGE_KEY,
    );
    expect(storedSession).toBeNull();

    // Login page renders
    await expect(page.getByText('ITAL-IA').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible();

    // Re-login via API — verifies the session flow works end-to-end after logout
    await loginViaApi(page);
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test 22: Protected Route Access Without Auth (authGuard)
// ---------------------------------------------------------------------------
test.describe('Protected route access without auth', () => {
  test('redirects to /login with returnUrl when accessing /saved unauthenticated', async ({
    page,
  }) => {
    // Fresh browser context — no localStorage session
    await page.goto('/saved');
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(new URL(page.url()).searchParams.get('returnUrl')).toBe('/saved');
  });

  test('redirects to /login with returnUrl when accessing /profile unauthenticated', async ({
    page,
  }) => {
    await page.goto('/profile');
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(new URL(page.url()).searchParams.get('returnUrl')).toBe('/profile');
  });

  test('allows access to protected route after authentication', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL / TEST_PASSWORD env vars required');

    // Confirm the redirect happens first
    await page.goto('/saved');
    await page.waitForURL(/\/login\?returnUrl=/, { timeout: 10_000 });

    // Authenticate and navigate directly to the protected route
    await loginViaApi(page);
    await page.goto('/saved');
    await page.waitForURL('/saved', { timeout: 10_000 });
    await expect(page.locator('h1', { hasText: 'Salvati' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test 23: 401 Mid-Session Handling (token expiry → auto-refresh → retry)
// ---------------------------------------------------------------------------
test.describe('401 mid-session token refresh', () => {
  test('interceptor refreshes token and retries the failed request', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL / TEST_PASSWORD env vars required');

    await loginViaApi(page);

    let savedItemsCallCount = 0;
    let refreshCalled = false;

    // Mock token refresh — returns a new mock session
    await page.route(/\/auth\/v1\/token\?grant_type=refresh_token/, async (route) => {
      refreshCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'new_mock_access_token',
          refresh_token: 'new_mock_refresh_token',
          token_type: 'bearer',
          expires_in: 3600,
          user: { id: 'mock-user-id', email },
        }),
      });
    });

    // Mock saved-items API: 401 on first call, success on retry
    await page.route(/\/api\/v1\/saved-items/, async (route) => {
      savedItemsCallCount++;
      if (savedItemsCallCount === 1) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Unauthorized' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], total: 0, page: 1, limit: 20 }),
        });
      }
    });

    await page.goto('/saved');
    await page.waitForURL('/saved', { timeout: 10_000 });
    await expect(page.locator('h1', { hasText: 'Salvati' })).toBeVisible({ timeout: 10_000 });

    expect(refreshCalled).toBe(true);
    expect(savedItemsCallCount).toBe(2);
  });

  test('redirects to /login when token refresh fails', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL / TEST_PASSWORD env vars required');

    await loginViaApi(page);

    // Mock token refresh to fail
    await page.route(/\/auth\/v1\/token\?grant_type=refresh_token/, async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'Token is expired' }),
      });
    });

    // Mock Supabase signOut so logout completes quickly
    await page.route(/\/auth\/v1\/logout/, async (route) => {
      await route.fulfill({ status: 204, body: '' });
    });

    // Mock all backend API calls with 401
    await page.route(/\/api\/v1\//, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized' }),
      });
    });

    await page.goto('/saved');
    await page.waitForURL(/\/login/, { timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// Test 24: Guest Guard — Authenticated Users Redirected From Auth Pages
// ---------------------------------------------------------------------------
test.describe('Guest guard redirects authenticated users', () => {
  test('redirects from /login to / when already authenticated', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL / TEST_PASSWORD env vars required');

    await loginViaApi(page);
    await page.goto('/login');
    await page.waitForURL('/', { timeout: 10_000 });
  });

  test('redirects from /auth/forgot-password to / when already authenticated', async ({
    page,
  }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL / TEST_PASSWORD env vars required');

    await loginViaApi(page);
    await page.goto('/auth/forgot-password');
    await page.waitForURL('/', { timeout: 10_000 });
  });
});
