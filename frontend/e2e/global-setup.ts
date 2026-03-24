import { chromium, type FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { loginViaApi } from './helpers/auth';

const AUTH_FILE = path.join(__dirname, '.auth', 'user.json');

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const email = process.env['TEST_EMAIL'];
  const password = process.env['TEST_PASSWORD'];

  if (!email || !password) {
    // No credentials — skip pre-auth setup; credential-dependent tests self-skip.
    return;
  }

  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: 'http://localhost:4200' });

  await loginViaApi(page);
  await page.context().storageState({ path: AUTH_FILE });
  await browser.close();
}
