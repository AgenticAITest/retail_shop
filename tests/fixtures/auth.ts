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

  // Tenant ADMIN fixture (tmj tenant, full module access)
  tenantAdminPage: async ({ page }, use) => {
    await login(page, TEST_USERS.tenantAdmin);
    await use(page);
    await logout(page);
  },

  // MANAGER fixture (tmj tenant, POS + reports + approvals)
  managerPage: async ({ page }, use) => {
    await login(page, TEST_USERS.manager);
    await use(page);
    await logout(page);
  },

  // CASHIER fixture (tmj tenant, POS sales only)
  cashierPage: async ({ page }, use) => {
    await login(page, TEST_USERS.cashier);
    await use(page);
    await logout(page);
  },

  // Tenant context fixture
  tenantContext: async ({}, use) => {
    await use({
      code: TEST_USERS.admin.tenantCode,
      name: 'System Tenant'
    });
  }
});

export { expect };
