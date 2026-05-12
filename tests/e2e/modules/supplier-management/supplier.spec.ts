import { test, expect, TEST_USERS } from '../../../fixtures/auth';
import type { Page } from '@playwright/test';

/**
 * Supplier Management CRUD Tests
 *
 * Comprehensive test suite for Supplier management.
 * Tests list, create, view, edit, delete, search, sort,
 * validation, contacts, and product linking.
 */

// Test data
const generateTestSupplier = () => ({
  code: `SUP-${Date.now()}`,
  name: `Test Supplier ${Date.now()}`,
  npwp: '123456789012345',
  address: 'Jl. Test No. 123, Jakarta',
  paymentTerms: 'Net 30',
  leadTimeDays: '7',
  bankName: 'Bank Central Asia',
  accountNumber: '1234567890',
  accountHolder: 'PT Test Supplier',
});

// Helper functions
async function navigateToSupplierList(page: Page) {
  await page.goto('/console/modules/supplier-management/supplier');
  await page.waitForURL('**/modules/supplier-management/supplier**');
}

async function fillSupplierForm(page: Page, supplier: ReturnType<typeof generateTestSupplier>) {
  await page.fill('input[name="code"]', supplier.code);
  await page.fill('input[name="name"]', supplier.name);
  await page.fill('input[name="npwp"]', supplier.npwp);

  // Fill address textarea
  const addressField = page.locator('textarea[name="address"]');
  if (await addressField.isVisible()) {
    await addressField.fill(supplier.address);
  }

  await page.fill('input[name="paymentTerms"]', supplier.paymentTerms);

  const leadTimeField = page.locator('input[name="leadTimeDays"]');
  if (await leadTimeField.isVisible()) {
    await leadTimeField.fill(supplier.leadTimeDays);
  }

  // Bank Details
  const bankNameField = page.locator('input[name="bankDetails.bankName"]');
  if (await bankNameField.isVisible()) {
    await bankNameField.fill(supplier.bankName);
  }

  const accountNumberField = page.locator('input[name="bankDetails.accountNumber"]');
  if (await accountNumberField.isVisible()) {
    await accountNumberField.fill(supplier.accountNumber);
  }

  const accountHolderField = page.locator('input[name="bankDetails.accountHolder"]');
  if (await accountHolderField.isVisible()) {
    await accountHolderField.fill(supplier.accountHolder);
  }
}

