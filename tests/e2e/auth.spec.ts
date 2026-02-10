import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/auth';

/**
 * Authentication Flow Tests
 * 
 * Tests login, logout, and authentication-related functionality
 * in a multi-tenant environment.
 */

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should redirect to login page when not authenticated', async ({ page }) => {
    await expect(page).toHaveURL(/.*auth\/login/);
  });

  test('should display login form', async ({ page }) => {
    await page.goto('/auth/login');
    
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    
    await page.fill('input[name="username"]', 'invalid_user');
    await page.fill('input[name="password"]', 'wrong_password');
    await page.click('button[type="submit"]');
    
    // Wait for error message
    await expect(page.locator('text=/invalid|unauthorized|incorrect/i')).toBeVisible({ timeout: 5000 });
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    
    await page.fill('input[name="username"]', TEST_USERS.admin.username);
    await page.fill('input[name="password"]', TEST_USERS.admin.password);
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*console\/dashboard/, { timeout: 10000 });
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/auth/login');
    await page.fill('input[name="username"]', TEST_USERS.admin.username);
    await page.fill('input[name="password"]', TEST_USERS.admin.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/console/dashboard');
    
    // Logout
    await page.click('[data-testid="user-menu"], .user-menu, button:has-text("User")');
    await page.click('text=/logout|sign out/i');
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*auth\/login/);
  });

  test('should maintain session after page reload', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('input[name="username"]', TEST_USERS.admin.username);
    await page.fill('input[name="password"]', TEST_USERS.admin.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/console/dashboard');
    
    // Reload page
    await page.reload();
    
    // Should still be on dashboard
    await expect(page).toHaveURL(/.*console\/dashboard/);
  });
});
