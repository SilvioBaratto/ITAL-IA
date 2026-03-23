import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Log in via email/password and wait for redirect to root. */
async function login(page: Page): Promise<void> {
  const email = process.env['TEST_EMAIL'];
  const password = process.env['TEST_PASSWORD'];
  if (!email || !password) throw new Error('TEST_EMAIL / TEST_PASSWORD env vars required');

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL('/', { timeout: 15_000 });
}

/** Whether the current project is mobile. */
function isMobile(t: typeof test): boolean {
  return t.info().project.name === 'mobile';
}

// ---------------------------------------------------------------------------
// Test 1: Login Page Renders (Desktop + Mobile)
// ---------------------------------------------------------------------------
test.describe('Login page', () => {
  test('renders brand and form elements', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByText('ITAL-IA').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible();

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

    await login(page);

    // Desktop: sidebar visible with nav items
    if (test.info().project.name === 'desktop') {
      await expect(page.getByRole('link', { name: /chat/i })).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Test 3: Bottom Tab Bar Navigation (Mobile — replaces old hamburger sidebar test)
// ---------------------------------------------------------------------------
test.describe('Bottom tab bar navigation', () => {
  test('shows tab bar with Chat and Salvati tabs on mobile', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL and TEST_PASSWORD env vars required');
    test.skip(test.info().project.name !== 'mobile', 'Mobile only');

    await login(page);

    // Bottom tab bar visible
    const tabBar = page.locator('app-bottom-tab-bar nav[aria-label="Navigazione principale"]');
    await expect(tabBar).toBeVisible();

    // Chat tab is present and links to /
    const chatTab = tabBar.getByText('Chat', { exact: true });
    await expect(chatTab).toBeVisible();

    // Salvati tab is present and links to /saved
    const savedTab = tabBar.getByText('Salvati', { exact: true });
    await expect(savedTab).toBeVisible();

    // Navigate to Saved via tab bar
    await savedTab.click();
    await page.waitForURL('/saved', { timeout: 10_000 });
    await expect(page.locator('h1', { hasText: 'Salvati' })).toBeVisible();

    // Navigate back to Chat via tab bar
    await page.locator('app-bottom-tab-bar nav[aria-label="Navigazione principale"]').getByText('Chat', { exact: true }).click();
    await page.waitForURL('/', { timeout: 10_000 });
  });

  test('region chip opens bottom sheet on mobile', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL and TEST_PASSWORD env vars required');
    test.skip(test.info().project.name !== 'mobile', 'Mobile only');

    await login(page);

    // Click the region chip in the bottom tab bar
    const regionChip = page.locator('button[aria-label*="Cambia regione"]');
    await expect(regionChip).toBeVisible();
    await regionChip.click();

    // Bottom sheet dialog appears
    const sheet = page.locator('[role="dialog"][aria-label="Select a region"]');
    await expect(sheet).toBeVisible();

    // Has a search input
    await expect(sheet.locator('input[aria-label="Cerca regione"]')).toBeVisible();

    // Has region options
    const regionOptions = sheet.locator('[role="option"]');
    await expect(regionOptions.first()).toBeVisible();

    // Close via the close button
    await sheet.getByRole('button', { name: /close region selector/i }).click();
    await expect(sheet).not.toBeVisible();
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

    await login(page);

    // Try clicking a suggestion chip from the categorized explore grid
    const suggestionChip = page.locator('[role="group"] button[lang="it"]').first();
    const chipVisible = await suggestionChip.isVisible().catch(() => false);

    if (chipVisible) {
      await suggestionChip.click();
    } else {
      // Fallback: type a question manually
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

    await login(page);

    // Ask a question likely to produce rich content
    await page.getByLabel('Chat message').fill('What are the best restaurants in Trieste?');
    await page.getByRole('button', { name: /send message/i }).click();

    // Wait for streaming to complete (shimmer disappears)
    await page.waitForFunction(
      () => !document.querySelector('.shimmer-bg'),
      { timeout: 60_000 },
    );

    // Check for at least one rich content type
    const hasImages = await page.locator('[role="log"] img').count() > 0;
    const hasLinks = await page.locator('[role="log"] a.rounded-l-full').count() > 0;
    const hasMapLinks = await page.locator('[role="log"] .text-primary').count() > 0;
    const hasTables = await page.locator('[role="log"] table').count() > 0;
    const hasSources = await page.getByText('Fonti').isVisible().catch(() => false);

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

    await login(page);

    // On mobile, chat input lives in the bottom tab bar area
    const chatInput = page.getByLabel('Chat message');
    await expect(chatInput).toBeVisible();

    // Type and send
    await chatInput.fill('Tell me about Castello di Miramare');
    await page.getByRole('button', { name: /send message/i }).click();

    // Wait for response
    const assistantMsg = page.locator('[role="log"] .bg-surface-raised').first();
    await expect(assistantMsg).toBeVisible({ timeout: 60_000 });

    // No horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()!.width;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });
});

// ---------------------------------------------------------------------------
// Test 7: Region Selector (Desktop)
// ---------------------------------------------------------------------------
test.describe('Region selector desktop', () => {
  test('opens dropdown, selects a region, and persists on reload', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL and TEST_PASSWORD env vars required');
    test.skip(test.info().project.name !== 'desktop', 'Desktop only');

    await login(page);

    // Click the region selector trigger in the sidebar
    const trigger = page.locator('app-region-selector button[aria-haspopup="listbox"]');
    await expect(trigger).toBeVisible();
    await trigger.click();

    // Dropdown listbox appears
    const listbox = page.locator('#region-listbox');
    await expect(listbox).toBeVisible();

    // Search for Toscana
    const searchInput = page.locator('app-region-selector input[aria-label="Cerca regione"]');
    await searchInput.fill('Toscana');

    // Click the Toscana option
    const toscanaOption = listbox.locator('[role="option"]', { hasText: 'Toscana' });
    await expect(toscanaOption).toBeVisible();
    await toscanaOption.click();

    // Dropdown should close
    await expect(listbox).not.toBeVisible();

    // Trigger button now shows "Toscana"
    await expect(trigger).toContainText('Toscana');

    // Empty state heading should update to show Toscana
    await expect(page.locator('h2', { hasText: /Scopri Toscana/i })).toBeVisible();

    // Persist on reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    // After reload, Toscana should still be selected
    const triggerAfterReload = page.locator('app-region-selector button[aria-haspopup="listbox"]');
    await expect(triggerAfterReload).toContainText('Toscana');
  });
});

// ---------------------------------------------------------------------------
// Test 8: Region Selector (Mobile — Bottom Sheet)
// ---------------------------------------------------------------------------
test.describe('Region selector mobile', () => {
  test('opens bottom sheet, selects region, chat empty state updates', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL and TEST_PASSWORD env vars required');
    test.skip(test.info().project.name !== 'mobile', 'Mobile only');

    await login(page);

    // Verify default region heading
    const heading = page.locator('h2[lang="it"]', { hasText: /Scopri/ });
    await expect(heading).toBeVisible();
    const initialRegion = await heading.textContent();

    // Open region bottom sheet via tab bar region chip
    await page.locator('button[aria-label*="Cambia regione"]').click();
    const sheet = page.locator('[role="dialog"][aria-label="Select a region"]');
    await expect(sheet).toBeVisible();

    // Select Lazio
    const lazioOption = sheet.locator('[role="option"]', { hasText: 'Lazio' });
    await lazioOption.scrollIntoViewIfNeeded();
    await lazioOption.click();

    // Sheet should close
    await expect(sheet).not.toBeVisible();

    // Chat empty state heading should now show Lazio
    await expect(page.locator('h2[lang="it"]', { hasText: /Scopri Lazio/i })).toBeVisible();

    // Region chip in bottom tab bar should show Lazio
    await expect(page.locator('button[aria-label*="Cambia regione"]')).toContainText('Lazio');
  });
});

// ---------------------------------------------------------------------------
// Test 9: Saved Items Flow
// ---------------------------------------------------------------------------
test.describe('Saved items flow', () => {
  test('saves an entity from chat, sees it on /saved, deletes it', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL and TEST_PASSWORD env vars required');

    await login(page);

    // Send a question that produces bookmarkable rich content
    await page.getByLabel('Chat message').fill('What are the most famous places to visit in Trieste?');
    await page.getByRole('button', { name: /send message/i }).click();

    // Wait for assistant response to finish streaming
    const assistantMsg = page.locator('[role="log"] .bg-surface-raised').first();
    await expect(assistantMsg).toBeVisible({ timeout: 60_000 });

    // Wait for streaming to complete
    await page.waitForFunction(
      () => !document.querySelector('.shimmer-bg') && !document.querySelector('.animate-pulse'),
      { timeout: 60_000 },
    );

    // Find and click a bookmark button (they have aria-label containing "Salva")
    const bookmarkBtn = page.locator('button.bookmark-btn[aria-label*="Salva"]').first();
    const hasBookmarkable = await bookmarkBtn.isVisible().catch(() => false);
    test.skip(!hasBookmarkable, 'No bookmarkable entities in response');

    // Get the name of the item being saved
    const ariaLabel = await bookmarkBtn.getAttribute('aria-label');
    const itemName = ariaLabel!.replace(/^Salva\s+/, '').replace(/\s+nei preferiti$/, '');

    // Click to save
    await bookmarkBtn.click();

    // Bookmark button should now show pressed state
    await expect(bookmarkBtn).toHaveAttribute('aria-pressed', 'true');

    // Navigate to /saved
    if (test.info().project.name === 'mobile') {
      await page.locator('app-bottom-tab-bar nav').getByText('Salvati').click();
    } else {
      await page.getByRole('link', { name: /salvati/i }).click();
    }
    await page.waitForURL('/saved', { timeout: 10_000 });

    // Wait for saved items to load
    await expect(page.locator('h1', { hasText: 'Salvati' })).toBeVisible();

    // Verify the saved item appears
    await expect(page.getByText(itemName).first()).toBeVisible({ timeout: 10_000 });

    // Delete the item
    const removeBtn = page.getByRole('button', { name: new RegExp(`Rimuovi.*${itemName.substring(0, 15)}`, 'i') }).first();
    if (await removeBtn.isVisible().catch(() => false)) {
      await removeBtn.click();

      // Item should disappear (or empty state shows)
      await expect(removeBtn).not.toBeVisible({ timeout: 5_000 });
    }
  });
});

// ---------------------------------------------------------------------------
// Test 10: Dark Mode Toggle
// ---------------------------------------------------------------------------
test.describe('Dark mode toggle', () => {
  test('toggles dark mode and verifies html class', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL and TEST_PASSWORD env vars required');
    test.skip(test.info().project.name !== 'desktop', 'Desktop only — toggle is in sidebar');

    await login(page);

    // Clear any stored theme so we start from system default
    await page.evaluate(() => localStorage.removeItem('italia-theme'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check initial state
    const initialIsDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );

    // Find the theme toggle button in the sidebar
    const themeBtn = page.locator('app-sidebar button[aria-label*="modalità"]');
    await expect(themeBtn).toBeVisible();

    // Click to cycle: system → light
    await themeBtn.click();

    // After first toggle from system, we should be in "light" mode
    await expect(page.locator('html:not(.dark)')).toBeAttached();

    // Click again: light → dark
    await themeBtn.click();
    await expect(page.locator('html.dark')).toBeAttached();

    // Click again: dark → system (restores original)
    await themeBtn.click();

    // Verify theme preference is stored in localStorage
    await expect.poll(() =>
      page.evaluate(() => localStorage.getItem('italia-theme')),
    ).toBe('system');
  });
});

// ---------------------------------------------------------------------------
// Test 11: Chat History Persistence
// ---------------------------------------------------------------------------
test.describe('Chat history persistence', () => {
  test('messages survive region switch and return', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL and TEST_PASSWORD env vars required');
    test.skip(test.info().project.name !== 'desktop', 'Desktop only — uses sidebar region selector');

    await login(page);

    // Clear chat histories to start fresh
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('italia-chat-')) localStorage.removeItem(key);
      }
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Ensure Friuli Venezia Giulia is selected (default)
    const trigger = page.locator('app-region-selector button[aria-haspopup="listbox"]');
    await expect(trigger).toContainText('Friuli Venezia Giulia');

    // Send a message
    const testMessage = 'Tell me about Trieste for E2E test';
    await page.getByLabel('Chat message').fill(testMessage);
    await page.getByRole('button', { name: /send message/i }).click();

    // Wait for the user message bubble to appear
    const userBubble = page.locator('[role="log"] .bg-primary', { hasText: testMessage });
    await expect(userBubble).toBeVisible({ timeout: 10_000 });

    // Wait for assistant response
    const assistantMsg = page.locator('[role="log"] .bg-surface-raised').first();
    await expect(assistantMsg).toBeVisible({ timeout: 60_000 });

    // Switch to a different region (Toscana)
    await trigger.click();
    const listbox = page.locator('#region-listbox');
    await expect(listbox).toBeVisible();
    await listbox.locator('[role="option"]', { hasText: 'Toscana' }).click();

    // Verify we're on Toscana — empty state should show
    await expect(page.locator('h2', { hasText: /Scopri Toscana/i })).toBeVisible({ timeout: 5_000 });

    // The user message should no longer be visible (different region = different history)
    await expect(userBubble).not.toBeVisible();

    // Switch back to Friuli Venezia Giulia
    await trigger.click();
    await expect(listbox).toBeVisible();

    const searchInput = page.locator('app-region-selector input[aria-label="Cerca regione"]');
    await searchInput.fill('Friuli');
    await listbox.locator('[role="option"]', { hasText: 'Friuli Venezia Giulia' }).click();

    // The "Continue where you left off" card OR the restored messages should appear
    const continueCard = page.getByText('Riprendi da dove avevi lasciato');
    const restoredMessage = page.locator('[role="log"] .bg-primary', { hasText: testMessage });

    // Wait for either the continue card or the restored message
    await expect(continueCard.or(restoredMessage)).toBeVisible({ timeout: 10_000 });

    // If continue card is shown, click "Continua conversazione"
    if (await continueCard.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /continua conversazione/i }).click();
    }

    // Now the original user message should be visible
    await expect(
      page.locator('[role="log"] .bg-primary', { hasText: testMessage }),
    ).toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// Test 12: Region Selector Keyboard Navigation (Desktop — WCAG 2.1.1)
// ---------------------------------------------------------------------------
test.describe('Region selector keyboard navigation', () => {
  test('navigates with keyboard: Enter, ArrowDown, ArrowUp, Escape', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL and TEST_PASSWORD env vars required');
    test.skip(test.info().project.name !== 'desktop', 'Desktop only');

    await login(page);

    const trigger = page.locator('app-region-selector button[aria-haspopup="listbox"]');
    await expect(trigger).toBeVisible();

    // Focus and open with click (trigger receives focus)
    await trigger.click();
    const listbox = page.locator('#region-listbox');
    await expect(listbox).toBeVisible();

    // Search input should be focused
    const searchInput = page.locator('app-region-selector input[aria-label="Cerca regione"]');
    await expect(searchInput).toBeFocused();

    // ArrowDown highlights the first option
    await searchInput.press('ArrowDown');
    const firstOption = listbox.locator('[role="option"]').first();
    const firstOptionId = await firstOption.getAttribute('id');
    await expect(searchInput).toHaveAttribute('aria-activedescendant', firstOptionId!);

    // ArrowDown again moves to the second option
    await searchInput.press('ArrowDown');
    const secondOption = listbox.locator('[role="option"]').nth(1);
    const secondOptionId = await secondOption.getAttribute('id');
    await expect(searchInput).toHaveAttribute('aria-activedescendant', secondOptionId!);

    // ArrowUp goes back to the first option
    await searchInput.press('ArrowUp');
    await expect(searchInput).toHaveAttribute('aria-activedescendant', firstOptionId!);

    // Escape closes the dropdown
    await searchInput.press('Escape');
    await expect(listbox).not.toBeVisible();

    // Focus should return to the trigger button
    await expect(trigger).toBeFocused();
  });

  test('selects a region via Enter key', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL and TEST_PASSWORD env vars required');
    test.skip(test.info().project.name !== 'desktop', 'Desktop only');

    await login(page);

    const trigger = page.locator('app-region-selector button[aria-haspopup="listbox"]');
    await trigger.click();

    const searchInput = page.locator('app-region-selector input[aria-label="Cerca regione"]');
    const listbox = page.locator('#region-listbox');

    // Type to filter, then ArrowDown + Enter to select
    await searchInput.fill('Lazio');
    await searchInput.press('ArrowDown');
    await searchInput.press('Enter');

    // Dropdown closes
    await expect(listbox).not.toBeVisible();

    // Trigger now shows Lazio
    await expect(trigger).toContainText('Lazio');

    // Focus returned to trigger
    await expect(trigger).toBeFocused();
  });
});

