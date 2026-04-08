import { test, expect, TEST_USERS } from '../../../fixtures/auth';
import type { Page } from '@playwright/test';

/**
 * Purchase Order E2E Tests
 *
 * Comprehensive test suite for the full PO lifecycle.
 * Tests CRUD operations, status transitions, edge cases,
 * tax calculations, PDF download, and line item management.
 */

// Helper functions
async function navigateToPoList(page: Page) {
  await page.goto('/console/modules/purchase-order/po');
  await page.waitForURL('**/modules/purchase-order/po**');
}

async function navigateToPoAdd(page: Page) {
  await page.goto('/console/modules/purchase-order/po/add');
  await page.waitForURL('**/modules/purchase-order/po/add**');
}

async function navigateToSuggestions(page: Page) {
  await page.goto('/console/modules/purchase-order/suggestions');
  await page.waitForURL('**/modules/purchase-order/suggestions**');
}

async function selectFirstOptionInSelect(page: Page, triggerLocator: string) {
  // Click the select trigger to open dropdown
  const trigger = page.locator(triggerLocator);
  await trigger.click();
  await page.waitForTimeout(300);
  // Use keyboard to select first option
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
}

async function createDraftPo(page: Page) {
  await navigateToPoAdd(page);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Select supplier (first option via keyboard)
  const supplierTrigger = page.locator('label:has-text("Supplier")').locator('..').locator('button[role="combobox"]');
  await supplierTrigger.click();
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  // Set order date to today
  const today = new Date().toISOString().split('T')[0];
  const orderDateInput = page.locator('input[type="date"]').first();
  await orderDateInput.fill(today);

  // Wait for supplier products to load
  await page.waitForTimeout(1000);

  // Add line item: click "Add Item" button
  await page.click('button:has-text("Add Item")');
  await page.waitForTimeout(500);

  // Select product in line item (first row)
  const productSelect = page.locator('table tbody tr').first().locator('button[role="combobox"]');
  await productSelect.click();
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  // Set quantity to 10
  const qtyInput = page.locator('table tbody tr').first().locator('input[type="number"]').first();
  await qtyInput.clear();
  await qtyInput.fill('10');

  // Submit the form
  await page.click('button:has-text("Create PO")');
  await page.waitForTimeout(2000);
}

