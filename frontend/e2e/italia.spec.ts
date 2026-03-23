import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Test 1: Login Page Renders (Desktop + Mobile)
// ---------------------------------------------------------------------------
test.describe('Login page', () => {
  test('renders brand and form elements', async ({ page }) => {
    await page.goto('/login');

    // Brand visible
    await expect(page.getByText('ITAL-IA').first()).toBeVisible();

    // Form elements
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible();

    // Screenshot
    await page.screenshot({ path: `e2e-screenshots/login-${test.info().project.name}.png` });
  });
});

// ---------------------------------------------------------------------------
// Test 2: Login Flow
// ---------------------------------------------------------------------------
test.describe('Login flow', () => {
  test('signs in and redirects to chatbot', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL and TEST_PASSWORD env vars required');

    await page.goto('/login');
    await page.getByLabel('Email').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: /^sign in$/i }).click();

    // Should redirect to chatbot (root)
    await page.waitForURL('/', { timeout: 15_000 });

    // Desktop: sidebar visible with nav items
    if (test.info().project.name === 'desktop') {
      await expect(page.getByRole('link', { name: /chat/i })).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Test 3: Responsive Sidebar (Mobile)
// ---------------------------------------------------------------------------
test.describe('Responsive sidebar', () => {
  test('hamburger toggles sidebar on mobile', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL and TEST_PASSWORD env vars required');
    test.skip(test.info().project.name !== 'mobile', 'Mobile only');

    await page.goto('/login');
    await page.getByLabel('Email').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL('/', { timeout: 15_000 });

    // Sidebar hidden by default on mobile
    const sidebar = page.locator('app-sidebar aside');
    await expect(sidebar).toHaveClass(/-translate-x-full/);

    // Open sidebar via hamburger
    await page.getByRole('button', { name: /open menu/i }).click();
    await expect(sidebar).toHaveClass(/translate-x-0/);

    // Click Chat link
    await page.getByRole('link', { name: /chat/i }).click();
    await page.waitForURL('/', { timeout: 10_000 });

    // Sidebar should close
    await expect(sidebar).toHaveClass(/-translate-x-full/);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Chatbot — Ask a Question
// ---------------------------------------------------------------------------
test.describe('Chatbot interaction', () => {
  test('sends a question and receives a response', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL and TEST_PASSWORD env vars required');

    await page.goto('/login');
    await page.getByLabel('Email').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL('/', { timeout: 15_000 });

    // Click a suggested quick-prompt button OR type a question
    const quickPrompt = page.getByRole('button', { name: /Top things in Trieste/i });
    if (await quickPrompt.isVisible()) {
      await quickPrompt.click();
    } else {
      await page.getByLabel('Chat message').fill('What are the top things to see in Trieste?');
      await page.getByRole('button', { name: /send message/i }).click();
    }

    // Wait for assistant response (streaming may take a while)
    const assistantMsg = page.locator('[role="log"] .bg-surface-raised').first();
    await expect(assistantMsg).toBeVisible({ timeout: 60_000 });

    // Verify it has text content
    const text = await assistantMsg.textContent();
    expect(text!.length).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// Test 5: Chatbot — Markdown/Rich Content Check
// ---------------------------------------------------------------------------
test.describe('Chatbot rich content', () => {
  test('renders rich content elements', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL and TEST_PASSWORD env vars required');

    await page.goto('/login');
    await page.getByLabel('Email').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL('/', { timeout: 15_000 });

    // Ask a question likely to produce rich content
    await page.getByLabel('Chat message').fill('What are the best restaurants in Trieste?');
    await page.getByRole('button', { name: /send message/i }).click();

    // Wait for streaming to complete (loading indicator disappears)
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 60_000 },
    );

    // Check for at least one rich content type
    const hasImages = await page.locator('[role="log"] img').count() > 0;
    const hasLinks = await page.locator('[role="log"] a.rounded-full').count() > 0;
    const hasMapLinks = await page.locator('[role="log"] a .text-primary').count() > 0;
    const hasTables = await page.locator('[role="log"] table').count() > 0;
    const hasSources = await page.getByText('Sources:').isVisible().catch(() => false);

    // At least one type of rich content should be present
    expect(hasImages || hasLinks || hasMapLinks || hasTables || hasSources).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 6: Chatbot Mobile Responsiveness
// ---------------------------------------------------------------------------
test.describe('Chatbot mobile', () => {
  test('input and messages are responsive', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL and TEST_PASSWORD env vars required');
    test.skip(test.info().project.name !== 'mobile', 'Mobile only');

    await page.goto('/login');
    await page.getByLabel('Email').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL('/', { timeout: 15_000 });

    // Input area visible
    await expect(page.getByLabel('Chat message')).toBeVisible();

    // Type and send
    await page.getByLabel('Chat message').fill('Tell me about Castello di Miramare');
    await page.getByRole('button', { name: /send message/i }).click();

    // Wait for response
    const assistantMsg = page.locator('[role="log"] .bg-surface-raised').first();
    await expect(assistantMsg).toBeVisible({ timeout: 60_000 });

    // No horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()!.width;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);

    // Message bubbles don't overflow
    const bubbles = page.locator('[role="log"] .max-w-\\[80\\%\\]');
    const count = await bubbles.count();
    for (let i = 0; i < count; i++) {
      const box = await bubbles.nth(i).boundingBox();
      if (box) {
        expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth + 1);
      }
    }
  });
});
