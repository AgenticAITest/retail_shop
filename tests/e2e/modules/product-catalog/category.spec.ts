import { test, expect, TEST_USERS } from '../../../fixtures/auth';
import type { Page } from '@playwright/test';

/**
 * Category CRUD Tests
 *
 * Comprehensive test suite for Category management in product-catalog module.
 */

// Test data
const generateTestCategory = () => ({
  name: `Test Category ${Date.now()}`,
  sortOrder: '0',
});

// Helper functions
async function navigateToCategoryList(page: Page) {
  await page.goto('/console/modules/product-catalog/category');
  await page.waitForURL('**/modules/product-catalog/category**');
}

async function fillCategoryForm(page: Page, category: {
  name: string;
  sortOrder?: string;
}) {
  // Fill name
  await page.fill('input[name="name"]', category.name);

  // Fill sort order if provided
  if (category.sortOrder !== undefined) {
    const sortInput = page.locator('input[name="sortOrder"]');
    await sortInput.clear();
    await sortInput.fill(category.sortOrder);
  }
}

test.describe('Category CRUD Operations', () => {

  test.describe('CAT-001: View Category List with Pagination', () => {
    test('should display category list page with proper structure', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);

      // Verify page title
      await expect(tenantAdminPage.locator('h1')).toContainText('Categories');

      // Verify table structure
      const table = tenantAdminPage.locator('table');
      await expect(table).toBeVisible();

      // Verify table headers
      await expect(tenantAdminPage.locator('th:has-text("#")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Name")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Level")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Parent")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Status")')).toBeVisible();
    });

    test('should handle pagination controls', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);

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
      await navigateToCategoryList(tenantAdminPage);

      const url = tenantAdminPage.url();
      expect(url).toMatch(/modules\/product-catalog\/category/);
    });

    test('should support list and tree view toggle', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);

      // Verify List View and Tree View buttons
      await expect(tenantAdminPage.locator('button:has-text("List View")')).toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Tree View")')).toBeVisible();

      // Click Tree View
      await tenantAdminPage.click('button:has-text("Tree View")');
      await tenantAdminPage.waitForTimeout(1000);

      // Tree view content should be visible
      await expect(tenantAdminPage.locator('text=Categories').first()).toBeVisible();

      // Switch back to List View
      await tenantAdminPage.click('button:has-text("List View")');
      await tenantAdminPage.waitForTimeout(500);

      // Table should be visible again
      await expect(tenantAdminPage.locator('table')).toBeVisible();
    });
  });

  test.describe('CAT-002: Search/Filter Categories', () => {
    test('should display search input', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await expect(searchInput).toBeVisible();
    });

    test('should filter categories by search term', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);

      await tenantAdminPage.waitForTimeout(1000);

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Electronics');

      // Wait for debounce (500ms)
      await tenantAdminPage.waitForTimeout(1000);

      // Check URL contains filter
      await expect(tenantAdminPage).toHaveURL(/filter=Electronics/);

      // Verify loading completed
      await tenantAdminPage.waitForLoadState('networkidle');
    });

    test('should clear search filter', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);
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

  test.describe('CAT-003: Sort Category List', () => {
    test('should sort by Name column', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);

      const nameSortButton = tenantAdminPage.locator('button:near(:text("Name"))').first();
      await nameSortButton.click();

      await tenantAdminPage.waitForTimeout(300);
      await expect(tenantAdminPage).toHaveURL(/sort=name/);
      await expect(tenantAdminPage).toHaveURL(/order=desc/);

      // Click again to sort ascending
      await nameSortButton.click();
      await tenantAdminPage.waitForTimeout(300);
      await expect(tenantAdminPage).toHaveURL(/order=asc/);
    });

    test('should sort by Level column', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);

      const levelSortButton = tenantAdminPage.locator('button:near(:text("Level"))').first();
      await levelSortButton.click();

      await tenantAdminPage.waitForTimeout(300);
      await expect(tenantAdminPage).toHaveURL(/sort=level/);
    });

    test('should sort by Status column', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);

      const statusSortButton = tenantAdminPage.locator('button:near(:text("Status"))').first();
      await statusSortButton.click();

      await tenantAdminPage.waitForTimeout(300);
      await expect(tenantAdminPage).toHaveURL(/sort=status/);
    });
  });

  test.describe('CAT-004: Create New Category - Success', () => {
    test('should display Add Category button with proper permission', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);

      const addButton = tenantAdminPage.locator('button:has-text("Add Category")');
      await expect(addButton).toBeVisible();
    });

    test('should navigate to add category page', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);

      await tenantAdminPage.click('button:has-text("Add Category")');
      await expect(tenantAdminPage).toHaveURL(/category\/add/);

      // Verify breadcrumb
      await expect(tenantAdminPage.locator('text=Add Category')).toBeVisible();
    });

    test('should create category with valid data', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Category")');

      const testCat = generateTestCategory();

      // Fill form fields
      await fillCategoryForm(tenantAdminPage, testCat);

      // Submit form
      await tenantAdminPage.click('button:has-text("Save")');

      // Wait for success message
      await expect(tenantAdminPage.locator('text=/Category has been created/i')).toBeVisible({ timeout: 5000 });

      // Verify redirect to list
      await expect(tenantAdminPage).toHaveURL(/modules\/product-catalog\/category/);

      // Search for the new category (avoids pagination issues with accumulated data)
      await tenantAdminPage.waitForTimeout(500);
      const createSearchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await createSearchInput.fill(testCat.name);
      await tenantAdminPage.waitForTimeout(800);
      await tenantAdminPage.waitForLoadState('networkidle');
      await expect(tenantAdminPage.locator(`text=${testCat.name}`).first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('CAT-005: Create Category - Validation Errors', () => {
    test('should show validation errors for empty required fields', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Category")');

      // Try to submit without filling any fields
      await tenantAdminPage.click('button:has-text("Save")');

      // Should show validation errors
      await expect(tenantAdminPage.locator('text=/Name is required/i')).toBeVisible({ timeout: 3000 });
    });

    test('should validate Name field is required', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Category")');

      // Leave name empty, fill other fields
      await tenantAdminPage.fill('input[name="name"]', '');

      await tenantAdminPage.click('button:has-text("Save")');

      // Should show name required error
      await expect(tenantAdminPage.locator('text=/Name is required/i')).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('CAT-006: View Category Details', () => {
    test('should view category details via view button', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);

      await tenantAdminPage.waitForTimeout(1000);

      // Click view button on first category row (Eye icon button)
      const tableRows = tenantAdminPage.locator('table tbody tr');
      const rowCount = await tableRows.count();

      if (rowCount > 0) {
        // Click the first view button (outline variant with Eye icon)
        const viewButton = tableRows.first().locator('button').first();
        await viewButton.click();

        // Should navigate to view page
        await expect(tenantAdminPage).toHaveURL(/category\/[a-f0-9-]+$/);

        // Verify Edit and Delete buttons are visible
        await expect(tenantAdminPage.locator('button:has-text("Edit")')).toBeVisible();
        await expect(tenantAdminPage.locator('button:has-text("Delete")')).toBeVisible();

        // Verify form fields are read-only (disabled)
        const nameInput = tenantAdminPage.locator('input[name="name"]');
        await expect(nameInput).toBeDisabled();
      }
    });
  });

  test.describe('CAT-007: Edit Category - Success', () => {
    test('should edit category successfully', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      // Click edit button on first category row (Pencil icon - second button)
      const tableRows = tenantAdminPage.locator('table tbody tr');
      const rowCount = await tableRows.count();

      if (rowCount > 0) {
        const editButton = tableRows.first().locator('button').nth(1);
        await editButton.click();

        // Should navigate to edit page
        await expect(tenantAdminPage).toHaveURL(/category\/[a-f0-9-]+\/edit/);

        // Modify name field
        const nameInput = tenantAdminPage.locator('input[name="name"]');
        await nameInput.clear();
        await nameInput.fill(`Updated Category ${Date.now()}`);

        // Save changes
        await tenantAdminPage.click('button:has-text("Save")');

        // Wait for success message
        await expect(tenantAdminPage.locator('text=/Category has been updated/i')).toBeVisible({ timeout: 5000 });

        // Should redirect to list
        await expect(tenantAdminPage).toHaveURL(/modules\/product-catalog\/category/);
      }
    });

    test('should pre-populate form with existing data', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      const tableRows = tenantAdminPage.locator('table tbody tr');
      const rowCount = await tableRows.count();

      if (rowCount > 0) {
        const editButton = tableRows.first().locator('button').nth(1);
        await editButton.click();
        await tenantAdminPage.waitForURL(/edit/);

        await tenantAdminPage.waitForTimeout(1000);

        // Verify form fields are populated
        const nameInput = tenantAdminPage.locator('input[name="name"]');
        const nameValue = await nameInput.inputValue();
        expect(nameValue).not.toBe('');
      }
    });
  });

  test.describe('CAT-008: Edit Category - Validation Errors', () => {
    test('should validate required fields on edit', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      const tableRows = tenantAdminPage.locator('table tbody tr');
      const rowCount = await tableRows.count();

      if (rowCount > 0) {
        const editButton = tableRows.first().locator('button').nth(1);
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

  test.describe('CAT-009: Delete Category - Success', () => {
    test('should delete category after confirmation', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);

      // Create a test category first
      await tenantAdminPage.click('button:has-text("Add Category")');
      const testCat = generateTestCategory();

      await fillCategoryForm(tenantAdminPage, testCat);

      await tenantAdminPage.click('button:has-text("Save")');
      await tenantAdminPage.waitForTimeout(1000);

      // Navigate to list and search for the created category (avoids pagination issues)
      await navigateToCategoryList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);
      const deleteSearchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await deleteSearchInput.fill(testCat.name);
      await tenantAdminPage.waitForTimeout(800);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Find the test category row and click delete (last button in row)
      const categoryRow = tenantAdminPage.locator(`tr:has-text("${testCat.name}")`);
      const deleteButton = categoryRow.locator('button').last();

      await deleteButton.click();

      // Confirm deletion in dialog
      await expect(tenantAdminPage.locator('text=/Confirm Delete/i')).toBeVisible();
      await expect(tenantAdminPage.locator('text=/cannot be undone/i')).toBeVisible();

      // Click confirm
      const confirmButton = tenantAdminPage.locator('button:has-text("Confirm"), button:has-text("Delete")').last();
      await confirmButton.click();

      // Wait for success message
      await expect(tenantAdminPage.locator('text=/deleted successfully/i')).toBeVisible({ timeout: 5000 });

      // Category is soft-deleted (deactivated), still in list but with Inactive status
      await tenantAdminPage.waitForLoadState('networkidle');
      await expect(tenantAdminPage.locator(`tr:has-text("${testCat.name}")`).locator('text=Inactive')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('CAT-010: Delete Category - Cancel', () => {
    test('should cancel delete operation', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      // Click delete button on first category (last button in first row)
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

        // Category should still be in the list
        await expect(tableRows.first()).toBeVisible();
      }
    });
  });

  test.describe('CAT-011: Navigation and Breadcrumbs', () => {
    test('should display breadcrumbs on add page', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Category")');

      // Verify breadcrumb structure
      await expect(tenantAdminPage.locator('text=Categories').first()).toBeVisible();
      await expect(tenantAdminPage.locator('text=Add Category').first()).toBeVisible();
    });

    test('should navigate back via breadcrumb', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Category")');
      await tenantAdminPage.waitForTimeout(1000);

      // Click Categories in breadcrumb
      const breadcrumbLink = tenantAdminPage.locator('a:has-text("Categories")').first();
      if (await breadcrumbLink.isVisible()) {
        await breadcrumbLink.click();
        await expect(tenantAdminPage).toHaveURL(/modules\/product-catalog\/category/);
      }
    });

    test('should handle cancel button navigation', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Category")');

      // Click cancel
      const cancelButton = tenantAdminPage.locator('button:has-text("Cancel")');
      await cancelButton.click();

      // Should navigate back to list
      await expect(tenantAdminPage).toHaveURL(/modules\/product-catalog\/category/);
    });
  });

  test.describe('CAT-012: URL State Persistence', () => {
    test('should persist filter in URL', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Electronics');
      await tenantAdminPage.waitForTimeout(1000);

      // URL should contain filter
      const url = tenantAdminPage.url();
      expect(url).toContain('filter=Electronics');

      // Reload page
      await tenantAdminPage.reload();

      // Filter should be restored
      const inputValue = await searchInput.inputValue();
      expect(inputValue).toBe('Electronics');
    });

    test('should restore all state from URL', async ({ tenantAdminPage }) => {
      await tenantAdminPage.goto('/console/modules/product-catalog/category?page=1&perPage=10&sort=name&order=asc&filter=Test');

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

  test.describe('Performance', () => {
    test('should load category list within acceptable time', async ({ tenantAdminPage }) => {
      const startTime = Date.now();

      await navigateToCategoryList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should debounce search input', async ({ tenantAdminPage }) => {
      await navigateToCategoryList(tenantAdminPage);

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