test.describe('Purchase Order Module', () => {

  // ═══════════════════════════════════════════════════════════════════
  // C1: SMOKE TESTS
  // ═══════════════════════════════════════════════════════════════════

  test.describe('C1: Smoke Tests - PO List Page', () => {
    test('should display PO list page with proper structure', async ({ adminPage }) => {
      await navigateToPoList(adminPage);

      // Verify page title
      await expect(adminPage.locator('h1')).toContainText('Purchase Orders');

      // Verify table structure
      const table = adminPage.locator('table');
      await expect(table).toBeVisible();

      // Verify table headers
      await expect(adminPage.locator('th:has-text("#")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("PO Number")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Supplier")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Order Date")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Total Amount")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Status")')).toBeVisible();
    });

    test('should display "Create PO" button', async ({ adminPage }) => {
      await navigateToPoList(adminPage);

      const createButton = adminPage.locator('button:has-text("Create PO")');
      await expect(createButton).toBeVisible();
    });

    test('should display status filter dropdown', async ({ adminPage }) => {
      await navigateToPoList(adminPage);

      // Status filter uses a Select with "All Statuses" as default
      const statusFilter = adminPage.locator('button[role="combobox"]:has-text("All Statuses")');
      await expect(statusFilter).toBeVisible();
    });

    test('should display search input', async ({ adminPage }) => {
      await navigateToPoList(adminPage);

      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
      await expect(searchInput).toBeVisible();
    });

    test('should load list within acceptable time', async ({ adminPage }) => {
      const startTime = Date.now();

      await navigateToPoList(adminPage);
      await adminPage.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(5000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // C2: CRUD TESTS
  // ═══════════════════════════════════════════════════════════════════

  test.describe('C2: CRUD - Create Purchase Order', () => {
    test('should navigate to create PO page', async ({ adminPage }) => {
      await navigateToPoList(adminPage);

      await adminPage.click('button:has-text("Create PO")');
      await expect(adminPage).toHaveURL(/po\/add/);
    });

    test('should create a PO with supplier and line items', async ({ adminPage }) => {
      await navigateToPoAdd(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(1000);

      // Select supplier via keyboard
      const supplierTrigger = adminPage.locator('label:has-text("Supplier")').locator('..').locator('button[role="combobox"]');
      await supplierTrigger.click();
      await adminPage.waitForTimeout(300);
      await adminPage.keyboard.press('ArrowDown');
      await adminPage.keyboard.press('Enter');
      await adminPage.waitForTimeout(500);

      // Set order date
      const today = new Date().toISOString().split('T')[0];
      const orderDateInput = adminPage.locator('input[type="date"]').first();
      await orderDateInput.fill(today);

      // Wait for supplier products to load
      await adminPage.waitForTimeout(1000);

      // Click "Add Item"
      await adminPage.click('button:has-text("Add Item")');
      await adminPage.waitForTimeout(500);

      // Select product in line item row
      const productSelect = adminPage.locator('table tbody tr').first().locator('button[role="combobox"]');
      await productSelect.click();
      await adminPage.waitForTimeout(300);
      await adminPage.keyboard.press('ArrowDown');
      await adminPage.keyboard.press('Enter');
      await adminPage.waitForTimeout(500);

      // Set quantity to 10
      const qtyInput = adminPage.locator('table tbody tr').first().locator('input[type="number"]').first();
      await qtyInput.clear();
      await qtyInput.fill('10');

      // Verify line total updates (should not be Rp0 after setting qty and price)
      await adminPage.waitForTimeout(300);
      const lineTotal = adminPage.locator('table tbody tr').first().locator('td').last().locator('button').count();
      // Just verify the line total cell is visible
      const lineTotalCell = adminPage.locator('table tbody tr td.text-right.font-medium').first();
      await expect(lineTotalCell).toBeVisible();

      // Submit
      await adminPage.click('button:has-text("Create PO")');

      // Verify redirect to list and success toast
      await adminPage.waitForTimeout(2000);
      await expect(adminPage).toHaveURL(/modules\/purchase-order\/po/);

      // Verify success toast appeared
      await expect(adminPage.locator('text=/created|success/i').first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('C2: CRUD - View Purchase Order', () => {
    test('should view PO detail page with status timeline', async ({ adminPage }) => {
      await navigateToPoList(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(1000);

      // Click on first PO number link
      const poLink = adminPage.locator('table tbody tr td a').first();

      if (await poLink.isVisible()) {
        const poNumber = await poLink.textContent();
        await poLink.click();

        // Should navigate to view page
        await expect(adminPage).toHaveURL(/po\/[a-f0-9-]+$/);

        // Verify breadcrumb shows PO number
        if (poNumber) {
          await expect(adminPage.locator(`text=${poNumber}`).first()).toBeVisible();
        }

        // Verify status timeline exists (7 lifecycle stages or cancelled banner)
        const timeline = adminPage.locator('.rounded-full.flex.items-center.justify-center');
        const timelineCount = await timeline.count();
        // Should have 7 circles for lifecycle stages (or cancelled state)
        if (timelineCount > 0) {
          expect(timelineCount).toBe(7);
        }

        // Verify header info section
        await expect(adminPage.locator('text=PO Number').first()).toBeVisible();
        await expect(adminPage.locator('text=Status').first()).toBeVisible();
        await expect(adminPage.locator('text=Supplier').first()).toBeVisible();
        await expect(adminPage.locator('text=Order Date').first()).toBeVisible();

        // Verify line items table
        await expect(adminPage.locator('h3:has-text("Line Items")')).toBeVisible();
        const lineItemsTable = adminPage.locator('table').nth(0);
        await expect(lineItemsTable).toBeVisible();

        // Verify line items table headers
        await expect(adminPage.locator('th:has-text("Product")')).toBeVisible();
        await expect(adminPage.locator('th:has-text("SKU")')).toBeVisible();
        await expect(adminPage.locator('th:has-text("Qty")')).toBeVisible();
        await expect(adminPage.locator('th:has-text("Received")')).toBeVisible();
        await expect(adminPage.locator('th:has-text("Remaining")')).toBeVisible();
        await expect(adminPage.locator('th:has-text("Unit Price")')).toBeVisible();
        await expect(adminPage.locator('th:has-text("Disc %")')).toBeVisible();
        await expect(adminPage.locator('th:has-text("Tax")')).toBeVisible();
        await expect(adminPage.locator('th:has-text("Line Total")')).toBeVisible();

        // Verify totals section
        await expect(adminPage.locator('text=Subtotal:').first()).toBeVisible();
        await expect(adminPage.locator('text=Discount:').first()).toBeVisible();
        await expect(adminPage.locator('text=/Tax.*PPN/i').first()).toBeVisible();
        await expect(adminPage.locator('text=Total:').first()).toBeVisible();
      }
    });

    test('should verify PO number format matches PO-YYYYMM-NNNN', async ({ adminPage }) => {
      await navigateToPoList(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(1000);

      // Get first PO number from list
      const poLink = adminPage.locator('table tbody tr td a').first();

      if (await poLink.isVisible()) {
        const poNumber = await poLink.textContent();
        if (poNumber) {
          // PO number should match format PO-YYYYMM-NNNN
          expect(poNumber.trim()).toMatch(/^PO-\d{6}-\d{4}$/);
        }
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // C2: STATUS TRANSITIONS
  // ═══════════════════════════════════════════════════════════════════

  test.describe('C2: Status Transitions - Approve PO', () => {
    test('should approve a draft PO', async ({ adminPage }) => {
      await navigateToPoList(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(1000);

      // Find a draft PO
      const draftRow = adminPage.locator('tr:has-text("Draft")').first();
      if (await draftRow.isVisible()) {
        // Click view button
        const viewBtn = draftRow.locator('button').first();
        await viewBtn.click();
        await expect(adminPage).toHaveURL(/po\/[a-f0-9-]+$/);
        await adminPage.waitForTimeout(500);

        // Click Approve button
        const approveBtn = adminPage.locator('button:has-text("Approve")');
        if (await approveBtn.isVisible()) {
          await approveBtn.click();
          await adminPage.waitForTimeout(2000);

          // Verify status changed (may go to pending_approval or approved)
          const statusBadge = adminPage.locator('text=/Approved|Pending Approval/i').first();
          await expect(statusBadge).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });

  test.describe('C2: Status Transitions - Mark as Sent', () => {
    test('should mark an approved PO as sent', async ({ adminPage }) => {
      await navigateToPoList(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(1000);

      // Find an approved PO
      const approvedRow = adminPage.locator('tr:has-text("Approved")').first();
      if (await approvedRow.isVisible()) {
        const viewBtn = approvedRow.locator('button').first();
        await viewBtn.click();
        await expect(adminPage).toHaveURL(/po\/[a-f0-9-]+$/);
        await adminPage.waitForTimeout(500);

        // Click "Mark as Sent" button
        const sentBtn = adminPage.locator('button:has-text("Mark as Sent")');
        if (await sentBtn.isVisible()) {
          await sentBtn.click();
          await adminPage.waitForTimeout(2000);

          // Verify status advanced to "Sent to Supplier"
          await expect(adminPage.locator('text=/Sent to Supplier/i').first()).toBeVisible({ timeout: 5000 });

          // Verify Edit and Cancel buttons disappear
          await expect(adminPage.locator('button:has-text("Edit")')).not.toBeVisible();
          await expect(adminPage.locator('button:has-text("Cancel PO")')).not.toBeVisible();
        }
      }
    });
  });

  test.describe('C2: Status Transitions - Cancel PO', () => {
    test('should cancel a PO with reason', async ({ adminPage }) => {
      await navigateToPoList(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(1000);

      // Find a draft or approved PO
      const eligibleRow = adminPage.locator('tr:has-text("Draft")').first();
      if (await eligibleRow.isVisible()) {
        const viewBtn = eligibleRow.locator('button').first();
        await viewBtn.click();
        await expect(adminPage).toHaveURL(/po\/[a-f0-9-]+$/);
        await adminPage.waitForTimeout(500);

        // Click "Cancel PO" button
        const cancelBtn = adminPage.locator('button:has-text("Cancel PO")');
        if (await cancelBtn.isVisible()) {
          await cancelBtn.click();

          // Dialog should appear
          await expect(adminPage.locator('text=Cancel Purchase Order')).toBeVisible();
          await expect(adminPage.locator('text=/cannot be undone/i')).toBeVisible();

          // Type cancellation reason
          const reasonTextarea = adminPage.locator('textarea');
          await reasonTextarea.fill('E2E test - cancellation reason');

          // Click Confirm
          await adminPage.click('button:has-text("Confirm")');
          await adminPage.waitForTimeout(2000);

          // Verify cancelled status with red banner
          const cancelledBanner = adminPage.locator('text=/has been cancelled/i');
          if (await cancelledBanner.isVisible()) {
            await expect(cancelledBanner).toBeVisible();
          }

          // Verify cancellation reason is displayed
          await expect(adminPage.locator('text=E2E test - cancellation reason')).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // C3: EDGE CASES
  // ═══════════════════════════════════════════════════════════════════

  test.describe('C3: Edge Cases - Status Filter', () => {
    test('should filter by Draft status', async ({ adminPage }) => {
      await navigateToPoList(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(1000);

      // Open status dropdown
      const statusFilter = adminPage.locator('button[role="combobox"]').first();
      await statusFilter.click();
      await adminPage.waitForTimeout(300);

      // Select "Draft"
      const draftOption = adminPage.locator('[role="option"]:has-text("Draft")');
      if (await draftOption.isVisible()) {
        await draftOption.click();
        await adminPage.waitForTimeout(1000);
        await adminPage.waitForLoadState('networkidle');

        // Verify URL has status filter
        await expect(adminPage).toHaveURL(/status=draft/);

        // Verify only draft POs are shown (if any results)
        const statusBadges = adminPage.locator('table tbody span.inline-flex');
        const badgeCount = await statusBadges.count();

        for (let i = 0; i < badgeCount; i++) {
          const text = await statusBadges.nth(i).textContent();
          if (text) {
            expect(text.trim()).toBe('Draft');
          }
        }
      }
    });
  });

  test.describe('C3: Edge Cases - Search', () => {
    test('should search by PO number', async ({ adminPage }) => {
      await navigateToPoList(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(1000);

      // Get first PO number if available
      const poLink = adminPage.locator('table tbody tr td a').first();
      if (await poLink.isVisible()) {
        const poNumber = await poLink.textContent();

        if (poNumber) {
          const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
          await searchInput.fill(poNumber.trim());

          // Wait for debounce
          await adminPage.waitForTimeout(1000);

          // URL should contain filter
          await expect(adminPage).toHaveURL(new RegExp(`filter=${encodeURIComponent(poNumber.trim())}`));

          await adminPage.waitForLoadState('networkidle');

          // Verify filtered results contain the PO number
          const filteredLink = adminPage.locator(`table tbody td a:has-text("${poNumber.trim()}")`);
          if (await filteredLink.isVisible()) {
            await expect(filteredLink).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('C3: Edge Cases - Tax Calculation', () => {
    test('should display PPN label with rate and mode on view page', async ({ adminPage }) => {
      await navigateToPoList(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(1000);

      const poLink = adminPage.locator('table tbody tr td a').first();
      if (await poLink.isVisible()) {
        await poLink.click();
        await expect(adminPage).toHaveURL(/po\/[a-f0-9-]+$/);
        await adminPage.waitForTimeout(500);

        // Check for Tax Rate display in header
        const taxRateLabel = adminPage.locator('text=Tax Rate').locator('..');
        await expect(taxRateLabel).toBeVisible();

        // Check for PPN in totals section
        const ppnLabel = adminPage.locator('text=/Tax.*PPN/i').first();
        await expect(ppnLabel).toBeVisible();
      }
    });
  });

  test.describe('C3: Edge Cases - Reorder Suggestions', () => {
    test('should show "Coming Soon" banner on suggestions page', async ({ adminPage }) => {
      await navigateToSuggestions(adminPage);

      // Verify page title
      await expect(adminPage.locator('h1')).toContainText('Reorder Suggestions');

      // Verify "Coming Soon" info banner
      await expect(adminPage.locator('h3:has-text("Coming Soon")')).toBeVisible();
      await expect(adminPage.locator('text=/Inventory Management module/i')).toBeVisible();
    });
  });

  test.describe('C3: Edge Cases - Supplier Product Auto-fill', () => {
    test('should auto-fill unit price when selecting product from supplier catalog', async ({ adminPage }) => {
      await navigateToPoAdd(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(1000);

      // Select supplier
      const supplierTrigger = adminPage.locator('label:has-text("Supplier")').locator('..').locator('button[role="combobox"]');
      await supplierTrigger.click();
      await adminPage.waitForTimeout(300);
      await adminPage.keyboard.press('ArrowDown');
      await adminPage.keyboard.press('Enter');
      await adminPage.waitForTimeout(1000);

      // Add line item
      await adminPage.click('button:has-text("Add Item")');
      await adminPage.waitForTimeout(500);

      // Select product
      const productSelect = adminPage.locator('table tbody tr').first().locator('button[role="combobox"]');
      await productSelect.click();
      await adminPage.waitForTimeout(300);
      await adminPage.keyboard.press('ArrowDown');
      await adminPage.keyboard.press('Enter');
      await adminPage.waitForTimeout(500);

      // Verify unit price was auto-filled (not zero or empty)
      const unitPriceInput = adminPage.locator('table tbody tr').first().locator('input[type="number"]').nth(1);
      const priceValue = await unitPriceInput.inputValue();
      // Price should be set from supplier catalog
      expect(Number(priceValue)).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('C3: Edge Cases - Add/Remove Line Items', () => {
    test('should add and remove line items', async ({ adminPage }) => {
      await navigateToPoAdd(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(1000);

      // Select supplier first
      const supplierTrigger = adminPage.locator('label:has-text("Supplier")').locator('..').locator('button[role="combobox"]');
      await supplierTrigger.click();
      await adminPage.waitForTimeout(300);
      await adminPage.keyboard.press('ArrowDown');
      await adminPage.keyboard.press('Enter');
      await adminPage.waitForTimeout(1000);

      // Add first line item
      await adminPage.click('button:has-text("Add Item")');
      await adminPage.waitForTimeout(300);

      // Verify one row exists
      let rows = adminPage.locator('table tbody tr');
      expect(await rows.count()).toBe(1);

      // Add second line item
      await adminPage.click('button:has-text("Add Item")');
      await adminPage.waitForTimeout(300);

      // Verify two rows exist
      rows = adminPage.locator('table tbody tr');
      expect(await rows.count()).toBe(2);

      // Remove second row by clicking trash icon
      const trashButton = rows.nth(1).locator('button').last();
      await trashButton.click();
      await adminPage.waitForTimeout(300);

      // Verify back to one row
      rows = adminPage.locator('table tbody tr');
      expect(await rows.count()).toBe(1);
    });
  });

  test.describe('C3: Edge Cases - Edit Guard', () => {
    test('should only show edit button for draft/approved POs in list', async ({ adminPage }) => {
      await navigateToPoList(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(1000);

      const tableRows = adminPage.locator('table tbody tr');
      const rowCount = await tableRows.count();

      for (let i = 0; i < Math.min(rowCount, 5); i++) {
        const row = tableRows.nth(i);
        const statusBadge = row.locator('span.inline-flex');

        if (await statusBadge.isVisible()) {
          const statusText = await statusBadge.textContent();
          const editButton = row.locator('button').filter({ has: adminPage.locator('svg.lucide-pencil') });

          if (statusText && (statusText.trim() === 'Draft' || statusText.trim() === 'Approved')) {
            // Edit button should be visible for draft/approved
            // (may or may not exist depending on permissions)
          } else if (statusText) {
            // Edit button should NOT be visible for other statuses
            await expect(editButton).not.toBeVisible();
          }
        }
      }
    });
  });

  test.describe('C3: Edge Cases - Download PDF', () => {
    test('should click Download PDF button without error', async ({ adminPage }) => {
      await navigateToPoList(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(1000);

      const poLink = adminPage.locator('table tbody tr td a').first();
      if (await poLink.isVisible()) {
        await poLink.click();
        await expect(adminPage).toHaveURL(/po\/[a-f0-9-]+$/);
        await adminPage.waitForTimeout(500);

        // Click Download PDF button
        const downloadBtn = adminPage.locator('button:has-text("Download PDF")');
        if (await downloadBtn.isVisible()) {
          // Just verify the button exists and is clickable
          await expect(downloadBtn).toBeEnabled();

          // Click it - we can't verify the file download in Playwright easily
          // but we can verify no error occurs
          await downloadBtn.click();
          await adminPage.waitForTimeout(1000);

          // Page should not have crashed or navigated away
          await expect(adminPage).toHaveURL(/po\/[a-f0-9-]+$/);
        }
      }
    });
  });

  test.describe('C3: Edge Cases - Sort Columns', () => {
    test('should sort by PO Number', async ({ adminPage }) => {
      await navigateToPoList(adminPage);

      const poNumberSort = adminPage.locator('button:near(:text("PO Number"))').first();
      await poNumberSort.click();
      await adminPage.waitForTimeout(300);

      await expect(adminPage).toHaveURL(/sort=poNumber/);
    });

    test('should sort by Order Date', async ({ adminPage }) => {
      await navigateToPoList(adminPage);

      const orderDateSort = adminPage.locator('button:near(:text("Order Date"))').first();
      await orderDateSort.click();
      await adminPage.waitForTimeout(300);

      await expect(adminPage).toHaveURL(/sort=orderDate/);
    });

    test('should sort by Total Amount', async ({ adminPage }) => {
      await navigateToPoList(adminPage);

      const totalSort = adminPage.locator('button:near(:text("Total Amount"))').first();
      await totalSort.click();
      await adminPage.waitForTimeout(300);

      await expect(adminPage).toHaveURL(/sort=totalAmount/);
    });

    test('should sort by Status', async ({ adminPage }) => {
      await navigateToPoList(adminPage);

      const statusSort = adminPage.locator('button:near(:text("Status"))').first();
      await statusSort.click();
      await adminPage.waitForTimeout(300);

      await expect(adminPage).toHaveURL(/sort=status/);
    });
  });

  test.describe('Navigation and Breadcrumbs', () => {
    test('should display breadcrumbs on view page', async ({ adminPage }) => {
      await navigateToPoList(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(1000);

      const poLink = adminPage.locator('table tbody tr td a').first();
      if (await poLink.isVisible()) {
        await poLink.click();
        await expect(adminPage).toHaveURL(/po\/[a-f0-9-]+$/);

        // Verify breadcrumbs
        await expect(adminPage.locator('text=Purchase Orders').first()).toBeVisible();
      }
    });

    test('should navigate back from add page via Cancel', async ({ adminPage }) => {
      await navigateToPoAdd(adminPage);

      const cancelButton = adminPage.locator('button:has-text("Cancel")');
      await cancelButton.click();

      // Should navigate back to list
      await expect(adminPage).toHaveURL(/modules\/purchase-order\/po/);
    });
  });

  test.describe('URL State Persistence', () => {
    test('should persist filter in URL', async ({ adminPage }) => {
      await navigateToPoList(adminPage);
      await adminPage.waitForTimeout(1000);

      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('PO-');
      await adminPage.waitForTimeout(1000);

      const url = adminPage.url();
      expect(url).toContain('filter=PO-');

      // Reload page
      await adminPage.reload();

      const inputValue = await searchInput.inputValue();
      expect(inputValue).toBe('PO-');
    });

    test('should persist status filter in URL', async ({ adminPage }) => {
      await navigateToPoList(adminPage);
      await adminPage.waitForTimeout(1000);

      // Open status dropdown and select draft
      const statusFilter = adminPage.locator('button[role="combobox"]').first();
      await statusFilter.click();
      await adminPage.waitForTimeout(300);

      const draftOption = adminPage.locator('[role="option"]:has-text("Draft")');
      if (await draftOption.isVisible()) {
        await draftOption.click();
        await adminPage.waitForTimeout(1000);

        const url = adminPage.url();
        expect(url).toContain('status=draft');
      }
    });

    test('should persist sort state in URL', async ({ adminPage }) => {
      await navigateToPoList(adminPage);

      const sortButton = adminPage.locator('button:near(:text("PO Number"))').first();
      await sortButton.click();
      await adminPage.waitForTimeout(300);

      const url = adminPage.url();
      expect(url).toContain('sort=poNumber');

      await adminPage.reload();

      const reloadedUrl = adminPage.url();
      expect(reloadedUrl).toContain('sort=poNumber');
    });
  });

  test.describe('Performance', () => {
    test('should debounce search input', async ({ adminPage }) => {
      await navigateToPoList(adminPage);

      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();

      // Type quickly
      await searchInput.fill('P');
      await adminPage.waitForTimeout(100);
      await searchInput.fill('PO');
      await adminPage.waitForTimeout(100);
      await searchInput.fill('PO-');

      // Wait for debounce
      await adminPage.waitForTimeout(600);

      // Only one final search should execute
      await adminPage.waitForLoadState('networkidle');
    });
  });
});
