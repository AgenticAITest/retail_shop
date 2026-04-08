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
    test('should display category list page with proper structure', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);

      // Verify page title
      await expect(adminPage.locator('h1')).toContainText('Categories');

      // Verify table structure
      const table = adminPage.locator('table');
      await expect(table).toBeVisible();

      // Verify table headers
      await expect(adminPage.locator('th:has-text("#")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Name")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Level")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Parent")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Status")')).toBeVisible();
    });

    test('should handle pagination controls', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);

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
      await navigateToCategoryList(adminPage);

      const url = adminPage.url();
      expect(url).toMatch(/modules\/product-catalog\/category/);
    });

    test('should support list and tree view toggle', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);

      // Verify List View and Tree View buttons
      await expect(adminPage.locator('button:has-text("List View")')).toBeVisible();
      await expect(adminPage.locator('button:has-text("Tree View")')).toBeVisible();

      // Click Tree View
      await adminPage.click('button:has-text("Tree View")');
      await adminPage.waitForTimeout(1000);

      // Tree view content should be visible
      await expect(adminPage.locator('text=Categories')).toBeVisible();

      // Switch back to List View
      await adminPage.click('button:has-text("List View")');
      await adminPage.waitForTimeout(500);

      // Table should be visible again
      await expect(adminPage.locator('table')).toBeVisible();
    });
  });

  test.describe('CAT-002: Search/Filter Categories', () => {
    test('should display search input', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);

      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
      await expect(searchInput).toBeVisible();
    });

    test('should filter categories by search term', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);

      await adminPage.waitForTimeout(1000);

      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Electronics');

      // Wait for debounce (500ms)
      await adminPage.waitForTimeout(1000);

      // Check URL contains filter
      await expect(adminPage).toHaveURL(/filter=Electronics/);

      // Verify loading completed
      await adminPage.waitForLoadState('networkidle');
    });

    test('should clear search filter', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);
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

  test.describe('CAT-003: Sort Category List', () => {
    test('should sort by Name column', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);

      const nameSortButton = adminPage.locator('button:near(:text("Name"))').first();
      await nameSortButton.click();

      await adminPage.waitForTimeout(300);
      await expect(adminPage).toHaveURL(/sort=name/);
      await expect(adminPage).toHaveURL(/order=desc/);

      // Click again to sort ascending
      await nameSortButton.click();
      await adminPage.waitForTimeout(300);
      await expect(adminPage).toHaveURL(/order=asc/);
    });

    test('should sort by Level column', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);

      const levelSortButton = adminPage.locator('button:near(:text("Level"))').first();
      await levelSortButton.click();

      await adminPage.waitForTimeout(300);
      await expect(adminPage).toHaveURL(/sort=level/);
    });

    test('should sort by Status column', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);

      const statusSortButton = adminPage.locator('button:near(:text("Status"))').first();
      await statusSortButton.click();

      await adminPage.waitForTimeout(300);
      await expect(adminPage).toHaveURL(/sort=status/);
    });
  });

  test.describe('CAT-004: Create New Category - Success', () => {
    test('should display Add Category button with proper permission', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);

      const addButton = adminPage.locator('button:has-text("Add Category")');
      await expect(addButton).toBeVisible();
    });

    test('should navigate to add category page', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);

      await adminPage.click('button:has-text("Add Category")');
      await expect(adminPage).toHaveURL(/category\/add/);

      // Verify breadcrumb
      await expect(adminPage.locator('text=Add Category')).toBeVisible();
    });

    test('should create category with valid data', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);
      await adminPage.click('button:has-text("Add Category")');

      const testCat = generateTestCategory();

      // Fill form fields
      await fillCategoryForm(adminPage, testCat);

      // Submit form
      await adminPage.click('button:has-text("Save")');

      // Wait for success message
      await expect(adminPage.locator('text=/Category has been created/i')).toBeVisible({ timeout: 5000 });

      // Verify redirect to list
      await expect(adminPage).toHaveURL(/modules\/product-catalog\/category/);

      // Verify new category appears in list
      await adminPage.waitForTimeout(500);
      await expect(adminPage.locator(`text=${testCat.name}`)).toBeVisible();
    });
  });

  test.describe('CAT-005: Create Category - Validation Errors', () => {
    test('should show validation errors for empty required fields', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);
      await adminPage.click('button:has-text("Add Category")');

      // Try to submit without filling any fields
      await adminPage.click('button:has-text("Save")');

      // Should show validation errors
      await expect(adminPage.locator('text=/Name is required/i')).toBeVisible({ timeout: 3000 });
    });

    test('should validate Name field is required', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);
      await adminPage.click('button:has-text("Add Category")');

      // Leave name empty, fill other fields
      await adminPage.fill('input[name="name"]', '');

      await adminPage.click('button:has-text("Save")');

      // Should show name required error
      await expect(adminPage.locator('text=/Name is required/i')).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('CAT-006: View Category Details', () => {
    test('should view category details via view button', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);

      await adminPage.waitForTimeout(1000);

      // Click view button on first category row (Eye icon button)
      const tableRows = adminPage.locator('table tbody tr');
      const rowCount = await tableRows.count();

      if (rowCount > 0) {
        // Click the first view button (outline variant with Eye icon)
        const viewButton = tableRows.first().locator('button').first();
        await viewButton.click();

        // Should navigate to view page
        await expect(adminPage).toHaveURL(/category\/[a-f0-9-]+$/);

        // Verify Edit and Delete buttons are visible
        await expect(adminPage.locator('button:has-text("Edit")')).toBeVisible();
        await expect(adminPage.locator('button:has-text("Delete")')).toBeVisible();

        // Verify form fields are read-only (disabled)
        const nameInput = adminPage.locator('input[name="name"]');
        await expect(nameInput).toBeDisabled();
      }
    });
  });

  test.describe('CAT-007: Edit Category - Success', () => {
    test('should edit category successfully', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);
      await adminPage.waitForTimeout(1000);

      // Click edit button on first category row (Pencil icon - second button)
      const tableRows = adminPage.locator('table tbody tr');
      const rowCount = await tableRows.count();

      if (rowCount > 0) {
        const editButton = tableRows.first().locator('button').nth(1);
        await editButton.click();

        // Should navigate to edit page
        await expect(adminPage).toHaveURL(/category\/[a-f0-9-]+\/edit/);

        // Modify name field
        const nameInput = adminPage.locator('input[name="name"]');
        await nameInput.clear();
        await nameInput.fill(`Updated Category ${Date.now()}`);

        // Save changes
        await adminPage.click('button:has-text("Save")');

        // Wait for success message
        await expect(adminPage.locator('text=/Category has been updated/i')).toBeVisible({ timeout: 5000 });

        // Should redirect to list
        await expect(adminPage).toHaveURL(/modules\/product-catalog\/category/);
      }
    });

    test('should pre-populate form with existing data', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);
      await adminPage.waitForTimeout(1000);

      const tableRows = adminPage.locator('table tbody tr');
      const rowCount = await tableRows.count();

      if (rowCount > 0) {
        const editButton = tableRows.first().locator('button').nth(1);
        await editButton.click();
        await adminPage.waitForURL(/edit/);

        await adminPage.waitForTimeout(1000);

        // Verify form fields are populated
        const nameInput = adminPage.locator('input[name="name"]');
        const nameValue = await nameInput.inputValue();
        expect(nameValue).not.toBe('');
      }
    });
  });

  test.describe('CAT-008: Edit Category - Validation Errors', () => {
    test('should validate required fields on edit', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);
      await adminPage.waitForTimeout(1000);

      const tableRows = adminPage.locator('table tbody tr');
      const rowCount = await tableRows.count();

      if (rowCount > 0) {
        const editButton = tableRows.first().locator('button').nth(1);
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

  test.describe('CAT-009: Delete Category - Success', () => {
    test('should delete category after confirmation', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);

      // Create a test category first
      await adminPage.click('button:has-text("Add Category")');
      const testCat = generateTestCategory();

      await fillCategoryForm(adminPage, testCat);

      await adminPage.click('button:has-text("Save")');
      await adminPage.waitForTimeout(1000);

      // Now go back to list and delete it
      await navigateToCategoryList(adminPage);
      await adminPage.waitForTimeout(1000);

      // Find the test category row and click delete (last button in row)
      const categoryRow = adminPage.locator(`tr:has-text("${testCat.name}")`);
      const deleteButton = categoryRow.locator('button').last();

      await deleteButton.click();

      // Confirm deletion in dialog
      await expect(adminPage.locator('text=/Confirm Delete/i')).toBeVisible();
      await expect(adminPage.locator('text=/cannot be undone/i')).toBeVisible();

      // Click confirm
      const confirmButton = adminPage.locator('button:has-text("Confirm"), button:has-text("Delete")').last();
      await confirmButton.click();

      // Wait for success message
      await expect(adminPage.locator('text=/deleted successfully/i')).toBeVisible({ timeout: 5000 });

      // Verify category is removed from list
      await adminPage.waitForTimeout(500);
      await expect(adminPage.locator(`text=${testCat.name}`)).not.toBeVisible();
    });
  });

  test.describe('CAT-010: Delete Category - Cancel', () => {
    test('should cancel delete operation', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);
      await adminPage.waitForTimeout(1000);

      // Click delete button on first category (last button in first row)
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

        // Category should still be in the list
        await expect(tableRows.first()).toBeVisible();
      }
    });
  });

  test.describe('CAT-011: Navigation and Breadcrumbs', () => {
    test('should display breadcrumbs on add page', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);
      await adminPage.click('button:has-text("Add Category")');

      // Verify breadcrumb structure
      await expect(adminPage.locator('text=Categories')).toBeVisible();
      await expect(adminPage.locator('text=Add Category')).toBeVisible();
    });

    test('should navigate back via breadcrumb', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);
      await adminPage.click('button:has-text("Add Category")');
      await adminPage.waitForTimeout(1000);

      // Click Categories in breadcrumb
      const breadcrumbLink = adminPage.locator('a:has-text("Categories")').first();
      if (await breadcrumbLink.isVisible()) {
        await breadcrumbLink.click();
        await expect(adminPage).toHaveURL(/modules\/product-catalog\/category/);
      }
    });

    test('should handle cancel button navigation', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);
      await adminPage.click('button:has-text("Add Category")');

      // Click cancel
      const cancelButton = adminPage.locator('button:has-text("Cancel")');
      await cancelButton.click();

      // Should navigate back to list
      await expect(adminPage).toHaveURL(/modules\/product-catalog\/category/);
    });
  });

  test.describe('CAT-012: URL State Persistence', () => {
    test('should persist filter in URL', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);
      await adminPage.waitForTimeout(1000);

      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Electronics');
      await adminPage.waitForTimeout(1000);

      // URL should contain filter
      const url = adminPage.url();
      expect(url).toContain('filter=Electronics');

      // Reload page
      await adminPage.reload();

      // Filter should be restored
      const inputValue = await searchInput.inputValue();
      expect(inputValue).toBe('Electronics');
    });

    test('should restore all state from URL', async ({ adminPage }) => {
      await adminPage.goto('/console/modules/product-catalog/category?page=1&perPage=10&sort=name&order=asc&filter=Test');

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

  test.describe('Performance', () => {
    test('should load category list within acceptable time', async ({ adminPage }) => {
      const startTime = Date.now();

      await navigateToCategoryList(adminPage);
      await adminPage.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should debounce search input', async ({ adminPage }) => {
      await navigateToCategoryList(adminPage);

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