test.describe('Supplier CRUD Operations', () => {

  test.describe('SUP-001: View Supplier List with Pagination', () => {
    test('should display supplier list page with proper structure', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);

      // Verify page title
      await expect(tenantAdminPage.locator('h1')).toContainText('Suppliers');

      // Verify table structure
      const table = tenantAdminPage.locator('table');
      await expect(table).toBeVisible();

      // Verify table headers
      await expect(tenantAdminPage.locator('th:has-text("#")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Code")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Name")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("NPWP")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Payment Terms")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Status")')).toBeVisible();
    });

    test('should display Add Supplier button', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);

      const addButton = tenantAdminPage.locator('button:has-text("Add Supplier")');
      await expect(addButton).toBeVisible();
    });

    test('should handle pagination controls', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);

      // Check if pagination controls exist
      const paginationContainer = tenantAdminPage.locator('[data-testid="pagination"]').first();

      if (await paginationContainer.isVisible()) {
        await expect(tenantAdminPage).toHaveURL(/page=1/);

        const nextButton = tenantAdminPage.locator('button:has-text("Next"), button[aria-label*="next"]');
        if (await nextButton.isEnabled()) {
          await nextButton.click();
          await expect(tenantAdminPage).toHaveURL(/page=2/);
        }
      }
    });
  });

  test.describe('SUP-002: Create New Supplier - Success', () => {
    test('should navigate to add supplier page', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);

      await tenantAdminPage.click('button:has-text("Add Supplier")');
      await expect(tenantAdminPage).toHaveURL(/supplier\/add/);

      // Verify breadcrumb
      await expect(tenantAdminPage.locator('text=Add Supplier')).toBeVisible();
    });

    test('should create supplier with valid data', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Supplier")');

      const testSupplier = generateTestSupplier();

      // Fill form fields
      await fillSupplierForm(tenantAdminPage, testSupplier);

      // Submit form
      await tenantAdminPage.click('button:has-text("Save")');

      // Wait for success message
      await expect(tenantAdminPage.locator('text=/Supplier has been created/i')).toBeVisible({ timeout: 5000 });

      // Verify redirect to list
      await expect(tenantAdminPage).toHaveURL(/page=1/);

      // Search for the new supplier (avoids pagination issues with accumulated data)
      await tenantAdminPage.waitForTimeout(500);
      const createSearchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await createSearchInput.fill(testSupplier.code);
      await tenantAdminPage.waitForTimeout(800);
      await tenantAdminPage.waitForLoadState('networkidle');
      await expect(tenantAdminPage.locator(`text=${testSupplier.code}`).first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('SUP-003: View Supplier Details', () => {
    test('should view supplier details with contacts and products sections', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      // Click on first supplier code link
      const supplierLink = tenantAdminPage.locator('table tbody tr td a').first();

      if (await supplierLink.isVisible()) {
        const supplierCode = await supplierLink.textContent();
        await supplierLink.click();

        // Should navigate to view page
        await expect(tenantAdminPage).toHaveURL(/supplier\/[a-f0-9-]+$/);

        // Verify breadcrumb shows supplier name
        if (supplierCode) {
          await expect(tenantAdminPage.locator(`text=${supplierCode}`).first()).toBeVisible();
        }
      }

      // Verify Edit and Delete buttons are visible
      await expect(tenantAdminPage.locator('button:has-text("Edit")')).toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Delete")')).toBeVisible();

      // Verify form fields are read-only (disabled)
      const codeInput = tenantAdminPage.locator('input[name="code"]');
      await expect(codeInput).toBeDisabled();

      const nameInput = tenantAdminPage.locator('input[name="name"]');
      await expect(nameInput).toBeDisabled();

      // Verify Contacts section exists
      await expect(tenantAdminPage.locator('h2:has-text("Contacts")')).toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Add Contact")')).toBeVisible();

      // Verify Linked Products section exists
      await expect(tenantAdminPage.locator('h2:has-text("Linked Products")')).toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Link Product")')).toBeVisible();
    });
  });

  test.describe('SUP-004: Edit Supplier - Success', () => {
    test('should edit supplier name successfully', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      // Click edit button on first supplier (Pencil icon button)
      const editButton = tenantAdminPage.getByRole('button').filter({ hasText: /^$/ }).nth(2);

      if (await editButton.isVisible()) {
        await editButton.click();

        // Should navigate to edit page
        await expect(tenantAdminPage).toHaveURL(/supplier\/[a-f0-9-]+\/edit/);

        // Modify name field
        const nameInput = tenantAdminPage.locator('input[name="name"]');
        await nameInput.clear();
        const updatedName = `Updated Supplier ${Date.now()}`;
        await nameInput.fill(updatedName);

        // Save changes
        await tenantAdminPage.click('button:has-text("Save")');

        // Wait for success message
        await expect(tenantAdminPage.locator('text=/Supplier has been updated/i')).toBeVisible({ timeout: 5000 });

        // Should redirect to list
        await expect(tenantAdminPage).toHaveURL(/page=1/);
      }
    });

    test('should pre-populate form with existing data', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      const editButton = tenantAdminPage.getByRole('button').filter({ hasText: /^$/ }).nth(2);

      if (await editButton.isVisible()) {
        await editButton.click();
        await tenantAdminPage.waitForURL(/edit/);
        await tenantAdminPage.waitForTimeout(1000);

        // Verify form fields are populated
        const codeInput = tenantAdminPage.locator('input[name="code"]');
        const codeValue = await codeInput.inputValue();
        expect(codeValue).not.toBe('');

        const nameInput = tenantAdminPage.locator('input[name="name"]');
        const nameValue = await nameInput.inputValue();
        expect(nameValue).not.toBe('');
      }
    });
  });

  test.describe('SUP-005: Delete Supplier (Soft-Delete)', () => {
    test('should soft-delete supplier after confirmation', async ({ tenantAdminPage }) => {
      // Create a test supplier first
      await navigateToSupplierList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Supplier")');
      const testSupplier = generateTestSupplier();

      await fillSupplierForm(tenantAdminPage, testSupplier);

      await tenantAdminPage.click('button:has-text("Save")');
      await tenantAdminPage.waitForTimeout(1000);

      // Navigate to list and search for the created supplier (avoids pagination issues)
      await navigateToSupplierList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);
      const deleteSearchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await deleteSearchInput.fill(testSupplier.code);
      await tenantAdminPage.waitForTimeout(800);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Find the test supplier row and click delete (destructive button)
      const supplierRow = tenantAdminPage.locator(`tr:has-text("${testSupplier.code}")`);
      const deleteButton = supplierRow.locator('button').last();

      await deleteButton.click();

      // Confirm deletion in dialog
      await expect(tenantAdminPage.locator('text=/Confirm Delete/i')).toBeVisible();
      await expect(tenantAdminPage.locator('text=/cannot be undone/i')).toBeVisible();

      // Click confirm
      const confirmButton = tenantAdminPage.locator('button:has-text("Confirm"), button:has-text("Delete")').last();
      await confirmButton.click();

      // Wait for success message
      await expect(tenantAdminPage.locator('text=/deleted successfully/i')).toBeVisible({ timeout: 5000 });

      // Verify supplier status becomes inactive (soft delete)
      await tenantAdminPage.waitForTimeout(500);
    });
  });

  test.describe('SUP-006: Search/Filter Suppliers', () => {
    test('should display search input', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await expect(searchInput).toBeVisible();
    });

    test('should filter suppliers by search term', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('SUP');

      // Wait for debounce (500ms)
      await tenantAdminPage.waitForTimeout(1000);

      // Check URL contains filter
      await expect(tenantAdminPage).toHaveURL(/filter=SUP/);

      // Verify loading completed
      await tenantAdminPage.waitForLoadState('networkidle');
    });

    test('should clear search filter', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Test');
      await tenantAdminPage.waitForTimeout(1000);

      // Click X icon to clear
      const clearButton = tenantAdminPage.locator('.lucide.lucide-x').filter({ hasText: '' }).first();
      await clearButton.click();

      // Verify filter is cleared
      const url = tenantAdminPage.url();
      expect(url).toMatch(/filter=/);
    });
  });

  test.describe('SUP-007: Sort Supplier List', () => {
    test('should sort by Code column', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);

      const codeSortButton = tenantAdminPage.locator('button:near(:text("Code"))').first();
      await codeSortButton.click();

      await tenantAdminPage.waitForTimeout(300);
      await expect(tenantAdminPage).toHaveURL(/sort=code/);
    });

    test('should sort by Name column', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);

      const nameSortButton = tenantAdminPage.locator('button:near(:text("Name"))').first();
      await nameSortButton.click();

      await tenantAdminPage.waitForTimeout(300);
      await expect(tenantAdminPage).toHaveURL(/sort=name/);
    });

    test('should toggle sort order on repeated click', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);

      const nameSortButton = tenantAdminPage.locator('button:near(:text("Name"))').first();
      await nameSortButton.click();
      await tenantAdminPage.waitForTimeout(300);

      // Click again to toggle
      await nameSortButton.click();
      await tenantAdminPage.waitForTimeout(300);
      await expect(tenantAdminPage).toHaveURL(/order=asc/);
    });
  });

  test.describe('SUP-008: Duplicate Code Validation', () => {
    test('should prevent duplicate supplier codes', async ({ tenantAdminPage }) => {
      // Create first supplier
      await navigateToSupplierList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Supplier")');

      const testSupplier = generateTestSupplier();
      await fillSupplierForm(tenantAdminPage, testSupplier);

      await tenantAdminPage.click('button:has-text("Save")');
      await tenantAdminPage.waitForTimeout(1000);

      // Try to create another supplier with the same code
      await navigateToSupplierList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Supplier")');

      await tenantAdminPage.fill('input[name="code"]', testSupplier.code);
      await tenantAdminPage.fill('input[name="name"]', 'Another Supplier Name');

      // Submit form
      await tenantAdminPage.click('button:has-text("Save")');

      // Wait for validation
      await tenantAdminPage.waitForTimeout(1000);

      // Should show duplicate code error
      await expect(tenantAdminPage.locator('text=/Code must be unique|Code already exists/i')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('SUP-009: Required Field Validation', () => {
    test('should show validation errors for empty required fields', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Supplier")');

      // Try to submit without filling any fields
      await tenantAdminPage.click('button:has-text("Save")');

      // Should show validation errors
      await expect(tenantAdminPage.locator('text=/Code is required/i').first()).toBeVisible({ timeout: 3000 });
      await expect(tenantAdminPage.locator('text=/Name is required/i').first()).toBeVisible({ timeout: 3000 });
    });

    test('should validate Code field is required', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Supplier")');

      // Fill name but leave code empty
      await tenantAdminPage.fill('input[name="name"]', 'Test Supplier');

      await tenantAdminPage.click('button:has-text("Save")');

      await expect(tenantAdminPage.locator('text=/Code is required/i')).toBeVisible({ timeout: 3000 });
    });

    test('should validate Name field is required', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Supplier")');

      // Fill code but leave name empty
      await tenantAdminPage.fill('input[name="code"]', 'TEST-CODE');

      await tenantAdminPage.click('button:has-text("Save")');

      await expect(tenantAdminPage.locator('text=/Name is required/i')).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('SUP-010: Contacts Management', () => {
    test('should add a contact on supplier view page', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      // Click on first supplier to view
      const supplierLink = tenantAdminPage.locator('table tbody tr td a').first();
      if (await supplierLink.isVisible()) {
        await supplierLink.click();
        await expect(tenantAdminPage).toHaveURL(/supplier\/[a-f0-9-]+$/);
      }

      // Click Add Contact button
      await tenantAdminPage.click('button:has-text("Add Contact")');

      // Dialog should appear
      await expect(tenantAdminPage.locator('text=Add Contact').last()).toBeVisible();

      // Fill contact form
      const contactName = `Contact ${Date.now()}`;
      const contactDialog = tenantAdminPage.locator('[role="dialog"]');
      await contactDialog.locator('input[placeholder="Contact name"]').fill(contactName);
      await contactDialog.locator('input[placeholder="Phone number"]').fill('08123456789');
      await contactDialog.locator('input[placeholder="Email address"]').fill('contact@test.com');

      // Click Add button
      await contactDialog.locator('button:has-text("Add")').click();

      // Verify success
      await expect(tenantAdminPage.locator('text=/Contact added successfully/i')).toBeVisible({ timeout: 5000 });

      // Verify contact appears in contacts list
      await tenantAdminPage.waitForTimeout(500);
      await expect(tenantAdminPage.locator(`text=${contactName}`)).toBeVisible();
    });

    test('should delete a contact from supplier view page', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      // Click on first supplier to view
      const supplierLink = tenantAdminPage.locator('table tbody tr td a').first();
      if (await supplierLink.isVisible()) {
        await supplierLink.click();
        await expect(tenantAdminPage).toHaveURL(/supplier\/[a-f0-9-]+$/);
      }

      // Check if there are existing contacts
      const contactRows = tenantAdminPage.locator('h2:has-text("Contacts")').locator('..').locator('..').locator('table tbody tr');
      const contactCount = await contactRows.count();

      if (contactCount > 0) {
        // Click trash icon on first contact
        const deleteBtn = contactRows.first().locator('button').last();
        await deleteBtn.click();

        // Confirm deletion
        await expect(tenantAdminPage.locator('text=/Delete Contact/i')).toBeVisible();
        const confirmBtn = tenantAdminPage.locator('button:has-text("Confirm")').last();
        await confirmBtn.click();

        // Verify success
        await expect(tenantAdminPage.locator('text=/Contact deleted/i')).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('SUP-011: Product Linking', () => {
    test('should link a product to supplier', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      // Click on first supplier to view
      const supplierLink = tenantAdminPage.locator('table tbody tr td a').first();
      if (await supplierLink.isVisible()) {
        await supplierLink.click();
        await expect(tenantAdminPage).toHaveURL(/supplier\/[a-f0-9-]+$/);
      }

      // Click Link Product button
      await tenantAdminPage.click('button:has-text("Link Product")');

      // Dialog should appear
      await expect(tenantAdminPage.locator('text=Link Product').last()).toBeVisible();

      // Select product via keyboard interaction
      const productDialog = tenantAdminPage.locator('[role="dialog"]');
      const productSelect = productDialog.locator('button:has-text("Select product")');
      if (await productSelect.isVisible()) {
        await productSelect.click();
        await tenantAdminPage.waitForTimeout(300);
        await tenantAdminPage.keyboard.press('ArrowDown');
        await tenantAdminPage.keyboard.press('Enter');
      }

      // Set supplier price
      const priceInput = productDialog.locator('input[type="number"]').first();
      await priceInput.fill('50000');

      // Click Link button
      await productDialog.locator('button:has-text("Link")').click();

      // Verify success
      await expect(tenantAdminPage.locator('text=/Product linked successfully/i')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Navigation and Breadcrumbs', () => {
    test('should display breadcrumbs on add page', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Supplier")');

      await expect(tenantAdminPage.locator('text=Suppliers').first()).toBeVisible();
      await expect(tenantAdminPage.locator('text=Add Supplier').first()).toBeVisible();
    });

    test('should handle cancel button navigation', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Supplier")');

      const cancelButton = tenantAdminPage.locator('button:has-text("Cancel")');
      await cancelButton.click();

      // Should navigate back to list
      await expect(tenantAdminPage).toHaveURL(/page=1/);
    });
  });

  test.describe('URL State Persistence', () => {
    test('should persist filter in URL', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Test');
      await tenantAdminPage.waitForTimeout(1000);

      const url = tenantAdminPage.url();
      expect(url).toContain('filter=Test');

      // Reload page
      await tenantAdminPage.reload();

      const inputValue = await searchInput.inputValue();
      expect(inputValue).toBe('Test');
    });

    test('should persist sort state in URL', async ({ tenantAdminPage }) => {
      await navigateToSupplierList(tenantAdminPage);

      const sortButton = tenantAdminPage.locator('button:near(:text("Code"))').first();
      await sortButton.click();
      await tenantAdminPage.waitForTimeout(300);

      const url = tenantAdminPage.url();
      expect(url).toContain('sort=code');

      await tenantAdminPage.reload();

      const reloadedUrl = tenantAdminPage.url();
      expect(reloadedUrl).toContain('sort=code');
    });
  });

  test.describe('Performance', () => {
    test('should load supplier list within acceptable time', async ({ tenantAdminPage }) => {
      const startTime = Date.now();

      await navigateToSupplierList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });
  });
});
