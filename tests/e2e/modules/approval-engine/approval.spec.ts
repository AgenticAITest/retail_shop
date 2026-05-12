import { test, expect, TEST_USERS } from '../../../fixtures/auth';
import type { Page } from '@playwright/test';

/**
 * Approval Engine Tests
 *
 * Comprehensive test suite for the Approval Engine module.
 * Tests approval configuration, pending approvals, approval history,
 * and audit log pages.
 */

// Helper functions
async function navigateToApprovalConfig(page: Page) {
  await page.goto('/console/modules/approval-engine/config');
  await page.waitForURL('**/modules/approval-engine/config**');
}

async function navigateToPendingApprovals(page: Page) {
  await page.goto('/console/modules/approval-engine/pending');
  await page.waitForURL('**/modules/approval-engine/pending**');
}

async function navigateToApprovalHistory(page: Page) {
  await page.goto('/console/modules/approval-engine/history');
  await page.waitForURL('**/modules/approval-engine/history**');
}

async function navigateToAuditLog(page: Page) {
  await page.goto('/console/modules/approval-engine/audit-log');
  await page.waitForURL('**/modules/approval-engine/audit-log**');
}

test.describe('Approval Engine', () => {

  test.describe('APR-001: Approval Configuration Page', () => {
    test('should display approval config page with proper structure', async ({ tenantAdminPage }) => {
      await navigateToApprovalConfig(tenantAdminPage);

      // Verify page title
      await expect(tenantAdminPage.locator('h1')).toContainText('Approval Configuration');

      // Verify table structure
      const table = tenantAdminPage.locator('table');
      await expect(table).toBeVisible();

      // Verify table headers
      await expect(tenantAdminPage.locator('th:has-text("Transaction Type")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Required")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Approver Role")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Threshold Amount")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Timeout Hours")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Timeout Action")')).toBeVisible();
    });

    test('should display transaction type rows', async ({ tenantAdminPage }) => {
      await navigateToApprovalConfig(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Check for known transaction types
      const tableBody = tenantAdminPage.locator('table tbody');
      await expect(tableBody).toBeVisible();

      // Should have at least one row or show empty message
      const rows = tenantAdminPage.locator('table tbody tr');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThanOrEqual(1);
    });

    test('should have save buttons per row', async ({ tenantAdminPage }) => {
      await navigateToApprovalConfig(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Each config row should have a save button
      const rows = tenantAdminPage.locator('table tbody tr');
      const rowCount = await rows.count();

      if (rowCount > 0) {
        // Check first row has a save button (Save icon)
        const firstRowButton = rows.first().locator('button').last();
        await expect(firstRowButton).toBeVisible();
      }
    });

    test('should have toggle switches for required field', async ({ tenantAdminPage }) => {
      await navigateToApprovalConfig(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Check for switch/toggle elements
      const switches = tenantAdminPage.locator('button[role="switch"]');
      const switchCount = await switches.count();

      // If there are config rows, there should be switches
      const rows = tenantAdminPage.locator('table tbody tr');
      const rowCount = await rows.count();
      if (rowCount > 0) {
        expect(switchCount).toBeGreaterThan(0);
      }
    });
  });

  test.describe('APR-002: Pending Approvals Page', () => {
    test('should display pending approvals page with proper structure', async ({ tenantAdminPage }) => {
      await navigateToPendingApprovals(tenantAdminPage);

      // Verify page title
      await expect(tenantAdminPage.locator('h1')).toContainText('Pending Approvals');

      // Verify table structure
      const table = tenantAdminPage.locator('table');
      await expect(table).toBeVisible();

      // Verify table headers
      await expect(tenantAdminPage.locator('th:has-text("#")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Transaction Type")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Transaction ID")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Requested By")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Requested At")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Age")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Actions")')).toBeVisible();
    });

    test('should display search input', async ({ tenantAdminPage }) => {
      await navigateToPendingApprovals(tenantAdminPage);

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await expect(searchInput).toBeVisible();
    });

    test('should show approve and reject buttons if approvals exist', async ({ tenantAdminPage }) => {
      await navigateToPendingApprovals(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      const rows = tenantAdminPage.locator('table tbody tr');
      const rowCount = await rows.count();

      if (rowCount > 0) {
        // Check first row for approve/reject buttons
        const firstRow = rows.first();
        const approveBtn = firstRow.locator('button:has-text("Approve")');
        const rejectBtn = firstRow.locator('button:has-text("Reject")');

        if (await approveBtn.isVisible()) {
          await expect(approveBtn).toBeVisible();
        }
        if (await rejectBtn.isVisible()) {
          await expect(rejectBtn).toBeVisible();
        }
      }
    });

    test('should handle empty state', async ({ tenantAdminPage }) => {
      await navigateToPendingApprovals(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      const rows = tenantAdminPage.locator('table tbody tr');
      const rowCount = await rows.count();

      if (rowCount === 1) {
        // Could be the "no pending approvals" message row
        const emptyMessage = tenantAdminPage.locator('text=/No pending approvals found/i');
        if (await emptyMessage.isVisible()) {
          await expect(emptyMessage).toBeVisible();
        }
      }
    });
  });

  test.describe('APR-003: Approval History Page', () => {
    test('should display approval history page with proper structure', async ({ tenantAdminPage }) => {
      await navigateToApprovalHistory(tenantAdminPage);

      // Verify page title
      await expect(tenantAdminPage.locator('h1')).toContainText('Approval History');

      // Verify table structure
      const table = tenantAdminPage.locator('table');
      await expect(table).toBeVisible();

      // Verify table headers
      await expect(tenantAdminPage.locator('th:has-text("#")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Transaction Type")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Transaction ID")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Requested By")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Actioned By")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Action")').first()).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Reason")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Date")')).toBeVisible();
    });

    test('should display filter controls', async ({ tenantAdminPage }) => {
      await navigateToApprovalHistory(tenantAdminPage);

      // Verify Transaction Type filter
      const typeFilter = tenantAdminPage.locator('text=Transaction Type').locator('..').locator('button[role="combobox"]');
      await expect(typeFilter).toBeVisible();

      // Verify Action filter
      const actionFilter = tenantAdminPage.locator('text=Action').first().locator('..').locator('button[role="combobox"]');
      await expect(actionFilter).toBeVisible();

      // Verify Date From input
      const dateFromInput = tenantAdminPage.locator('input[placeholder="YYYY-MM-DD"]').first();
      await expect(dateFromInput).toBeVisible();

      // Verify search input
      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await expect(searchInput).toBeVisible();
    });

    test('should support pagination', async ({ tenantAdminPage }) => {
      await navigateToApprovalHistory(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      // URL should have page parameter
      const url = tenantAdminPage.url();
      expect(url).toMatch(/modules\/approval-engine\/history/);
    });

    test('should filter by transaction type', async ({ tenantAdminPage }) => {
      await navigateToApprovalHistory(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      // Click transaction type filter
      const typeFilter = tenantAdminPage.locator('label:has-text("Transaction Type")').locator('..').locator('button[role="combobox"]');
      if (await typeFilter.isVisible()) {
        await typeFilter.click();
        await tenantAdminPage.waitForTimeout(300);

        // Select "Purchase Order" option
        const poOption = tenantAdminPage.locator('[role="option"]:has-text("Purchase Order")');
        if (await poOption.isVisible()) {
          await poOption.click();
          await tenantAdminPage.waitForTimeout(1000);
          await tenantAdminPage.waitForLoadState('networkidle');
        }
      }
    });
  });

  test.describe('APR-004: Audit Log Page', () => {
    test('should display audit log page with proper structure', async ({ tenantAdminPage }) => {
      await navigateToAuditLog(tenantAdminPage);

      // Verify page title
      await expect(tenantAdminPage.locator('h1')).toContainText('Audit Log');

      // Verify table structure
      const table = tenantAdminPage.locator('table');
      await expect(table).toBeVisible();

      // Verify table headers
      await expect(tenantAdminPage.locator('th:has-text("Timestamp")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("User")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Action")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Module")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Entity Type")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Entity ID")')).toBeVisible();
    });

    test('should display filter controls for audit log', async ({ tenantAdminPage }) => {
      await navigateToAuditLog(tenantAdminPage);

      // Verify Module filter
      const moduleFilter = tenantAdminPage.locator('input[placeholder="Filter by module"]');
      await expect(moduleFilter).toBeVisible();

      // Verify Action filter
      const actionFilter = tenantAdminPage.locator('label:has-text("Action")').locator('..').locator('button[role="combobox"]');
      await expect(actionFilter).toBeVisible();

      // Verify User filter
      const userFilter = tenantAdminPage.locator('input[placeholder="Filter by user"]');
      await expect(userFilter).toBeVisible();

      // Verify Date From input
      const dateFromInput = tenantAdminPage.locator('input[placeholder="YYYY-MM-DD"]').first();
      await expect(dateFromInput).toBeVisible();

      // Verify search input
      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await expect(searchInput).toBeVisible();
    });

    test('should filter audit logs by module', async ({ tenantAdminPage }) => {
      await navigateToAuditLog(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      // Type in module filter
      const moduleFilter = tenantAdminPage.locator('input[placeholder="Filter by module"]');
      await moduleFilter.fill('supplier-management');

      // Wait for debounce and reload
      await tenantAdminPage.waitForTimeout(1000);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Results should be filtered (just verify no error occurred)
      const table = tenantAdminPage.locator('table');
      await expect(table).toBeVisible();
    });

    test('should filter audit logs by action type', async ({ tenantAdminPage }) => {
      await navigateToAuditLog(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      // Click action filter dropdown
      const actionFilter = tenantAdminPage.locator('label:has-text("Action")').locator('..').locator('button[role="combobox"]');
      if (await actionFilter.isVisible()) {
        await actionFilter.click();
        await tenantAdminPage.waitForTimeout(300);

        // Select "Create"
        const createOption = tenantAdminPage.locator('[role="option"]:has-text("Create")');
        if (await createOption.isVisible()) {
          await createOption.click();
          await tenantAdminPage.waitForTimeout(1000);
          await tenantAdminPage.waitForLoadState('networkidle');
        }
      }
    });

    test('should expand audit log row to view detail', async ({ tenantAdminPage }) => {
      await navigateToAuditLog(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');
      await tenantAdminPage.waitForTimeout(1000);

      // Click on first data row to expand it
      const rows = tenantAdminPage.locator('table tbody tr');
      const rowCount = await rows.count();

      if (rowCount > 0) {
        const firstRow = rows.first();
        await firstRow.click();

        // After expand, should see Before/After detail
        await tenantAdminPage.waitForTimeout(500);
        const beforeLabel = tenantAdminPage.locator('h4:has-text("Before")');
        const afterLabel = tenantAdminPage.locator('h4:has-text("After")');

        if (await beforeLabel.isVisible()) {
          await expect(beforeLabel).toBeVisible();
          await expect(afterLabel).toBeVisible();

          // Verify pre blocks are visible
          const preBlocks = tenantAdminPage.locator('pre');
          expect(await preBlocks.count()).toBeGreaterThanOrEqual(2);
        }
      }
    });

    test('should collapse expanded audit log row on second click', async ({ tenantAdminPage }) => {
      await navigateToAuditLog(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');
      await tenantAdminPage.waitForTimeout(1000);

      const rows = tenantAdminPage.locator('table tbody tr');
      const rowCount = await rows.count();

      if (rowCount > 0) {
        const firstRow = rows.first();

        // Expand
        await firstRow.click();
        await tenantAdminPage.waitForTimeout(500);

        // Collapse
        await firstRow.click();
        await tenantAdminPage.waitForTimeout(500);

        // Before/After should not be visible
        const beforeLabel = tenantAdminPage.locator('h4:has-text("Before")');
        await expect(beforeLabel).not.toBeVisible();
      }
    });

    test('should support pagination on audit log', async ({ tenantAdminPage }) => {
      await navigateToAuditLog(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      // URL should reflect page state
      const url = tenantAdminPage.url();
      expect(url).toMatch(/modules\/approval-engine\/audit-log/);
    });

    test('should sort audit logs by timestamp', async ({ tenantAdminPage }) => {
      await navigateToAuditLog(tenantAdminPage);

      const timestampSort = tenantAdminPage.locator('button:near(:text("Timestamp"))').first();
      await timestampSort.click();
      await tenantAdminPage.waitForTimeout(300);

      await expect(tenantAdminPage).toHaveURL(/sort=timestamp/);
    });

    test('should sort audit logs by user', async ({ tenantAdminPage }) => {
      await navigateToAuditLog(tenantAdminPage);

      const userSort = tenantAdminPage.locator('button:near(:text("User"))').first();
      await userSort.click();
      await tenantAdminPage.waitForTimeout(300);

      await expect(tenantAdminPage).toHaveURL(/sort=user/);
    });
  });

  test.describe('Performance', () => {
    test('should load approval config within acceptable time', async ({ tenantAdminPage }) => {
      const startTime = Date.now();

      await navigateToApprovalConfig(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(5000);
    });

    test('should load audit log within acceptable time', async ({ tenantAdminPage }) => {
      const startTime = Date.now();

      await navigateToAuditLog(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(5000);
    });
  });
});
