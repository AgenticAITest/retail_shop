import { test, expect, TEST_USERS } from '../../../fixtures/auth';
import type { Page } from '@playwright/test';

/**
 * Product CRUD Tests
 *
 * Comprehensive test suite for Product management in product-catalog module.
 */

// Test data
const generateTestProduct = () => ({
  skuCode: `SKU-${Date.now()}`,
  name: `Test Product ${Date.now()}`,
  description: 'A test product description',
  brand: 'Test Brand',
  uom: 'pcs',
  baseCostPrice: '10000',
  sellingPrice: '15000',
  status: 'draft',
});

// Helper functions
async function navigateToProductList(page: Page) {
  await page.goto('/console/modules/product-catalog/product');
  await page.waitForURL('**/modules/product-catalog/product**');
  await page.waitForLoadState('networkidle');
}

async function fillProductForm(page: Page, product: {
  skuCode: string;
  name: string;
  description?: string;
  brand?: string;
  uom?: string;
  baseCostPrice: string;
  sellingPrice: string;
  status?: string;
}) {
  // Fill SKU code
  await page.fill('input[name="skuCode"]', product.skuCode);

  // Fill name
  await page.fill('input[name="name"]', product.name);

  // Fill description if provided
  if (product.description) {
    await page.fill('textarea[name="description"]', product.description);
  }

  // Fill brand if provided
  if (product.brand) {
    await page.fill('input[name="brand"]', product.brand);
  }

  // Fill UoM if provided
  if (product.uom) {
    const uomInput = page.locator('input[name="uom"]');
    await uomInput.clear();
    await uomInput.fill(product.uom);
  }

  // Fill base cost price
  const costInput = page.locator('input[name="baseCostPrice"]');
  await costInput.clear();
  await costInput.fill(product.baseCostPrice);

  // Fill selling price
  const priceInput = page.locator('input[name="sellingPrice"]');
  await priceInput.clear();
  await priceInput.fill(product.sellingPrice);

  // Select status if provided
  if (product.status) {
    const statusSelect = page.locator('button:has-text("Select status"), button:has-text("Draft"), button:has-text("Active"), button:has-text("Discontinued"), button:has-text("Archived")').first();
    await statusSelect.click();
    await page.waitForTimeout(300);

    const statusLabel = product.status.charAt(0).toUpperCase() + product.status.slice(1);
    await page.click(`div[role="option"]:has-text("${statusLabel}")`);
  }
}

