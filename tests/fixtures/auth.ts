import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Authentication Fixture for Multi-Tenant Testing
 * 
 * Provides authenticated page contexts for different tenants and roles.
 */

export interface AuthUser {
  username: string;
  password: string;
  tenantCode: string;
  role?: string;
}

export interface AuthFixtures {
  userPage: Page;
  adminPage: Page;
  guestPage: Page;
  tenantAdminPage: Page;
  managerPage: Page;
  cashierPage: Page;
  tenantContext: {
    code: string;
    name: string;
  };
}

// Default test users (update these based on your seed data)
export const TEST_USERS = {
  // System-level SYSADMIN (manages tenants, modules, global config)
  admin: {
    username: process.env.TEST_ADMIN_USERNAME || 'sysadmin@system',
    password: process.env.TEST_ADMIN_PASSWORD || 'S3cr3T',
    tenantCode: process.env.TEST_TENANT_CODE || 'system',
    role: 'SYSADMIN'
  },
  // Legacy aliases — kept for backward compatibility with existing specs
  user: {
    username: process.env.TEST_USER_USERNAME || 'sysadmin@system',
    password: process.env.TEST_USER_PASSWORD || 'S3cr3T',
    tenantCode: process.env.TEST_TENANT_CODE || 'system',
    role: 'SYSADMIN'
  },
  guest: {
    username: process.env.TEST_GUEST_USERNAME || 'sysadmin@system',
    password: process.env.TEST_GUEST_PASSWORD || 'S3cr3T',
    tenantCode: process.env.TEST_TENANT_CODE || 'system',
    role: 'SYSADMIN'
  },
  // Tenant-scoped roles (tmj tenant, created by db:seed)
  tenantAdmin: {
    username: process.env.TEST_TENANT_ADMIN_USERNAME || 'admin@tmj',
    password: process.env.TEST_TENANT_ADMIN_PASSWORD || 'S3cr3T',
    tenantCode: 'tmj',
    role: 'ADMIN'
  },
  manager: {
    username: process.env.TEST_MANAGER_USERNAME || 'manager@tmj',
    password: process.env.TEST_MANAGER_PASSWORD || 'S3cr3T',
    tenantCode: 'tmj',
    role: 'MANAGER'
  },
  cashier: {
    username: process.env.TEST_CASHIER_USERNAME || 'cashier@tmj',
    password: process.env.TEST_CASHIER_PASSWORD || 'S3cr3T',
    tenantCode: 'tmj',
    role: 'CASHIER'
  },
};

/**
 * Login helper function — used only by global-setup.ts to create initial auth states.
 */
export async function login(page: Page, user: AuthUser) {
  await page.goto('/auth/login');
  await page.fill('input[name="username"]', user.username);
  await page.fill('input[name="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/console/dashboard', { timeout: 30000 });
  await expect(page.locator('body')).not.toContainText('Invalid credentials');
}

/**
 * Logout helper — clears local state only (no server-side call to avoid invalidating
 * the shared auth-state files that other parallel fixtures reuse).
 */
export async function logout(page: Page) {
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto('/auth/login');
}

/**
 * Creates an isolated browser context loaded from a pre-saved auth state file.
 * Navigates to /console/dashboard with domcontentloaded so that localStorage is
 * available for page.evaluate() calls in tests without a full app render wait.
 */
async function authContext(browser: any, storageStatePath: string) {
  const ctx = await browser.newContext({ storageState: storageStatePath });
  const page = await ctx.newPage();
  await page.goto('/console/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
  return { ctx, page };
}

/**
 * Extended test with authentication fixtures.
 * Each fixture loads the pre-saved auth state (written by global-setup.ts) so tests
 * skip UI login entirely — faster and immune to login-page timeout flakes.
 */
export const test = base.extend<AuthFixtures>({
  userPage: async ({ browser }, use) => {
    const { ctx, page } = await authContext(browser, 'tests/auth-states/sysadmin.json');
    await use(page);
    await ctx.close();
  },

  adminPage: async ({ browser }, use) => {
    const { ctx, page } = await authContext(browser, 'tests/auth-states/sysadmin.json');
    await use(page);
    await ctx.close();
  },

  guestPage: async ({ browser }, use) => {
    const { ctx, page } = await authContext(browser, 'tests/auth-states/sysadmin.json');
    await use(page);
    await ctx.close();
  },

  tenantAdminPage: async ({ browser }, use) => {
    const { ctx, page } = await authContext(browser, 'tests/auth-states/admin.json');
    await use(page);
    await ctx.close();
  },

  managerPage: async ({ browser }, use) => {
    const { ctx, page } = await authContext(browser, 'tests/auth-states/manager.json');
    await use(page);
    await ctx.close();
  },

  cashierPage: async ({ browser }, use) => {
    const { ctx, page } = await authContext(browser, 'tests/auth-states/cashier.json');
    await use(page);
    await ctx.close();
  },

  tenantContext: async ({}, use) => {
    await use({
      code: TEST_USERS.admin.tenantCode,
      name: 'System Tenant'
    });
  }
});

export { expect };