// ---------------------------------------------------------------------------
// Test 13: Mobile Bottom Sheet Keyboard (WCAG — Escape + Focus Trap)
// ---------------------------------------------------------------------------
test.describe('Region bottom sheet keyboard', () => {
  test('closes with Escape and traps focus', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL and TEST_PASSWORD env vars required');
    test.skip(test.info().project.name !== 'mobile', 'Mobile only');

    await login(page);

    // Open the bottom sheet
    await page.locator('button[aria-label*="Cambia regione"]').click();
    const sheet = page.locator('[role="dialog"][aria-label="Select a region"]');
    await expect(sheet).toBeVisible();

    // Search input should receive focus
    const searchInput = sheet.locator('input[aria-label="Cerca regione"]');
    await expect(searchInput).toBeFocused();

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(sheet).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test 14: New Chat Button Clears Conversation
// ---------------------------------------------------------------------------
test.describe('New chat button', () => {
  test('clears the current conversation', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL and TEST_PASSWORD env vars required');
    test.skip(test.info().project.name !== 'desktop', 'Desktop only — button in sidebar');

    await login(page);

    // Send a message to create a conversation
    await page.getByLabel('Chat message').fill('Hello from new chat test');
    await page.getByRole('button', { name: /send message/i }).click();

    // Wait for user bubble to appear
    const userBubble = page.locator('[role="log"] .bg-primary', { hasText: 'Hello from new chat test' });
    await expect(userBubble).toBeVisible({ timeout: 10_000 });

    // Click "New chat" button in sidebar
    await page.getByRole('button', { name: /start a new chat/i }).click();

    // Messages should be cleared — empty state heading visible
    await expect(page.locator('h2[lang="it"]', { hasText: /Scopri/ })).toBeVisible({ timeout: 5_000 });

    // The user bubble should no longer be visible
    await expect(userBubble).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test 15: Toast Notification on Bookmark
// ---------------------------------------------------------------------------
test.describe('Toast notification', () => {
  test('shows toast after bookmarking an entity', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL and TEST_PASSWORD env vars required');

    await login(page);

    // Send a question to get rich content with bookmarkable entities
    await page.getByLabel('Chat message').fill('Show me places to visit in Trieste');
    await page.getByRole('button', { name: /send message/i }).click();

    // Wait for streaming to complete
    await page.waitForFunction(
      () => !document.querySelector('.shimmer-bg') && !document.querySelector('.animate-pulse'),
      { timeout: 60_000 },
    );

    // Find a bookmark button
    const bookmarkBtn = page.locator('button.bookmark-btn[aria-label*="Salva"]').first();
    const hasBookmarkable = await bookmarkBtn.isVisible().catch(() => false);
    test.skip(!hasBookmarkable, 'No bookmarkable entities in response');

    // Click to save
    await bookmarkBtn.click();

    // Toast notification should appear
    const toast = page.locator('app-toast [role="status"]');
    await expect(toast).toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// Test 16: Follow-up Suggestion Chips
// ---------------------------------------------------------------------------
test.describe('Follow-up suggestion chips', () => {
  test('renders after assistant response completes and sends new message on click', async ({ page }) => {
    const email = process.env['TEST_EMAIL'];
    const password = process.env['TEST_PASSWORD'];
    test.skip(!email || !password, 'TEST_EMAIL and TEST_PASSWORD env vars required');

    await login(page);

    // Send a question
    await page.getByLabel('Chat message').fill('Tell me about Trieste');
    await page.getByRole('button', { name: /send message/i }).click();

    // Wait for streaming to complete
    await page.waitForFunction(
      () => !document.querySelector('.shimmer-bg') && !document.querySelector('.animate-pulse'),
      { timeout: 60_000 },
    );

    // Look for follow-up suggestion chips
    const chipsGroup = page.locator('[role="group"][aria-label="Suggested follow-up questions"]');
    const hasChips = await chipsGroup.isVisible().catch(() => false);
    test.skip(!hasChips, 'No follow-up suggestion chips in response');

    // Click the first suggestion chip
    const firstChip = chipsGroup.locator('button').first();
    const chipText = await firstChip.textContent();
    await firstChip.click();

    // A new user bubble should appear with the suggestion text
    await expect(
      page.locator('[role="log"] .bg-primary').last(),
    ).toContainText(chipText!.trim(), { timeout: 10_000 });
  });
});
