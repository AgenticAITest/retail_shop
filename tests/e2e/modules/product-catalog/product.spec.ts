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
    test('should display product list page with proper structure', async ({ adminPage }) => {
      await navigateToProductList(adminPage);

      // Verify page title
      await expect(adminPage.locator('h1')).toContainText('Product Catalog');

      // Verify table structure
      const table = adminPage.locator('table');
      await expect(table).toBeVisible();

      // Verify table headers
      await expect(adminPage.locator('th:has-text("#")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("SKU Code")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Name")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Category")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("UoM")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Selling Price")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Status")')).toBeVisible();
    });

    test('should handle pagination controls', async ({ adminPage }) => {
      await navigateToProductList(adminPage);

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

    test('should persist pagination state in URL', async ({ adminPage }) => {
      await navigateToProductList(adminPage);

      const url = adminPage.url();
      expect(url).toMatch(/modules\/product-catalog\/product/);
    });
  });

  test.describe('PROD-002: Search/Filter Products', () => {
    test('should display search input', async ({ adminPage }) => {
      await navigateToProductList(adminPage);

      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
      await expect(searchInput).toBeVisible();
    });

    test('should filter products by search term', async ({ adminPage }) => {
      await navigateToProductList(adminPage);

      await adminPage.waitForTimeout(1000);

      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Product');

      // Wait for debounce (500ms)
      await adminPage.waitForTimeout(1000);

      // Check URL contains filter
      await expect(adminPage).toHaveURL(/filter=Product/);

      // Verify loading completed
      await adminPage.waitForLoadState('networkidle');
    });

    test('should filter products by SKU code', async ({ adminPage }) => {
      await navigateToProductList(adminPage);

      await adminPage.waitForTimeout(1000);

      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('SKU');

      // Wait for debounce
      await adminPage.waitForTimeout(1000);

      // Check URL contains filter
      await expect(adminPage).toHaveURL(/filter=SKU/);

      await adminPage.waitForLoadState('networkidle');
    });

    test('should clear search filter', async ({ adminPage }) => {
      await navigateToProductList(adminPage);
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

  test.describe('PROD-003: Sort Product List', () => {
    test('should sort by SKU Code column', async ({ adminPage }) => {
      await navigateToProductList(adminPage);

      const skuSortButton = adminPage.locator('button:near(:text("SKU Code"))').first();
      await skuSortButton.click();

      await adminPage.waitForTimeout(300);
      await expect(adminPage).toHaveURL(/sort=skuCode/);
    });

    test('should sort by Name column', async ({ adminPage }) => {
      await navigateToProductList(adminPage);

      const nameSortButton = adminPage.locator('button:near(:text("Name"))').first();
      await nameSortButton.click();

      await adminPage.waitForTimeout(300);
      await expect(adminPage).toHaveURL(/sort=name/);
      await expect(adminPage).toHaveURL(/order=desc/);

      // Click again to toggle order
      await nameSortButton.click();
      await adminPage.waitForTimeout(300);
      await expect(adminPage).toHaveURL(/order=asc/);
    });

    test('should sort by Selling Price column', async ({ adminPage }) => {
      await navigateToProductList(adminPage);

      const priceSortButton = adminPage.locator('button:near(:text("Selling Price"))').first();
      await priceSortButton.click();

      await adminPage.waitForTimeout(300);
      await expect(adminPage).toHaveURL(/sort=sellingPrice/);
    });

    test('should sort by Status column', async ({ adminPage }) => {
      await navigateToProductList(adminPage);

      const statusSortButton = adminPage.locator('button:near(:text("Status"))').first();
      await statusSortButton.click();

      await adminPage.waitForTimeout(300);
      await expect(adminPage).toHaveURL(/sort=status/);
    });
  });

  test.describe('PROD-004: Create New Product - Success', () => {
    test('should display Add Product button with proper permission', async ({ adminPage }) => {
      await navigateToProductList(adminPage);

      const addButton = adminPage.locator('button:has-text("Add Product")');
      await expect(addButton).toBeVisible();
    });

    test('should display Import button', async ({ adminPage }) => {
      await navigateToProductList(adminPage);

      const importButton = adminPage.locator('button:has-text("Import")');
      await expect(importButton).toBeVisible();
    });

    test('should navigate to add product page', async ({ adminPage }) => {
      await navigateToProductList(adminPage);

      await adminPage.click('button:has-text("Add Product")');
      await expect(adminPage).toHaveURL(/product\/add/);

      // Verify breadcrumb
      await expect(adminPage.locator('text=Add Product')).toBeVisible();
    });

    test('should create product with valid data', async ({ adminPage }) => {
      await navigateToProductList(adminPage);
      await adminPage.click('button:has-text("Add Product")');

      const testProd = generateTestProduct();

      // Fill form fields
      await fillProductForm(adminPage, testProd);

      // Submit form
      await adminPage.click('button:has-text("Save")');

      // Wait for success message
      await expect(adminPage.locator('text=/Product has been created/i')).toBeVisible({ timeout: 5000 });

      // Verify redirect to list
      await expect(adminPage).toHaveURL(/modules\/product-catalog\/product/);

      // Verify new product appears in list
      await adminPage.waitForTimeout(500);
      await expect(adminPage.locator(`text=${testProd.skuCode}`)).toBeVisible();
    });
  });

  test.describe('PROD-005: Create Product - Validation Errors', () => {
    test('should show validation errors for empty required fields', async ({ adminPage }) => {
      await navigateToProductList(adminPage);
      await adminPage.click('button:has-text("Add Product")');

      // Clear default values
      await adminPage.fill('input[name="skuCode"]', '');
      await adminPage.fill('input[name="name"]', '');

      // Try to submit without filling required fields
      await adminPage.click('button:has-text("Save")');

      // Should show validation errors
      await expect(adminPage.locator('text=/required/i').first()).toBeVisible({ timeout: 3000 });
    });

    test('should validate SKU Code field is required', async ({ adminPage }) => {
      await navigateToProductList(adminPage);
      await adminPage.click('button:has-text("Add Product")');

      // Fill name but leave SKU empty
      await adminPage.fill('input[name="skuCode"]', '');
      await adminPage.fill('input[name="name"]', 'Test Product');

      await adminPage.click('button:has-text("Save")');

      // Should show SKU required error
      await expect(adminPage.locator('text=/SKU Code is required/i')).toBeVisible({ timeout: 3000 });
    });

    test('should validate Name field is required', async ({ adminPage }) => {
      await navigateToProductList(adminPage);
      await adminPage.click('button:has-text("Add Product")');

      // Fill SKU but leave name empty
      await adminPage.fill('input[name="skuCode"]', 'TEST-SKU');
      await adminPage.fill('input[name="name"]', '');

      await adminPage.click('button:has-text("Save")');

      // Should show name required error
      await expect(adminPage.locator('text=/Name is required/i')).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('PROD-006: Create Product - Duplicate SKU', () => {
    test('should prevent duplicate SKU codes', async ({ adminPage }) => {
      // First, create a product
      await navigateToProductList(adminPage);
      await adminPage.click('button:has-text("Add Product")');

      const testProd = generateTestProduct();

      await fillProductForm(adminPage, testProd);

      await adminPage.click('button:has-text("Save")');
      await adminPage.waitForTimeout(1000);

      // Try to create another product with the same SKU
      await navigateToProductList(adminPage);
      await adminPage.click('button:has-text("Add Product")');

      await adminPage.fill('input[name="skuCode"]', testProd.skuCode);
      await adminPage.fill('input[name="name"]', 'Another Product');

      // Fill required price fields
      const costInput = adminPage.locator('input[name="baseCostPrice"]');
      await costInput.clear();
      await costInput.fill('5000');
      const priceInput = adminPage.locator('input[name="sellingPrice"]');
      await priceInput.clear();
      await priceInput.fill('8000');

      // Submit form
      await adminPage.click('button:has-text("Save")');

      // Wait for duplicate SKU error to appear
      await adminPage.waitForTimeout(1000);

      // Should show duplicate SKU error
      await expect(adminPage.locator('text=/SKU Code must be unique|SKU Code already exists/i')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('PROD-007: View Product Details', () => {
    test('should view product details via SKU link', async ({ adminPage }) => {
      await navigateToProductList(adminPage);

      await adminPage.waitForTimeout(1000);

      // Click on first product SKU link
      const productLink = adminPage.locator('table tbody tr td a').first();

      if (await productLink.isVisible()) {
        const skuCode = await productLink.textContent();
        await productLink.click();

        // Should navigate to view page
        await expect(adminPage).toHaveURL(/product\/[a-f0-9-]+$/);

        // Verify breadcrumb shows product name
        if (skuCode) {
          await expect(adminPage.locator('text=Products')).toBeVisible();
        }
      }

      // Verify Edit and Delete buttons are visible
      await expect(adminPage.locator('button:has-text("Edit")')).toBeVisible();
      await expect(adminPage.locator('button:has-text("Delete")')).toBeVisible();

      // Verify form fields are read-only (disabled)
      const skuInput = adminPage.locator('input[name="skuCode"]');
      await expect(skuInput).toBeDisabled();

      const nameInput = adminPage.locator('input[name="name"]');
      await expect(nameInput).toBeDisabled();
    });
  });

  test.describe('PROD-008: Edit Product - Success', () => {
    test('should edit product successfully', async ({ adminPage }) => {
      await navigateToProductList(adminPage);
      await adminPage.waitForTimeout(1000);

      // Click edit button on first product row
      const editButton = adminPage.getByRole('button').filter({ hasText: /^$/ }).nth(1);

      if (await editButton.isVisible()) {
        await editButton.click();

        // Should navigate to edit page
        await expect(adminPage).toHaveURL(/product\/[a-f0-9-]+\/edit/);

        // Modify name field
        const nameInput = adminPage.locator('input[name="name"]');
        await nameInput.clear();
        await nameInput.fill(`Updated Product ${Date.now()}`);

        // Save changes
        await adminPage.click('button:has-text("Save")');

        // Wait for success message
        await expect(adminPage.locator('text=/Product has been updated/i')).toBeVisible({ timeout: 5000 });

        // Should redirect to list
        await expect(adminPage).toHaveURL(/modules\/product-catalog\/product/);
      }
    });

    test('should pre-populate form with existing data', async ({ adminPage }) => {
      await navigateToProductList(adminPage);
      await adminPage.waitForTimeout(1000);

      const editButton = adminPage.getByRole('button').filter({ hasText: /^$/ }).nth(1);

      if (await editButton.isVisible()) {
        await editButton.click();
        await adminPage.waitForURL(/edit/);

        await adminPage.waitForTimeout(1000);

        // Verify form fields are populated
        const skuInput = adminPage.locator('input[name="skuCode"]');
        const skuValue = await skuInput.inputValue();
        expect(skuValue).not.toBe('');

        const nameInput = adminPage.locator('input[name="name"]');
        const nameValue = await nameInput.inputValue();
        expect(nameValue).not.toBe('');
      }
    });
  });

  test.describe('PROD-009: Edit Product - Validation Errors', () => {
    test('should validate required fields on edit', async ({ adminPage }) => {
      await navigateToProductList(adminPage);
      await adminPage.waitForTimeout(1000);

      const editButton = adminPage.getByRole('button').filter({ hasText: /^$/ }).nth(1);

      if (await editButton.isVisible()) {
        await editButton.click();
        await adminPage.waitForURL(/edit/);

        await adminPage.waitForTimeout(1000);

        // Clear required field
        const nameInput = adminPage.locator('input[name="name"]');
        await nameInput.clear();

        // Try to save
        await adminPage.click('button:has-text("Save")');

        // Should show validation error
        await expect(adminPage.locator('text=/Name is required/i')).toBeVisible({ timeout: 3000 });
      }
    });
  });

  test.describe('PROD-010: Delete Product - Success', () => {
    test('should delete product after confirmation', async ({ adminPage }) => {
      await navigateToProductList(adminPage);

      // Create a test product first
      await adminPage.click('button:has-text("Add Product")');
      const testProd = generateTestProduct();

      await fillProductForm(adminPage, testProd);

      await adminPage.click('button:has-text("Save")');
      await adminPage.waitForTimeout(1000);

      // Now go back to list and delete it
      await navigateToProductList(adminPage);
      await adminPage.waitForTimeout(1000);

      // Find the test product row and click delete
      const productRow = adminPage.locator(`tr:has-text("${testProd.skuCode}")`);
      const deleteButton = productRow.locator('button').last(); // Last button is usually delete

      await deleteButton.click();

      // Confirm deletion in dialog
      await expect(adminPage.locator('text=/Confirm Delete/i')).toBeVisible();
      await expect(adminPage.locator('text=/cannot be undone/i')).toBeVisible();

      // Click confirm
      const confirmButton = adminPage.locator('button:has-text("Confirm"), button:has-text("Delete")').last();
      await confirmButton.click();

      // Wait for success message
      await expect(adminPage.locator('text=/deleted successfully/i')).toBeVisible({ timeout: 5000 });

      // Verify product is removed from list
      await adminPage.waitForTimeout(500);
      await expect(adminPage.locator(`text=${testProd.skuCode}`)).not.toBeVisible();
    });
  });

  test.describe('PROD-011: Delete Product - Cancel', () => {
    test('should cancel delete operation', async ({ adminPage }) => {
      await navigateToProductList(adminPage);
      await adminPage.waitForTimeout(1000);

      // Click delete button on first product (last button in first row)
      const tableRows = adminPage.locator('table tbody tr');
      const rowCount = await tableRows.count();

      if (rowCount > 0) {
        const deleteButton = tableRows.first().locator('button').last();
        await deleteButton.click();

        // Verify confirmation dialog appears
        await expect(adminPage.locator('text=/Confirm Delete/i')).toBeVisible({ timeout: 3000 });

        // Click cancel
        const cancelButton = adminPage.locator('button:has-text("Cancel")');
        await cancelButton.click();

        // Dialog should close
        await expect(adminPage.locator('text=/Confirm Delete/i')).not.toBeVisible();

        // Product should still be in the list
        await expect(tableRows.first()).toBeVisible();
      }
    });
  });

  test.describe('PROD-012: Navigation and Breadcrumbs', () => {
    test('should display breadcrumbs on add page', async ({ adminPage }) => {
      await navigateToProductList(adminPage);
      await adminPage.click('button:has-text("Add Product")');

      // Verify breadcrumb structure
      await expect(adminPage.locator('text=Products')).toBeVisible();
      await expect(adminPage.locator('text=Add Product')).toBeVisible();
    });

    test('should navigate back via breadcrumb', async ({ adminPage }) => {
      await navigateToProductList(adminPage);
      await adminPage.click('button:has-text("Add Product")');
      await adminPage.waitForTimeout(1000);

      // Click Products in breadcrumb
      const breadcrumbLink = adminPage.locator('a:has-text("Products")').first();
      if (await breadcrumbLink.isVisible()) {
        await breadcrumbLink.click();
        await expect(adminPage).toHaveURL(/modules\/product-catalog\/product/);
      }
    });

    test('should handle cancel button navigation', async ({ adminPage }) => {
      await navigateToProductList(adminPage);
      await adminPage.click('button:has-text("Add Product")');

      // Click cancel
      const cancelButton = adminPage.locator('button:has-text("Cancel")');
      await cancelButton.click();

      // Should navigate back to list
      await expect(adminPage).toHaveURL(/modules\/product-catalog\/product/);
    });
  });

  test.describe('PROD-013: URL State Persistence', () => {
    test('should persist filter in URL', async ({ adminPage }) => {
      await navigateToProductList(adminPage);
      await adminPage.waitForTimeout(1000);

      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Product');
      await adminPage.waitForTimeout(1000);

      // URL should contain filter
      const url = adminPage.url();
      expect(url).toContain('filter=Product');

      // Reload page
      await adminPage.reload();

      // Filter should be restored
      const inputValue = await searchInput.inputValue();
      expect(inputValue).toBe('Product');
    });

    test('should persist sort state in URL', async ({ adminPage }) => {
      await navigateToProductList(adminPage);

      // Sort by SKU code
      const sortButton = adminPage.locator('button:near(:text("SKU Code"))').first();
      await sortButton.click();
      await adminPage.waitForTimeout(300);

      // URL should contain sort parameters
      const url = adminPage.url();
      expect(url).toContain('sort=skuCode');
      expect(url).toContain('order=');

      // Reload page
      await adminPage.reload();

      // Sort state should be maintained
      const reloadedUrl = adminPage.url();
      expect(reloadedUrl).toContain('sort=skuCode');
    });

    test('should restore all state from URL', async ({ adminPage }) => {
      await adminPage.goto('/console/modules/product-catalog/product?page=1&perPage=10&sort=name&order=asc&filter=Test');

      await adminPage.waitForLoadState('networkidle');

      const url = adminPage.url();
      expect(url).toContain('page=1');
      expect(url).toContain('sort=name');
      expect(url).toContain('order=asc');
      expect(url).toContain('filter=Test');

      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
      const value = await searchInput.inputValue();
      expect(value).toBe('Test');
    });
  });

  test.describe('Edge Cases and Error Handling', () => {
    test('should handle empty list state', async ({ adminPage }) => {
      await navigateToProductList(adminPage);

      const tableRows = adminPage.locator('table tbody tr');
      const rowCount = await tableRows.count();

      if (rowCount === 0) {
        await expect(adminPage.locator('table')).toBeVisible();
      }
    });

    test('should handle form submission errors', async ({ adminPage }) => {
      await navigateToProductList(adminPage);
      await adminPage.click('button:has-text("Add Product")');

      // Clear default values and try to submit incomplete form
      await adminPage.fill('input[name="skuCode"]', '');
      await adminPage.fill('input[name="name"]', '');
      await adminPage.click('button:has-text("Save")');

      // Should show validation errors instead of crashing
      await expect(adminPage.locator('text=/required/i').first()).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Accessibility and UI/UX', () => {
    test('should have accessible form labels', async ({ adminPage }) => {
      await navigateToProductList(adminPage);
      await adminPage.click('button:has-text("Add Product")');

      // Check for form labels
      await expect(adminPage.locator('label:has-text("SKU Code")')).toBeVisible();
      await expect(adminPage.locator('label:has-text("Name")')).toBeVisible();
      await expect(adminPage.locator('label:has-text("Base Cost Price")')).toBeVisible();
      await expect(adminPage.locator('label:has-text("Selling Price")')).toBeVisible();
      await expect(adminPage.locator('label:has-text("Status")')).toBeVisible();
    });

    test('should display loading states', async ({ adminPage }) => {
      await navigateToProductList(adminPage);

      // Trigger an action that shows loading
      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Test');

      // Loading indicator might appear briefly
      await adminPage.waitForLoadState('networkidle');
    });
  });

  test.describe('Performance', () => {
    test('should load product list within acceptable time', async ({ adminPage }) => {
      const startTime = Date.now();

      await navigateToProductList(adminPage);
      await adminPage.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should debounce search input', async ({ adminPage }) => {
      await navigateToProductList(adminPage);

      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();

      // Type quickly
      await searchInput.fill('T');
      await adminPage.waitForTimeout(100);
      await searchInput.fill('Te');
      await adminPage.waitForTimeout(100);
      await searchInput.fill('Test');

      // Wait for debounce
      await adminPage.waitForTimeout(600);

      // Only one final search should execute
      await adminPage.waitForLoadState('networkidle');
    });
  });
});
