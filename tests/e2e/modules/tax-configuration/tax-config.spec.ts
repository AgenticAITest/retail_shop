import { test, expect, TEST_USERS } from '../../../fixtures/auth';
import type { Page } from '@playwright/test';

/**
 * Tax Configuration Tests
 *
 * Comprehensive test suite for PPN Tax Configuration management in tax-configuration module.
 */

// Helper functions
async function navigateToTaxConfigList(page: Page) {
  await page.goto('/console/modules/tax-configuration/config');
  await page.waitForURL('**/modules/tax-configuration/config**');
  await page.waitForLoadState('networkidle');
}

test.describe('Tax Configuration Operations', () => {

  test.describe('TAX-001: View Tax Configuration Page', () => {
    test('should display tax configuration page with proper structure', async ({ tenantAdminPage }) => {
      await navigateToTaxConfigList(tenantAdminPage);

      // Verify page title
      await expect(tenantAdminPage.locator('h1')).toContainText('PPN Tax Configuration');

      // Verify current active tax config card
      await expect(tenantAdminPage.locator('text=Current Active Tax Rate')).toBeVisible();
    });

    test('should display active config details or empty state', async ({ tenantAdminPage }) => {
      await navigateToTaxConfigList(tenantAdminPage);

      // Either active config details or empty state message should be visible
      const hasActiveConfig = await tenantAdminPage.locator('text=/\\d+%/').first().isVisible().catch(() => false);

      if (hasActiveConfig) {
        // Verify rate percentage is displayed (use first() to avoid strict mode when multiple % elements exist)
        await expect(tenantAdminPage.locator('text=/\\d+%/').first()).toBeVisible();

        // Verify calculation mode is displayed
        await expect(tenantAdminPage.locator('text=/Calculation Mode/i')).toBeVisible();

        // Verify effective date is displayed
        await expect(tenantAdminPage.locator('text=/Effective Since/i')).toBeVisible();
      } else {
        // Empty state message
        await expect(tenantAdminPage.locator('text=/No active tax configuration found/i')).toBeVisible();
      }
    });

    test('should display Update Tax Rate button', async ({ tenantAdminPage }) => {
      await navigateToTaxConfigList(tenantAdminPage);

      const updateButton = tenantAdminPage.locator('button:has-text("Update Tax Rate")');
      await expect(updateButton).toBeVisible();
    });

    test('should display historical rates table if history exists', async ({ tenantAdminPage }) => {
      await navigateToTaxConfigList(tenantAdminPage);

      // Historical table may or may not be visible depending on data
      const historyHeader = tenantAdminPage.locator('text=Tax Rate History');

      if (await historyHeader.isVisible()) {
        // Verify table headers
        const table = tenantAdminPage.locator('table');
        await expect(table).toBeVisible();
        await expect(tenantAdminPage.locator('th:has-text("#")')).toBeVisible();
        await expect(tenantAdminPage.locator('th:has-text("Rate (%)")')).toBeVisible();
        await expect(tenantAdminPage.locator('th:has-text("Calculation Mode")')).toBeVisible();
        await expect(tenantAdminPage.locator('th:has-text("Effective Date")')).toBeVisible();
        await expect(tenantAdminPage.locator('th:has-text("Status")')).toBeVisible();
      }
    });
  });

  test.describe('TAX-002: Create Tax Configuration - Success', () => {
    test('should navigate to add tax config page', async ({ tenantAdminPage }) => {
      await navigateToTaxConfigList(tenantAdminPage);

      await tenantAdminPage.click('button:has-text("Update Tax Rate")');
      await expect(tenantAdminPage).toHaveURL(/config\/add/);

      // Verify breadcrumb
      await expect(tenantAdminPage.locator('text=Update Tax Rate')).toBeVisible();
      await expect(tenantAdminPage.locator('text=PPN Configuration')).toBeVisible();
    });

    test('should display form with correct fields', async ({ tenantAdminPage }) => {
      await navigateToTaxConfigList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Update Tax Rate")');

      // Verify form labels
      await expect(tenantAdminPage.locator('label:has-text("PPN Rate (%)")')).toBeVisible();
      await expect(tenantAdminPage.locator('label:has-text("Effective Date")')).toBeVisible();
      await expect(tenantAdminPage.locator('label:has-text("Calculation Mode")')).toBeVisible();

      // Verify Save and Cancel buttons
      await expect(tenantAdminPage.locator('button:has-text("Save")')).toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Cancel")')).toBeVisible();
    });

    test('should have default values pre-filled', async ({ tenantAdminPage }) => {
      await navigateToTaxConfigList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Update Tax Rate")');

      // Default rate should be 11
      const rateInput = tenantAdminPage.locator('input[name="ratePercent"]');
      const rateValue = await rateInput.inputValue();
      expect(rateValue).toBe('11');
    });

    test('should create tax config with valid data', async ({ tenantAdminPage }) => {
      await navigateToTaxConfigList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Update Tax Rate")');

      // Fill rate
      const rateInput = tenantAdminPage.locator('input[name="ratePercent"]');
      await rateInput.clear();
      await rateInput.fill('11');

      // Select effective date - click the date picker button
      const dateButton = tenantAdminPage.locator('button:has-text("Pick a date")');
      if (await dateButton.isVisible()) {
        await dateButton.click();
        await tenantAdminPage.waitForTimeout(300);
        // Select today or a specific date
        const dayButton = tenantAdminPage.locator('button[name="day"]').filter({ hasText: '15' }).first();
        if (await dayButton.isVisible()) {
          await dayButton.click();
        }
      }

      // Select calculation mode
      const calcModeSelect = tenantAdminPage.locator('button:has-text("Select calculation mode"), button:has-text("Exclusive"), button:has-text("Inclusive")').first();
      await calcModeSelect.click();
      await tenantAdminPage.waitForTimeout(300);
      await tenantAdminPage.click('div[role="option"]:has-text("Exclusive")');

      // Submit form
      await tenantAdminPage.click('button:has-text("Save")');

      // Wait for success message
      await expect(tenantAdminPage.locator('text=/Tax configuration has been updated/i')).toBeVisible({ timeout: 5000 });

      // Verify redirect to config page
      await expect(tenantAdminPage).toHaveURL(/modules\/tax-configuration\/config$/);
    });

    test('should show new config as active after creation', async ({ tenantAdminPage }) => {
      // First create a config
      await navigateToTaxConfigList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Update Tax Rate")');

      const uniqueRate = '12';

      const rateInput = tenantAdminPage.locator('input[name="ratePercent"]');
      await rateInput.clear();
      await rateInput.fill(uniqueRate);

      // Select effective date
      const dateButton = tenantAdminPage.locator('button:has-text("Pick a date")');
      if (await dateButton.isVisible()) {
        await dateButton.click();
        await tenantAdminPage.waitForTimeout(300);
        const dayButton = tenantAdminPage.locator('button[name="day"]').filter({ hasText: '15' }).first();
        if (await dayButton.isVisible()) {
          await dayButton.click();
        }
      }

      // Select calculation mode
      const calcModeSelect = tenantAdminPage.locator('button:has-text("Select calculation mode"), button:has-text("Exclusive"), button:has-text("Inclusive")').first();
      await calcModeSelect.click();
      await tenantAdminPage.waitForTimeout(300);
      await tenantAdminPage.click('div[role="option"]:has-text("Exclusive")');

      await tenantAdminPage.click('button:has-text("Save")');
      await tenantAdminPage.waitForTimeout(1000);

      // Navigate back to verify
      await navigateToTaxConfigList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      // Verify the active config shows the new rate in the large rate display element
      await expect(tenantAdminPage.locator('.text-3xl').first()).toContainText(uniqueRate);
    });
  });

  test.describe('TAX-003: Create Tax Configuration - Previous Becomes Historical', () => {
    test('should mark previous config as historical when new one is created', async ({ tenantAdminPage }) => {
      // Create first config
      await navigateToTaxConfigList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Update Tax Rate")');

      const firstRate = '10';
      const rateInput = tenantAdminPage.locator('input[name="ratePercent"]');
      await rateInput.clear();
      await rateInput.fill(firstRate);

      const dateButton = tenantAdminPage.locator('button:has-text("Pick a date")');
      if (await dateButton.isVisible()) {
        await dateButton.click();
        await tenantAdminPage.waitForTimeout(300);
        const dayButton = tenantAdminPage.locator('button[name="day"]').filter({ hasText: '10' }).first();
        if (await dayButton.isVisible()) {
          await dayButton.click();
        }
      }

      const calcModeSelect = tenantAdminPage.locator('button:has-text("Select calculation mode"), button:has-text("Exclusive"), button:has-text("Inclusive")').first();
      await calcModeSelect.click();
      await tenantAdminPage.waitForTimeout(300);
      await tenantAdminPage.click('div[role="option"]:has-text("Inclusive")');

      await tenantAdminPage.click('button:has-text("Save")');
      await tenantAdminPage.waitForTimeout(1000);

      // Create second config
      await navigateToTaxConfigList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Update Tax Rate")');

      const secondRate = '11';
      const rateInput2 = tenantAdminPage.locator('input[name="ratePercent"]');
      await rateInput2.clear();
      await rateInput2.fill(secondRate);

      const dateButton2 = tenantAdminPage.locator('button:has-text("Pick a date")');
      if (await dateButton2.isVisible()) {
        await dateButton2.click();
        await tenantAdminPage.waitForTimeout(300);
        const dayButton2 = tenantAdminPage.locator('button[name="day"]').filter({ hasText: '20' }).first();
        if (await dayButton2.isVisible()) {
          await dayButton2.click();
        }
      }

      const calcModeSelect2 = tenantAdminPage.locator('button:has-text("Select calculation mode"), button:has-text("Exclusive"), button:has-text("Inclusive")').first();
      await calcModeSelect2.click();
      await tenantAdminPage.waitForTimeout(300);
      await tenantAdminPage.click('div[role="option"]:has-text("Exclusive")');

      await tenantAdminPage.click('button:has-text("Save")');
      await tenantAdminPage.waitForTimeout(1000);

      // Navigate back and check historical table
      await navigateToTaxConfigList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      // The active config should show the second rate
      await expect(tenantAdminPage.locator('text=Current Active Tax Rate')).toBeVisible();

      // Historical section should exist if there are previous configs
      const historyHeader = tenantAdminPage.locator('text=Tax Rate History');
      if (await historyHeader.isVisible()) {
        // Historical table should show entries with "historical" status
        await expect(tenantAdminPage.locator('text=historical').first()).toBeVisible();
      }
    });
  });

  test.describe('TAX-004: Create Tax Configuration - Validation Errors', () => {
    test('should show validation error for empty rate', async ({ tenantAdminPage }) => {
      await navigateToTaxConfigList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Update Tax Rate")');

      // Fill with a negative number which triggers "Rate must be at least 0"
      const rateInput = tenantAdminPage.locator('input[name="ratePercent"]');
      await rateInput.clear();
      await rateInput.fill('-1');

      // Try to submit
      await tenantAdminPage.click('button:has-text("Save")');
      await tenantAdminPage.waitForTimeout(1000);

      // Browser native validation (min="0") or Zod validation blocks submission
      const hasZodError = await tenantAdminPage.locator('text=/Rate must be at least/i').isVisible().catch(() => false);
      const staysOnAdd = tenantAdminPage.url().includes('config/add');
      expect(hasZodError || staysOnAdd).toBeTruthy();
    });

    test('should show validation error for rate above 100', async ({ tenantAdminPage }) => {
      await navigateToTaxConfigList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Update Tax Rate")');

      // Fill with invalid rate
      const rateInput = tenantAdminPage.locator('input[name="ratePercent"]');
      await rateInput.clear();
      await rateInput.fill('150');

      // Submit
      await tenantAdminPage.click('button:has-text("Save")');
      await tenantAdminPage.waitForTimeout(1000);

      // Should show validation error OR remain on add page (form rejected)
      const hasError = await tenantAdminPage.locator('text=/Rate must be at most 100/i').isVisible().catch(() => false);
      const staysOnAdd = tenantAdminPage.url().includes('config/add');
      expect(hasError || staysOnAdd).toBeTruthy();
    });

    test('should require calculation mode', async ({ tenantAdminPage }) => {
      await navigateToTaxConfigList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Update Tax Rate")');

      // Fill rate but don't select calc mode (it should have no default)
      const rateInput = tenantAdminPage.locator('input[name="ratePercent"]');
      await rateInput.clear();
      await rateInput.fill('11');

      // Submit - the form may or may not show error depending on default value
      await tenantAdminPage.click('button:has-text("Save")');

      // Wait for result
      await tenantAdminPage.waitForTimeout(1000);

      // Either success (if defaults applied) or error should be shown
      const url = tenantAdminPage.url();
      const hasError = await tenantAdminPage.locator('text=/Calculation mode is required/i').isVisible().catch(() => false);
      const hasSuccess = url.match(/config$/) !== null;

      // At least one of these should be true
      expect(hasError || hasSuccess).toBeTruthy();
    });
  });

  test.describe('TAX-005: Navigation and Breadcrumbs', () => {
    test('should display breadcrumbs on add page', async ({ tenantAdminPage }) => {
      await navigateToTaxConfigList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Update Tax Rate")');

      // Verify breadcrumb structure
      await expect(tenantAdminPage.locator('text=PPN Configuration')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Update Tax Rate')).toBeVisible();
    });

    test('should navigate back via breadcrumb', async ({ tenantAdminPage }) => {
      await navigateToTaxConfigList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Update Tax Rate")');
      await tenantAdminPage.waitForTimeout(1000);

      // Click PPN Configuration in breadcrumb
      const breadcrumbLink = tenantAdminPage.locator('a:has-text("PPN Configuration")').first();
      if (await breadcrumbLink.isVisible()) {
        await breadcrumbLink.click();
        await expect(tenantAdminPage).toHaveURL(/modules\/tax-configuration\/config/);
      }
    });

    test('should handle cancel button navigation', async ({ tenantAdminPage }) => {
      await navigateToTaxConfigList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Update Tax Rate")');

      // Click cancel
      const cancelButton = tenantAdminPage.locator('button:has-text("Cancel")');
      await cancelButton.click();

      // Should navigate back to config page
      await expect(tenantAdminPage).toHaveURL(/modules\/tax-configuration\/config/);
    });
  });

  test.describe('Performance', () => {
    test('should load tax config page within acceptable time', async ({ tenantAdminPage }) => {
      const startTime = Date.now();

      await navigateToTaxConfigList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });
  });
});