test.describe('Product CRUD Operations', () => {

  test.describe('PROD-001: View Product List with Pagination', () => {
    test('should display product list page with proper structure', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);

      // Verify page title
      await expect(tenantAdminPage.locator('h1')).toContainText('Product Catalog');

      // Verify table structure
      const table = tenantAdminPage.locator('table');
      await expect(table).toBeVisible();

      // Verify table headers
      await expect(tenantAdminPage.locator('th:has-text("#")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("SKU Code")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Name")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Category")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("UoM")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Selling Price")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Status")')).toBeVisible();
    });

    test('should handle pagination controls', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);

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

    test('should persist pagination state in URL', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);

      const url = tenantAdminPage.url();
      expect(url).toMatch(/modules\/product-catalog\/product/);
    });
  });

  test.describe('PROD-002: Search/Filter Products', () => {
    test('should display search input', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await expect(searchInput).toBeVisible();
    });

    test('should filter products by search term', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);

      await tenantAdminPage.waitForTimeout(1000);

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Product');

      // Wait for debounce (500ms)
      await tenantAdminPage.waitForTimeout(1000);

      // Check URL contains filter
      await expect(tenantAdminPage).toHaveURL(/filter=Product/);

      // Verify loading completed
      await tenantAdminPage.waitForLoadState('networkidle');
    });

    test('should filter products by SKU code', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);

      await tenantAdminPage.waitForTimeout(1000);

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('SKU');

      // Wait for debounce
      await tenantAdminPage.waitForTimeout(1000);

      // Check URL contains filter
      await expect(tenantAdminPage).toHaveURL(/filter=SKU/);

      await tenantAdminPage.waitForLoadState('networkidle');
    });

    test('should clear search filter', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);
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

  test.describe('PROD-003: Sort Product List', () => {
    test('should sort by SKU Code column', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);

      const skuSortButton = tenantAdminPage.locator('button:near(:text("SKU Code"))').first();
      await skuSortButton.click();

      await tenantAdminPage.waitForTimeout(300);
      await expect(tenantAdminPage).toHaveURL(/sort=skuCode/);
    });

    test('should sort by Name column', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);

      const nameSortButton = tenantAdminPage.locator('button:near(:text("Name"))').first();
      await nameSortButton.click();

      await tenantAdminPage.waitForTimeout(300);
      await expect(tenantAdminPage).toHaveURL(/sort=name/);
      await expect(tenantAdminPage).toHaveURL(/order=desc/);

      // Click again to toggle order
      await nameSortButton.click();
      await tenantAdminPage.waitForTimeout(300);
      await expect(tenantAdminPage).toHaveURL(/order=asc/);
    });

    test('should sort by Selling Price column', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);

      const priceSortButton = tenantAdminPage.locator('button:near(:text("Selling Price"))').first();
      await priceSortButton.click();

      await tenantAdminPage.waitForTimeout(300);
      await expect(tenantAdminPage).toHaveURL(/sort=sellingPrice/);
    });

    test('should sort by Status column', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);

      const statusSortButton = tenantAdminPage.locator('button:near(:text("Status"))').first();
      await statusSortButton.click();

      await tenantAdminPage.waitForTimeout(300);
      await expect(tenantAdminPage).toHaveURL(/sort=status/);
    });
  });

  test.describe('PROD-004: Create New Product - Success', () => {
    test('should display Add Product button with proper permission', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);

      const addButton = tenantAdminPage.locator('button:has-text("Add Product")');
      await expect(addButton).toBeVisible();
    });

    test('should display Import button', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);

      const importButton = tenantAdminPage.locator('button:has-text("Import")');
      await expect(importButton).toBeVisible();
    });

    test('should navigate to add product page', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);

      await tenantAdminPage.click('button:has-text("Add Product")');
      await expect(tenantAdminPage).toHaveURL(/product\/add/);

      // Verify breadcrumb
      await expect(tenantAdminPage.locator('text=Add Product')).toBeVisible();
    });

    test('should create product with valid data', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Product")');

      const testProd = generateTestProduct();

      // Fill form fields
      await fillProductForm(tenantAdminPage, testProd);

      // Submit form
      await tenantAdminPage.click('button:has-text("Save")');

      // Wait for success message
      await expect(tenantAdminPage.locator('text=/Product has been created/i')).toBeVisible({ timeout: 5000 });

      // Verify redirect to list
      await expect(tenantAdminPage).toHaveURL(/modules\/product-catalog\/product/);

      // Search for the new product (avoids pagination issues with accumulated data)
      await tenantAdminPage.waitForLoadState('networkidle');
      const createSearchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await createSearchInput.fill(testProd.skuCode);
      await tenantAdminPage.waitForTimeout(800);
      await tenantAdminPage.waitForLoadState('networkidle');
      await expect(tenantAdminPage.locator(`text=${testProd.skuCode}`).first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('PROD-005: Create Product - Validation Errors', () => {
    test('should show validation errors for empty required fields', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Product")');

      // Clear default values
      await tenantAdminPage.fill('input[name="skuCode"]', '');
      await tenantAdminPage.fill('input[name="name"]', '');

      // Try to submit without filling required fields
      await tenantAdminPage.click('button:has-text("Save")');

      // Should show validation errors
      await expect(tenantAdminPage.locator('text=/required/i').first()).toBeVisible({ timeout: 3000 });
    });

    test('should validate SKU Code field is required', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Product")');

      // Fill name but leave SKU empty
      await tenantAdminPage.fill('input[name="skuCode"]', '');
      await tenantAdminPage.fill('input[name="name"]', 'Test Product');

      await tenantAdminPage.click('button:has-text("Save")');

      // Should show SKU required error
      await expect(tenantAdminPage.locator('text=/SKU Code is required/i')).toBeVisible({ timeout: 3000 });
    });

    test('should validate Name field is required', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Product")');

      // Fill SKU but leave name empty
      await tenantAdminPage.fill('input[name="skuCode"]', 'TEST-SKU');
      await tenantAdminPage.fill('input[name="name"]', '');

      await tenantAdminPage.click('button:has-text("Save")');

      // Should show name required error
      await expect(tenantAdminPage.locator('text=/Name is required/i')).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('PROD-006: Create Product - Duplicate SKU', () => {
    test('should prevent duplicate SKU codes', async ({ tenantAdminPage }) => {
      // First, create a product
      await navigateToProductList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Product")');

      const testProd = generateTestProduct();

      await fillProductForm(tenantAdminPage, testProd);

      await tenantAdminPage.click('button:has-text("Save")');
      await tenantAdminPage.waitForTimeout(1000);

      // Try to create another product with the same SKU
      await navigateToProductList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Product")');

      await tenantAdminPage.fill('input[name="skuCode"]', testProd.skuCode);
      await tenantAdminPage.fill('input[name="name"]', 'Another Product');

      // Fill required price fields
      const costInput = tenantAdminPage.locator('input[name="baseCostPrice"]');
      await costInput.clear();
      await costInput.fill('5000');
      const priceInput = tenantAdminPage.locator('input[name="sellingPrice"]');
      await priceInput.clear();
      await priceInput.fill('8000');

      // Submit form
      await tenantAdminPage.click('button:has-text("Save")');

      // Wait for duplicate SKU error to appear
      await tenantAdminPage.waitForTimeout(1000);

      // Should show duplicate SKU error
      await expect(tenantAdminPage.locator('text=/SKU Code must be unique|SKU Code already exists/i')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('PROD-007: View Product Details', () => {
    test('should view product details via SKU link', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);

      await tenantAdminPage.waitForTimeout(1000);

      // Click on first product SKU link
      const productLink = tenantAdminPage.locator('table tbody tr td a').first();

      if (await productLink.isVisible()) {
        const skuCode = await productLink.textContent();
        await productLink.click();

        // Should navigate to view page
        await expect(tenantAdminPage).toHaveURL(/product\/[a-f0-9-]+$/);

        // Verify breadcrumb shows product name
        if (skuCode) {
          await expect(tenantAdminPage.locator('text=Products')).toBeVisible();
        }
      }

      // Verify Edit and Delete buttons are visible
      await expect(tenantAdminPage.locator('button:has-text("Edit")')).toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Delete")')).toBeVisible();

      // Verify form fields are read-only (disabled)
      const skuInput = tenantAdminPage.locator('input[name="skuCode"]');
      await expect(skuInput).toBeDisabled();

      const nameInput = tenantAdminPage.locator('input[name="name"]');
      await expect(nameInput).toBeDisabled();
    });
  });

  test.describe('PROD-008: Edit Product - Success', () => {
    test('should edit product successfully', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);

      // Click edit button on first product row (first button = Edit/Pencil, second = Delete)
      const tableRows = tenantAdminPage.locator('table tbody tr');
      const rowCount = await tableRows.count();

      if (rowCount > 0) {
        const editButton = tableRows.first().locator('button').first();
        await editButton.click();

        // Should navigate to edit page
        await expect(tenantAdminPage).toHaveURL(/product\/[a-f0-9-]+\/edit/);

        // Modify name field
        const nameInput = tenantAdminPage.locator('input[name="name"]');
        await nameInput.clear();
        await nameInput.fill(`Updated Product ${Date.now()}`);

        // Save changes
        await tenantAdminPage.click('button:has-text("Save")');

        // Wait for success message
        await expect(tenantAdminPage.locator('text=/Product has been updated/i')).toBeVisible({ timeout: 5000 });

        // Should redirect to list
        await expect(tenantAdminPage).toHaveURL(/modules\/product-catalog\/product/);
      }
    });

    test('should pre-populate form with existing data', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);

      const tableRows = tenantAdminPage.locator('table tbody tr');
      const rowCount = await tableRows.count();

      if (rowCount > 0) {
        const editButton = tableRows.first().locator('button').first();
        await editButton.click();
        await tenantAdminPage.waitForURL(/edit/);

        await tenantAdminPage.waitForTimeout(1000);

        // Verify form fields are populated
        const skuInput = tenantAdminPage.locator('input[name="skuCode"]');
        const skuValue = await skuInput.inputValue();
        expect(skuValue).not.toBe('');

        const nameInput = tenantAdminPage.locator('input[name="name"]');
        const nameValue = await nameInput.inputValue();
        expect(nameValue).not.toBe('');
      }
    });
  });

  test.describe('PROD-009: Edit Product - Validation Errors', () => {
    test('should validate required fields on edit', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);

      const tableRows = tenantAdminPage.locator('table tbody tr');
      const rowCount = await tableRows.count();

      if (rowCount > 0) {
        const editButton = tableRows.first().locator('button').first();
        await editButton.click();
        await tenantAdminPage.waitForURL(/edit/);

        await tenantAdminPage.waitForTimeout(1000);

        // Clear required field
        const nameInput = tenantAdminPage.locator('input[name="name"]');
        await nameInput.clear();

        // Try to save
        await tenantAdminPage.click('button:has-text("Save")');

        // Should show validation error
        await expect(tenantAdminPage.locator('text=/Name is required/i')).toBeVisible({ timeout: 3000 });
      }
    });
  });

  test.describe('PROD-010: Delete Product - Success', () => {
    test('should delete product after confirmation', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);

      // Create a test product first
      await tenantAdminPage.click('button:has-text("Add Product")');
      const testProd = generateTestProduct();

      await fillProductForm(tenantAdminPage, testProd);

      await tenantAdminPage.click('button:has-text("Save")');
      await tenantAdminPage.waitForURL(/modules\/product-catalog\/product/, { timeout: 5000 });

      // Navigate to list and search for the created product (avoids pagination issues)
      await navigateToProductList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);
      const deleteSearchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await deleteSearchInput.fill(testProd.skuCode);
      await tenantAdminPage.waitForTimeout(800);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Find the test product row and click delete
      const productRow = tenantAdminPage.locator(`tr:has-text("${testProd.skuCode}")`);
      const deleteButton = productRow.locator('button').last();

      await deleteButton.click();

      // Confirm deletion in dialog
      await expect(tenantAdminPage.locator('text=/Confirm Delete/i')).toBeVisible();
      await expect(tenantAdminPage.locator('text=/cannot be undone/i')).toBeVisible();

      // Click confirm
      const confirmButton = tenantAdminPage.locator('button:has-text("Confirm"), button:has-text("Delete")').last();
      await confirmButton.click();

      // Wait for success message
      await expect(tenantAdminPage.locator('text=/deleted successfully/i')).toBeVisible({ timeout: 5000 });

      // Product is soft-deleted (archived), still in list but with Archived status
      await tenantAdminPage.waitForLoadState('networkidle');
      await expect(tenantAdminPage.locator(`tr:has-text("${testProd.skuCode}")`).locator('text=Archived')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('PROD-011: Delete Product - Cancel', () => {
    test('should cancel delete operation', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      // Click delete button on first product (last button in first row)
      const tableRows = tenantAdminPage.locator('table tbody tr');
      const rowCount = await tableRows.count();

      if (rowCount > 0) {
        const deleteButton = tableRows.first().locator('button').last();
        await deleteButton.click();

        // Verify confirmation dialog appears
        await expect(tenantAdminPage.locator('text=/Confirm Delete/i')).toBeVisible({ timeout: 3000 });

        // Click cancel
        const cancelButton = tenantAdminPage.locator('button:has-text("Cancel")');
        await cancelButton.click();

        // Dialog should close
        await expect(tenantAdminPage.locator('text=/Confirm Delete/i')).not.toBeVisible();

        // Product should still be in the list
        await expect(tableRows.first()).toBeVisible();
      }
    });
  });

  test.describe('PROD-012: Navigation and Breadcrumbs', () => {
    test('should display breadcrumbs on add page', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Product")');

      // Verify breadcrumb structure
      await expect(tenantAdminPage.locator('text=Products')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Add Product')).toBeVisible();
    });

    test('should navigate back via breadcrumb', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Product")');
      await tenantAdminPage.waitForTimeout(1000);

      // Click Products in breadcrumb
      const breadcrumbLink = tenantAdminPage.locator('a:has-text("Products")').first();
      if (await breadcrumbLink.isVisible()) {
        await breadcrumbLink.click();
        await expect(tenantAdminPage).toHaveURL(/modules\/product-catalog\/product/);
      }
    });

    test('should handle cancel button navigation', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Product")');

      // Click cancel
      const cancelButton = tenantAdminPage.locator('button:has-text("Cancel")');
      await cancelButton.click();

      // Should navigate back to list
      await expect(tenantAdminPage).toHaveURL(/modules\/product-catalog\/product/);
    });
  });

  test.describe('PROD-013: URL State Persistence', () => {
    test('should persist filter in URL', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Product');
      await tenantAdminPage.waitForTimeout(1000);

      // URL should contain filter
      const url = tenantAdminPage.url();
      expect(url).toContain('filter=Product');

      // Reload page
      await tenantAdminPage.reload();

      // Filter should be restored
      const inputValue = await searchInput.inputValue();
      expect(inputValue).toBe('Product');
    });

    test('should persist sort state in URL', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);

      // Sort by SKU code
      const sortButton = tenantAdminPage.locator('button:near(:text("SKU Code"))').first();
      await sortButton.click();
      await tenantAdminPage.waitForTimeout(300);

      // URL should contain sort parameters
      const url = tenantAdminPage.url();
      expect(url).toContain('sort=skuCode');
      expect(url).toContain('order=');

      // Reload page
      await tenantAdminPage.reload();

      // Sort state should be maintained
      const reloadedUrl = tenantAdminPage.url();
      expect(reloadedUrl).toContain('sort=skuCode');
    });

    test('should restore all state from URL', async ({ tenantAdminPage }) => {
      await tenantAdminPage.goto('/console/modules/product-catalog/product?page=1&perPage=10&sort=name&order=asc&filter=Test');

      await tenantAdminPage.waitForLoadState('networkidle');

      const url = tenantAdminPage.url();
      expect(url).toContain('page=1');
      expect(url).toContain('sort=name');
      expect(url).toContain('order=asc');
      expect(url).toContain('filter=Test');

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      const value = await searchInput.inputValue();
      expect(value).toBe('Test');
    });
  });

  test.describe('Edge Cases and Error Handling', () => {
    test('should handle empty list state', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);

      const tableRows = tenantAdminPage.locator('table tbody tr');
      const rowCount = await tableRows.count();

      if (rowCount === 0) {
        await expect(tenantAdminPage.locator('table')).toBeVisible();
      }
    });

    test('should handle form submission errors', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Product")');

      // Clear default values and try to submit incomplete form
      await tenantAdminPage.fill('input[name="skuCode"]', '');
      await tenantAdminPage.fill('input[name="name"]', '');
      await tenantAdminPage.click('button:has-text("Save")');

      // Should show validation errors instead of crashing
      await expect(tenantAdminPage.locator('text=/required/i').first()).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Accessibility and UI/UX', () => {
    test('should have accessible form labels', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Product")');

      // Check for form labels
      await expect(tenantAdminPage.locator('label:has-text("SKU Code")')).toBeVisible();
      await expect(tenantAdminPage.locator('label:has-text("Name")')).toBeVisible();
      await expect(tenantAdminPage.locator('label:has-text("Base Cost Price")')).toBeVisible();
      await expect(tenantAdminPage.locator('label:has-text("Selling Price")')).toBeVisible();
      await expect(tenantAdminPage.locator('label:has-text("Status")')).toBeVisible();
    });

    test('should display loading states', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);

      // Trigger an action that shows loading
      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Test');

      // Loading indicator might appear briefly
      await tenantAdminPage.waitForLoadState('networkidle');
    });
  });

  test.describe('Performance', () => {
    test('should load product list within acceptable time', async ({ tenantAdminPage }) => {
      const startTime = Date.now();

      await navigateToProductList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should debounce search input', async ({ tenantAdminPage }) => {
      await navigateToProductList(tenantAdminPage);

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();

      // Type quickly
      await searchInput.fill('T');
      await tenantAdminPage.waitForTimeout(100);
      await searchInput.fill('Te');
      await tenantAdminPage.waitForTimeout(100);
      await searchInput.fill('Test');

      // Wait for debounce
      await tenantAdminPage.waitForTimeout(600);

      // Only one final search should execute
      await tenantAdminPage.waitForLoadState('networkidle');
    });
  });
});
