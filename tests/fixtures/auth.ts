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
  tenantContext: {
    code: string;
    name: string;
  };
}

// Default test users (update these based on your seed data)
export const TEST_USERS = {
  admin: {
    username: process.env.TEST_ADMIN_USERNAME || 'admin@nfi',
    password: process.env.TEST_ADMIN_PASSWORD || 'S3cr3T',
    tenantCode: process.env.TEST_TENANT_CODE || 'nfi',
    role: 'ADMIN'
  },
  user: {
    username: process.env.TEST_USER_USERNAME || 'user@nfi',
    password: process.env.TEST_USER_PASSWORD || 'S3cr3T',
    tenantCode: process.env.TEST_TENANT_CODE || 'nfi',
    role: 'USER'
  },
  guest: {
    username: process.env.TEST_GUEST_USERNAME || 'guest@nfi',
    password: process.env.TEST_GUEST_PASSWORD || 'S3cr3T',
    tenantCode: process.env.TEST_TENANT_CODE || 'nfi',
    role: 'GUEST'
  }
};

/**
 * Login helper function
 */
export async function login(page: Page, user: AuthUser) {
  await page.goto('/auth/login');
  
  // Fill login form
  await page.fill('input[name="username"]', user.username);
  await page.fill('input[name="password"]', user.password);
  
  // Set tenant context if needed (via header or subdomain)
  // if (user.tenantCode && user.tenantCode !== 'nfi') {
  //   await page.setExtraHTTPHeaders({
  //     'X-Tenant-Code': user.tenantCode
  //   });
  // }
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Wait for navigation to dashboard
  await page.waitForURL('**/console/dashboard', { timeout: 10000 });
  
  // Verify login success
  await expect(page.locator('body')).not.toContainText('Invalid credentials');
}

/**
 * Logout helper function
 */
export async function logout(page: Page) {
  // Click user menu
  await page.click('[data-testid="user-menu"], .user-menu, button:has-text("User")');
  
  // Click logout
  await page.click('text=/logout|sign out/i');
  
  // Wait for redirect to login
  //await page.waitForURL('**/auth/login');
  await expect(page).toHaveURL(/.*auth\/login/);
}

/**
 * Extended test with authentication fixtures
 */
export const test = base.extend<AuthFixtures>({
  // user page fixture (default user)
  userPage: async ({ page }, use) => {
    await login(page, TEST_USERS.user);
    await use(page);
    await logout(page);
  },

  // Admin page fixture
  adminPage: async ({ page }, use) => {
    await login(page, TEST_USERS.admin);
    await use(page);
    await logout(page);
  },

  // guest page fixture
  guestPage: async ({ page }, use) => {
    await login(page, TEST_USERS.guest);
    await use(page);
    await logout(page);
  },

  // Tenant context fixture
  tenantContext: async ({}, use) => {
    await use({
      code: TEST_USERS.admin.tenantCode,
      name: 'Neo Fusion Indonesia'
    });
  }
});

export { expect };
