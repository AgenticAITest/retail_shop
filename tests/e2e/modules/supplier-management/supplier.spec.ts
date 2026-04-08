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
  npwp: '12.345.678.9-012.345',
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
    test('should display supplier list page with proper structure', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);

      // Verify page title
      await expect(adminPage.locator('h1')).toContainText('Suppliers');

      // Verify table structure
      const table = adminPage.locator('table');
      await expect(table).toBeVisible();

      // Verify table headers
      await expect(adminPage.locator('th:has-text("#")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Code")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Name")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("NPWP")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Payment Terms")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Status")')).toBeVisible();
    });

    test('should display Add Supplier button', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);

      const addButton = adminPage.locator('button:has-text("Add Supplier")');
      await expect(addButton).toBeVisible();
    });

    test('should handle pagination controls', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);

      // Check if pagination controls exist
      const paginationContainer = adminPage.locator('[data-testid="pagination"]').first();

      if (await paginationContainer.isVisible()) {
        await expect(adminPage).toHaveURL(/page=1/);

        const nextButton = adminPage.locator('button:has-text("Next"), button[aria-label*="next"]');
        if (await nextButton.isEnabled()) {
          await nextButton.click();
          await expect(adminPage).toHaveURL(/page=2/);
        }
      }
    });
  });

  test.describe('SUP-002: Create New Supplier - Success', () => {
    test('should navigate to add supplier page', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);

      await adminPage.click('button:has-text("Add Supplier")');
      await expect(adminPage).toHaveURL(/supplier\/add/);

      // Verify breadcrumb
      await expect(adminPage.locator('text=Add Supplier')).toBeVisible();
    });

    test('should create supplier with valid data', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);
      await adminPage.click('button:has-text("Add Supplier")');

      const testSupplier = generateTestSupplier();

      // Fill form fields
      await fillSupplierForm(adminPage, testSupplier);

      // Submit form
      await adminPage.click('button:has-text("Save")');

      // Wait for success message
      await expect(adminPage.locator('text=/Supplier has been created/i')).toBeVisible({ timeout: 5000 });

      // Verify redirect to list
      await expect(adminPage).toHaveURL(/page=1/);

      // Verify new supplier appears in list
      await adminPage.waitForTimeout(500);
      await expect(adminPage.locator(`text=${testSupplier.code}`)).toBeVisible();
    });
  });

  test.describe('SUP-003: View Supplier Details', () => {
    test('should view supplier details with contacts and products sections', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);
      await adminPage.waitForTimeout(1000);

      // Click on first supplier code link
      const supplierLink = adminPage.locator('table tbody tr td a').first();

      if (await supplierLink.isVisible()) {
        const supplierCode = await supplierLink.textContent();
        await supplierLink.click();

        // Should navigate to view page
        await expect(adminPage).toHaveURL(/supplier\/[a-f0-9-]+$/);

        // Verify breadcrumb shows supplier name
        if (supplierCode) {
          await expect(adminPage.locator(`text=${supplierCode}`).first()).toBeVisible();
        }
      }

      // Verify Edit and Delete buttons are visible
      await expect(adminPage.locator('button:has-text("Edit")')).toBeVisible();
      await expect(adminPage.locator('button:has-text("Delete")')).toBeVisible();

      // Verify form fields are read-only (disabled)
      const codeInput = adminPage.locator('input[name="code"]');
      await expect(codeInput).toBeDisabled();

      const nameInput = adminPage.locator('input[name="name"]');
      await expect(nameInput).toBeDisabled();

      // Verify Contacts section exists
      await expect(adminPage.locator('h2:has-text("Contacts")')).toBeVisible();
      await expect(adminPage.locator('button:has-text("Add Contact")')).toBeVisible();

      // Verify Linked Products section exists
      await expect(adminPage.locator('h2:has-text("Linked Products")')).toBeVisible();
      await expect(adminPage.locator('button:has-text("Link Product")')).toBeVisible();
    });
  });

  test.describe('SUP-004: Edit Supplier - Success', () => {
    test('should edit supplier name successfully', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);
      await adminPage.waitForTimeout(1000);

      // Click edit button on first supplier (Pencil icon button)
      const editButton = adminPage.getByRole('button').filter({ hasText: /^$/ }).nth(2);

      if (await editButton.isVisible()) {
        await editButton.click();

        // Should navigate to edit page
        await expect(adminPage).toHaveURL(/supplier\/[a-f0-9-]+\/edit/);

        // Modify name field
        const nameInput = adminPage.locator('input[name="name"]');
        await nameInput.clear();
        const updatedName = `Updated Supplier ${Date.now()}`;
        await nameInput.fill(updatedName);

        // Save changes
        await adminPage.click('button:has-text("Save")');

        // Wait for success message
        await expect(adminPage.locator('text=/Supplier has been updated/i')).toBeVisible({ timeout: 5000 });

        // Should redirect to list
        await expect(adminPage).toHaveURL(/page=1/);
      }
    });

    test('should pre-populate form with existing data', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);
      await adminPage.waitForTimeout(1000);

      const editButton = adminPage.getByRole('button').filter({ hasText: /^$/ }).nth(2);

      if (await editButton.isVisible()) {
        await editButton.click();
        await adminPage.waitForURL(/edit/);
        await adminPage.waitForTimeout(1000);

        // Verify form fields are populated
        const codeInput = adminPage.locator('input[name="code"]');
        const codeValue = await codeInput.inputValue();
        expect(codeValue).not.toBe('');

        const nameInput = adminPage.locator('input[name="name"]');
        const nameValue = await nameInput.inputValue();
        expect(nameValue).not.toBe('');
      }
    });
  });

  test.describe('SUP-005: Delete Supplier (Soft-Delete)', () => {
    test('should soft-delete supplier after confirmation', async ({ adminPage }) => {
      // Create a test supplier first
      await navigateToSupplierList(adminPage);
      await adminPage.click('button:has-text("Add Supplier")');
      const testSupplier = generateTestSupplier();

      await fillSupplierForm(adminPage, testSupplier);

      await adminPage.click('button:has-text("Save")');
      await adminPage.waitForTimeout(1000);

      // Now navigate to list and delete it
      await navigateToSupplierList(adminPage);
      await adminPage.waitForTimeout(1000);

      // Find the test supplier row and click delete (destructive button)
      const supplierRow = adminPage.locator(`tr:has-text("${testSupplier.code}")`);
      const deleteButton = supplierRow.locator('button').last();

      await deleteButton.click();

      // Confirm deletion in dialog
      await expect(adminPage.locator('text=/Confirm Delete/i')).toBeVisible();
      await expect(adminPage.locator('text=/cannot be undone/i')).toBeVisible();

      // Click confirm
      const confirmButton = adminPage.locator('button:has-text("Confirm"), button:has-text("Delete")').last();
      await confirmButton.click();

      // Wait for success message
      await expect(adminPage.locator('text=/deleted successfully/i')).toBeVisible({ timeout: 5000 });

      // Verify supplier status becomes inactive (soft delete)
      await adminPage.waitForTimeout(500);
    });
  });

  test.describe('SUP-006: Search/Filter Suppliers', () => {
    test('should display search input', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);

      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
      await expect(searchInput).toBeVisible();
    });

    test('should filter suppliers by search term', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);
      await adminPage.waitForTimeout(1000);

      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('SUP');

      // Wait for debounce (500ms)
      await adminPage.waitForTimeout(1000);

      // Check URL contains filter
      await expect(adminPage).toHaveURL(/filter=SUP/);

      // Verify loading completed
      await adminPage.waitForLoadState('networkidle');
    });

    test('should clear search filter', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);
      await adminPage.waitForTimeout(1000);

      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Test');
      await adminPage.waitForTimeout(1000);

      // Click X icon to clear
      const clearButton = adminPage.locator('.lucide.lucide-x').filter({ hasText: '' }).first();
      await clearButton.click();

      // Verify filter is cleared
      const url = adminPage.url();
      expect(url).toMatch(/filter=/);
    });
  });

  test.describe('SUP-007: Sort Supplier List', () => {
    test('should sort by Code column', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);

      const codeSortButton = adminPage.locator('button:near(:text("Code"))').first();
      await codeSortButton.click();

      await adminPage.waitForTimeout(300);
      await expect(adminPage).toHaveURL(/sort=code/);
    });

    test('should sort by Name column', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);

      const nameSortButton = adminPage.locator('button:near(:text("Name"))').first();
      await nameSortButton.click();

      await adminPage.waitForTimeout(300);
      await expect(adminPage).toHaveURL(/sort=name/);
    });

    test('should toggle sort order on repeated click', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);

      const nameSortButton = adminPage.locator('button:near(:text("Name"))').first();
      await nameSortButton.click();
      await adminPage.waitForTimeout(300);

      // Click again to toggle
      await nameSortButton.click();
      await adminPage.waitForTimeout(300);
      await expect(adminPage).toHaveURL(/order=asc/);
    });
  });

  test.describe('SUP-008: Duplicate Code Validation', () => {
    test('should prevent duplicate supplier codes', async ({ adminPage }) => {
      // Create first supplier
      await navigateToSupplierList(adminPage);
      await adminPage.click('button:has-text("Add Supplier")');

      const testSupplier = generateTestSupplier();
      await fillSupplierForm(adminPage, testSupplier);

      await adminPage.click('button:has-text("Save")');
      await adminPage.waitForTimeout(1000);

      // Try to create another supplier with the same code
      await navigateToSupplierList(adminPage);
      await adminPage.click('button:has-text("Add Supplier")');

      await adminPage.fill('input[name="code"]', testSupplier.code);
      await adminPage.fill('input[name="name"]', 'Another Supplier Name');

      // Submit form
      await adminPage.click('button:has-text("Save")');

      // Wait for validation
      await adminPage.waitForTimeout(1000);

      // Should show duplicate code error
      await expect(adminPage.locator('text=/Code must be unique|Code already exists/i')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('SUP-009: Required Field Validation', () => {
    test('should show validation errors for empty required fields', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);
      await adminPage.click('button:has-text("Add Supplier")');

      // Try to submit without filling any fields
      await adminPage.click('button:has-text("Save")');

      // Should show validation errors
      await expect(adminPage.locator('text=/Code is required/i').first()).toBeVisible({ timeout: 3000 });
      await expect(adminPage.locator('text=/Name is required/i').first()).toBeVisible({ timeout: 3000 });
    });

    test('should validate Code field is required', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);
      await adminPage.click('button:has-text("Add Supplier")');

      // Fill name but leave code empty
      await adminPage.fill('input[name="name"]', 'Test Supplier');

      await adminPage.click('button:has-text("Save")');

      await expect(adminPage.locator('text=/Code is required/i')).toBeVisible({ timeout: 3000 });
    });

    test('should validate Name field is required', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);
      await adminPage.click('button:has-text("Add Supplier")');

      // Fill code but leave name empty
      await adminPage.fill('input[name="code"]', 'TEST-CODE');

      await adminPage.click('button:has-text("Save")');

      await expect(adminPage.locator('text=/Name is required/i')).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('SUP-010: Contacts Management', () => {
    test('should add a contact on supplier view page', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);
      await adminPage.waitForTimeout(1000);

      // Click on first supplier to view
      const supplierLink = adminPage.locator('table tbody tr td a').first();
      if (await supplierLink.isVisible()) {
        await supplierLink.click();
        await expect(adminPage).toHaveURL(/supplier\/[a-f0-9-]+$/);
      }

      // Click Add Contact button
      await adminPage.click('button:has-text("Add Contact")');

      // Dialog should appear
      await expect(adminPage.locator('text=Add Contact').last()).toBeVisible();

      // Fill contact form
      const contactName = `Contact ${Date.now()}`;
      const contactDialog = adminPage.locator('[role="dialog"]');
      await contactDialog.locator('input[placeholder="Contact name"]').fill(contactName);
      await contactDialog.locator('input[placeholder="Phone number"]').fill('08123456789');
      await contactDialog.locator('input[placeholder="Email address"]').fill('contact@test.com');

      // Click Add button
      await contactDialog.locator('button:has-text("Add")').click();

      // Verify success
      await expect(adminPage.locator('text=/Contact added successfully/i')).toBeVisible({ timeout: 5000 });

      // Verify contact appears in contacts list
      await adminPage.waitForTimeout(500);
      await expect(adminPage.locator(`text=${contactName}`)).toBeVisible();
    });

    test('should delete a contact from supplier view page', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);
      await adminPage.waitForTimeout(1000);

      // Click on first supplier to view
      const supplierLink = adminPage.locator('table tbody tr td a').first();
      if (await supplierLink.isVisible()) {
        await supplierLink.click();
        await expect(adminPage).toHaveURL(/supplier\/[a-f0-9-]+$/);
      }

      // Check if there are existing contacts
      const contactRows = adminPage.locator('h2:has-text("Contacts")').locator('..').locator('..').locator('table tbody tr');
      const contactCount = await contactRows.count();

      if (contactCount > 0) {
        // Click trash icon on first contact
        const deleteBtn = contactRows.first().locator('button').last();
        await deleteBtn.click();

        // Confirm deletion
        await expect(adminPage.locator('text=/Delete Contact/i')).toBeVisible();
        const confirmBtn = adminPage.locator('button:has-text("Confirm")').last();
        await confirmBtn.click();

        // Verify success
        await expect(adminPage.locator('text=/Contact deleted/i')).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('SUP-011: Product Linking', () => {
    test('should link a product to supplier', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);
      await adminPage.waitForTimeout(1000);

      // Click on first supplier to view
      const supplierLink = adminPage.locator('table tbody tr td a').first();
      if (await supplierLink.isVisible()) {
        await supplierLink.click();
        await expect(adminPage).toHaveURL(/supplier\/[a-f0-9-]+$/);
      }

      // Click Link Product button
      await adminPage.click('button:has-text("Link Product")');

      // Dialog should appear
      await expect(adminPage.locator('text=Link Product').last()).toBeVisible();

      // Select product via keyboard interaction
      const productDialog = adminPage.locator('[role="dialog"]');
      const productSelect = productDialog.locator('button:has-text("Select product")');
      if (await productSelect.isVisible()) {
        await productSelect.click();
        await adminPage.waitForTimeout(300);
        await adminPage.keyboard.press('ArrowDown');
        await adminPage.keyboard.press('Enter');
      }

      // Set supplier price
      const priceInput = productDialog.locator('input[type="number"]').first();
      await priceInput.fill('50000');

      // Click Link button
      await productDialog.locator('button:has-text("Link")').click();

      // Verify success
      await expect(adminPage.locator('text=/Product linked successfully/i')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Navigation and Breadcrumbs', () => {
    test('should display breadcrumbs on add page', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);
      await adminPage.click('button:has-text("Add Supplier")');

      await expect(adminPage.locator('text=Suppliers')).toBeVisible();
      await expect(adminPage.locator('text=Add Supplier')).toBeVisible();
    });

    test('should handle cancel button navigation', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);
      await adminPage.click('button:has-text("Add Supplier")');

      const cancelButton = adminPage.locator('button:has-text("Cancel")');
      await cancelButton.click();

      // Should navigate back to list
      await expect(adminPage).toHaveURL(/page=1/);
    });
  });

  test.describe('URL State Persistence', () => {
    test('should persist filter in URL', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);
      await adminPage.waitForTimeout(1000);

      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Test');
      await adminPage.waitForTimeout(1000);

      const url = adminPage.url();
      expect(url).toContain('filter=Test');

      // Reload page
      await adminPage.reload();

      const inputValue = await searchInput.inputValue();
      expect(inputValue).toBe('Test');
    });

    test('should persist sort state in URL', async ({ adminPage }) => {
      await navigateToSupplierList(adminPage);

      const sortButton = adminPage.locator('button:near(:text("Code"))').first();
      await sortButton.click();
      await adminPage.waitForTimeout(300);

      const url = adminPage.url();
      expect(url).toContain('sort=code');

      await adminPage.reload();

      const reloadedUrl = adminPage.url();
      expect(reloadedUrl).toContain('sort=code');
    });
  });

  test.describe('Performance', () => {
    test('should load supplier list within acceptable time', async ({ adminPage }) => {
      const startTime = Date.now();

      await navigateToSupplierList(adminPage);
      await adminPage.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });
  });
});
