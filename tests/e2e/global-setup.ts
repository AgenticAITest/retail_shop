import { test as setup } from '@playwright/test';
import { login, TEST_USERS } from '../fixtures/auth';
import fs from 'fs';
import path from 'path';

const AUTH_DIR = path.join(process.cwd(), 'tests/auth-states');

// Ensure auth-states directory exists
setup.beforeAll(() => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
});

setup('save sysadmin auth state', async ({ page }) => {
  await login(page, TEST_USERS.admin);
  await page.context().storageState({ path: path.join(AUTH_DIR, 'sysadmin.json') });
});

setup('save tenant admin auth state', async ({ page }) => {
  await login(page, TEST_USERS.tenantAdmin);
  await page.context().storageState({ path: path.join(AUTH_DIR, 'admin.json') });
});

setup('save manager auth state', async ({ page }) => {
  await login(page, TEST_USERS.manager);
  await page.context().storageState({ path: path.join(AUTH_DIR, 'manager.json') });
});

setup('save cashier auth state', async ({ page }) => {
  await login(page, TEST_USERS.cashier);
  await page.context().storageState({ path: path.join(AUTH_DIR, 'cashier.json') });
});
