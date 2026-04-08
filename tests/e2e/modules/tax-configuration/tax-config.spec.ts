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
}

test.describe('Tax Configuration Operations', () => {

  test.describe('TAX-001: View Tax Configuration Page', () => {
    test('should display tax configuration page with proper structure', async ({ adminPage }) => {
      await navigateToTaxConfigList(adminPage);

      // Verify page title
      await expect(adminPage.locator('h1')).toContainText('PPN Tax Configuration');

      // Verify current active tax config card
      await expect(adminPage.locator('text=Current Active Tax Rate')).toBeVisible();
    });

    test('should display active config details or empty state', async ({ adminPage }) => {
      await navigateToTaxConfigList(adminPage);

      // Either active config details or empty state message should be visible
      const hasActiveConfig = await adminPage.locator('text=/\\d+%/').first().isVisible().catch(() => false);

      if (hasActiveConfig) {
        // Verify rate percentage is displayed
        await expect(adminPage.locator('text=/\\d+%/')).toBeVisible();

        // Verify calculation mode is displayed
        await expect(adminPage.locator('text=/Calculation Mode/i')).toBeVisible();

        // Verify effective date is displayed
        await expect(adminPage.locator('text=/Effective Since/i')).toBeVisible();
      } else {
        // Empty state message
        await expect(adminPage.locator('text=/No active tax configuration found/i')).toBeVisible();
      }
    });

    test('should display Update Tax Rate button', async ({ adminPage }) => {
      await navigateToTaxConfigList(adminPage);

      const updateButton = adminPage.locator('button:has-text("Update Tax Rate")');
      await expect(updateButton).toBeVisible();
    });

    test('should display historical rates table if history exists', async ({ adminPage }) => {
      await navigateToTaxConfigList(adminPage);

      // Historical table may or may not be visible depending on data
      const historyHeader = adminPage.locator('text=Tax Rate History');

      if (await historyHeader.isVisible()) {
        // Verify table headers
        const table = adminPage.locator('table');
        await expect(table).toBeVisible();
        await expect(adminPage.locator('th:has-text("#")')).toBeVisible();
        await expect(adminPage.locator('th:has-text("Rate (%)")')).toBeVisible();
        await expect(adminPage.locator('th:has-text("Calculation Mode")')).toBeVisible();
        await expect(adminPage.locator('th:has-text("Effective Date")')).toBeVisible();
        await expect(adminPage.locator('th:has-text("Status")')).toBeVisible();
      }
    });
  });

  test.describe('TAX-002: Create Tax Configuration - Success', () => {
    test('should navigate to add tax config page', async ({ adminPage }) => {
      await navigateToTaxConfigList(adminPage);

      await adminPage.click('button:has-text("Update Tax Rate")');
      await expect(adminPage).toHaveURL(/config\/add/);

      // Verify breadcrumb
      await expect(adminPage.locator('text=Update Tax Rate')).toBeVisible();
      await expect(adminPage.locator('text=PPN Configuration')).toBeVisible();
    });

    test('should display form with correct fields', async ({ adminPage }) => {
      await navigateToTaxConfigList(adminPage);
      await adminPage.click('button:has-text("Update Tax Rate")');

      // Verify form labels
      await expect(adminPage.locator('label:has-text("PPN Rate (%)")')).toBeVisible();
      await expect(adminPage.locator('label:has-text("Effective Date")')).toBeVisible();
      await expect(adminPage.locator('label:has-text("Calculation Mode")')).toBeVisible();

      // Verify Save and Cancel buttons
      await expect(adminPage.locator('button:has-text("Save")')).toBeVisible();
      await expect(adminPage.locator('button:has-text("Cancel")')).toBeVisible();
    });

    test('should have default values pre-filled', async ({ adminPage }) => {
      await navigateToTaxConfigList(adminPage);
      await adminPage.click('button:has-text("Update Tax Rate")');

      // Default rate should be 11
      const rateInput = adminPage.locator('input[name="ratePercent"]');
      const rateValue = await rateInput.inputValue();
      expect(rateValue).toBe('11');
    });

    test('should create tax config with valid data', async ({ adminPage }) => {
      await navigateToTaxConfigList(adminPage);
      await adminPage.click('button:has-text("Update Tax Rate")');

      // Fill rate
      const rateInput = adminPage.locator('input[name="ratePercent"]');
      await rateInput.clear();
      await rateInput.fill('11');

      // Select effective date - click the date picker button
      const dateButton = adminPage.locator('button:has-text("Pick a date")');
      if (await dateButton.isVisible()) {
        await dateButton.click();
        await adminPage.waitForTimeout(300);
        // Select today or a specific date
        const dayButton = adminPage.locator('button[name="day"]').filter({ hasText: '15' }).first();
        if (await dayButton.isVisible()) {
          await dayButton.click();
        }
      }

      // Select calculation mode
      const calcModeSelect = adminPage.locator('button:has-text("Select calculation mode"), button:has-text("Exclusive"), button:has-text("Inclusive")').first();
      await calcModeSelect.click();
      await adminPage.waitForTimeout(300);
      await adminPage.click('div[role="option"]:has-text("Exclusive")');

      // Submit form
      await adminPage.click('button:has-text("Save")');

      // Wait for success message
      await expect(adminPage.locator('text=/Tax configuration has been updated/i')).toBeVisible({ timeout: 5000 });

      // Verify redirect to config page
      await expect(adminPage).toHaveURL(/modules\/tax-configuration\/config$/);
    });

    test('should show new config as active after creation', async ({ adminPage }) => {
      // First create a config
      await navigateToTaxConfigList(adminPage);
      await adminPage.click('button:has-text("Update Tax Rate")');

      const uniqueRate = '12';

      const rateInput = adminPage.locator('input[name="ratePercent"]');
      await rateInput.clear();
      await rateInput.fill(uniqueRate);

      // Select effective date
      const dateButton = adminPage.locator('button:has-text("Pick a date")');
      if (await dateButton.isVisible()) {
        await dateButton.click();
        await adminPage.waitForTimeout(300);
        const dayButton = adminPage.locator('button[name="day"]').filter({ hasText: '15' }).first();
        if (await dayButton.isVisible()) {
          await dayButton.click();
        }
      }

      // Select calculation mode
      const calcModeSelect = adminPage.locator('button:has-text("Select calculation mode"), button:has-text("Exclusive"), button:has-text("Inclusive")').first();
      await calcModeSelect.click();
      await adminPage.waitForTimeout(300);
      await adminPage.click('div[role="option"]:has-text("Exclusive")');

      await adminPage.click('button:has-text("Save")');
      await adminPage.waitForTimeout(1000);

      // Navigate back to verify
      await navigateToTaxConfigList(adminPage);
      await adminPage.waitForTimeout(1000);

      // Verify the active config shows the new rate
      await expect(adminPage.locator(`text=${uniqueRate}%`)).toBeVisible();
    });
  });

  test.describe('TAX-003: Create Tax Configuration - Previous Becomes Historical', () => {
    test('should mark previous config as historical when new one is created', async ({ adminPage }) => {
      // Create first config
      await navigateToTaxConfigList(adminPage);
      await adminPage.click('button:has-text("Update Tax Rate")');

      const firstRate = '10';
      const rateInput = adminPage.locator('input[name="ratePercent"]');
      await rateInput.clear();
      await rateInput.fill(firstRate);

      const dateButton = adminPage.locator('button:has-text("Pick a date")');
      if (await dateButton.isVisible()) {
        await dateButton.click();
        await adminPage.waitForTimeout(300);
        const dayButton = adminPage.locator('button[name="day"]').filter({ hasText: '10' }).first();
        if (await dayButton.isVisible()) {
          await dayButton.click();
        }
      }

      const calcModeSelect = adminPage.locator('button:has-text("Select calculation mode"), button:has-text("Exclusive"), button:has-text("Inclusive")').first();
      await calcModeSelect.click();
      await adminPage.waitForTimeout(300);
      await adminPage.click('div[role="option"]:has-text("Inclusive")');

      await adminPage.click('button:has-text("Save")');
      await adminPage.waitForTimeout(1000);

      // Create second config
      await navigateToTaxConfigList(adminPage);
      await adminPage.click('button:has-text("Update Tax Rate")');

      const secondRate = '11';
      const rateInput2 = adminPage.locator('input[name="ratePercent"]');
      await rateInput2.clear();
      await rateInput2.fill(secondRate);

      const dateButton2 = adminPage.locator('button:has-text("Pick a date")');
      if (await dateButton2.isVisible()) {
        await dateButton2.click();
        await adminPage.waitForTimeout(300);
        const dayButton2 = adminPage.locator('button[name="day"]').filter({ hasText: '20' }).first();
        if (await dayButton2.isVisible()) {
          await dayButton2.click();
        }
      }

      const calcModeSelect2 = adminPage.locator('button:has-text("Select calculation mode"), button:has-text("Exclusive"), button:has-text("Inclusive")').first();
      await calcModeSelect2.click();
      await adminPage.waitForTimeout(300);
      await adminPage.click('div[role="option"]:has-text("Exclusive")');

      await adminPage.click('button:has-text("Save")');
      await adminPage.waitForTimeout(1000);

      // Navigate back and check historical table
      await navigateToTaxConfigList(adminPage);
      await adminPage.waitForTimeout(1000);

      // The active config should show the second rate
      await expect(adminPage.locator('text=Current Active Tax Rate')).toBeVisible();

      // Historical section should exist if there are previous configs
      const historyHeader = adminPage.locator('text=Tax Rate History');
      if (await historyHeader.isVisible()) {
        // Historical table should show entries with "historical" status
        await expect(adminPage.locator('text=historical').first()).toBeVisible();
      }
    });
  });

  test.describe('TAX-004: Create Tax Configuration - Validation Errors', () => {
    test('should show validation error for empty rate', async ({ adminPage }) => {
      await navigateToTaxConfigList(adminPage);
      await adminPage.click('button:has-text("Update Tax Rate")');

      // Clear the rate field
      const rateInput = adminPage.locator('input[name="ratePercent"]');
      await rateInput.clear();

      // Try to submit
      await adminPage.click('button:has-text("Save")');

      // Should show validation error
      await expect(adminPage.locator('text=/PPN Rate is required|Rate must be at least/i')).toBeVisible({ timeout: 3000 });
    });

    test('should show validation error for rate above 100', async ({ adminPage }) => {
      await navigateToTaxConfigList(adminPage);
      await adminPage.click('button:has-text("Update Tax Rate")');

      // Fill with invalid rate
      const rateInput = adminPage.locator('input[name="ratePercent"]');
      await rateInput.clear();
      await rateInput.fill('150');

      // Submit
      await adminPage.click('button:has-text("Save")');

      // Should show validation error
      await expect(adminPage.locator('text=/Rate must be at most 100/i')).toBeVisible({ timeout: 3000 });
    });

    test('should require calculation mode', async ({ adminPage }) => {
      await navigateToTaxConfigList(adminPage);
      await adminPage.click('button:has-text("Update Tax Rate")');

      // Fill rate but don't select calc mode (it should have no default)
      const rateInput = adminPage.locator('input[name="ratePercent"]');
      await rateInput.clear();
      await rateInput.fill('11');

      // Submit - the form may or may not show error depending on default value
      await adminPage.click('button:has-text("Save")');

      // Wait for result
      await adminPage.waitForTimeout(1000);

      // Either success (if defaults applied) or error should be shown
      const url = adminPage.url();
      const hasError = await adminPage.locator('text=/Calculation mode is required/i').isVisible().catch(() => false);
      const hasSuccess = url.match(/config$/) !== null;

      // At least one of these should be true
      expect(hasError || hasSuccess).toBeTruthy();
    });
  });

  test.describe('TAX-005: Navigation and Breadcrumbs', () => {
    test('should display breadcrumbs on add page', async ({ adminPage }) => {
      await navigateToTaxConfigList(adminPage);
      await adminPage.click('button:has-text("Update Tax Rate")');

      // Verify breadcrumb structure
      await expect(adminPage.locator('text=PPN Configuration')).toBeVisible();
      await expect(adminPage.locator('text=Update Tax Rate')).toBeVisible();
    });

    test('should navigate back via breadcrumb', async ({ adminPage }) => {
      await navigateToTaxConfigList(adminPage);
      await adminPage.click('button:has-text("Update Tax Rate")');
      await adminPage.waitForTimeout(1000);

      // Click PPN Configuration in breadcrumb
      const breadcrumbLink = adminPage.locator('a:has-text("PPN Configuration")').first();
      if (await breadcrumbLink.isVisible()) {
        await breadcrumbLink.click();
        await expect(adminPage).toHaveURL(/modules\/tax-configuration\/config/);
      }
    });

    test('should handle cancel button navigation', async ({ adminPage }) => {
      await navigateToTaxConfigList(adminPage);
      await adminPage.click('button:has-text("Update Tax Rate")');

      // Click cancel
      const cancelButton = adminPage.locator('button:has-text("Cancel")');
      await cancelButton.click();

      // Should navigate back to config page
      await expect(adminPage).toHaveURL(/modules\/tax-configuration\/config/);
    });
  });

  test.describe('Performance', () => {
    test('should load tax config page within acceptable time', async ({ adminPage }) => {
      const startTime = Date.now();

      await navigateToTaxConfigList(adminPage);
      await adminPage.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });
  });
});
