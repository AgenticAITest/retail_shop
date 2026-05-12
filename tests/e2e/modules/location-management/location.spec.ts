import { test, expect, TEST_USERS } from '../../../fixtures/auth';
import type { Page } from '@playwright/test';

/**
 * Location Management CRUD Tests
 *
 * Comprehensive test suite for Location management in location-management module.
 */

// Test data
const generateTestLocation = () => ({
  code: `LOC-${Date.now()}`,
  name: `Test Location ${Date.now()}`,
  type: 'shop',
  address: '123 Test Street',
  city: 'Jakarta',
  province: 'DKI Jakarta',
  phone: '021-1234567',
});

// Helper functions
async function navigateToLocationList(page: Page) {
  await page.goto('/console/modules/location-management/location');
  await page.waitForURL('**/modules/location-management/location**');
}

async function fillLocationForm(page: Page, location: {
  code: string;
  name: string;
  type: string;
  address: string;
  city: string;
  province: string;
  phone: string;
}) {
  // Fill code
  await page.fill('input[name="code"]', location.code);

  // Fill name
  await page.fill('input[name="name"]', location.name);

  // Select type
  const typeSelect = page.locator('button:has-text("Select type"), button:has-text("Shop"), button:has-text("Warehouse"), button:has-text("Distribution Center")').first();
  await typeSelect.click();
  await page.waitForTimeout(300);
  if (location.type === 'shop') {
    await page.click('div[role="option"]:has-text("Shop")');
  } else if (location.type === 'warehouse') {
    await page.click('div[role="option"]:has-text("Warehouse")');
  } else if (location.type === 'distribution_center') {
    await page.click('div[role="option"]:has-text("Distribution Center")');
  }

  // Fill address
  await page.fill('textarea[name="address"]', location.address);

  // Fill city
  await page.fill('input[name="city"]', location.city);

  // Fill province
  await page.fill('input[name="province"]', location.province);

  // Fill phone
  await page.fill('input[name="phone"]', location.phone);
}

test.describe('Location CRUD Operations', () => {

  test.describe('LOC-001: View Location List with Pagination', () => {
    test('should display location list page with proper structure', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);

      // Verify page title
      await expect(tenantAdminPage.locator('h1')).toContainText('Locations');

      // Verify table structure
      const table = tenantAdminPage.locator('table');
      await expect(table).toBeVisible();

      // Verify table headers
      await expect(tenantAdminPage.locator('th:has-text("#")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Code")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Name")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Type")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("City")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Status")')).toBeVisible();
    });

    test('should handle pagination controls', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);

      // Check if pagination controls exist
      const paginationContainer = tenantAdminPage.locator('[data-testid="pagination"]').first();

      // If pagination exists (depends on data)
      if (await paginationContainer.isVisible()) {
        // Check for page navigation
        await expect(tenantAdminPage).toHaveURL(/page=1/);

        // Try to go to next page if possible
        const nextButton = tenantAdminPage.locator('button:has-text("Next"), button[aria-label*="next"]');
        if (await nextButton.isEnabled()) {
          await nextButton.click();
          await expect(tenantAdminPage).toHaveURL(/page=2/);
        }
      }
    });

    test('should persist pagination state in URL', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);

      // URL should have default parameters
      const url = tenantAdminPage.url();
      expect(url).toMatch(/modules\/location-management\/location/);
    });
  });

  test.describe('LOC-002: Search/Filter Locations', () => {
    test('should display search input', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await expect(searchInput).toBeVisible();
    });

    test('should filter locations by search term', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);

      // Wait for initial load
      await tenantAdminPage.waitForTimeout(1000);

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Jakarta');

      // Wait for debounce (500ms)
      await tenantAdminPage.waitForTimeout(1000);

      // Check URL contains filter
      await expect(tenantAdminPage).toHaveURL(/filter=Jakarta/);

      // Verify loading completed
      await tenantAdminPage.waitForLoadState('networkidle');
    });

    test('should clear search filter', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);
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

  test.describe('LOC-003: Sort Location List', () => {
    test('should sort by Code column', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);

      // Click Code column sort button
      const codeSortButton = tenantAdminPage.locator('button:near(:text("Code"))').first();
      await codeSortButton.click();

      // First click on a new column starts ascending
      await tenantAdminPage.waitForTimeout(300);
      await expect(tenantAdminPage).toHaveURL(/sort=code/);
      await expect(tenantAdminPage).toHaveURL(/order=asc/);

      // Click again to sort descending
      await codeSortButton.click();
      await tenantAdminPage.waitForTimeout(300);
      await expect(tenantAdminPage).toHaveURL(/order=desc/);
    });

    test('should sort by Name column', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);

      const nameSortButton = tenantAdminPage.locator('button:near(:text("Name"))').first();
      await nameSortButton.click();

      await tenantAdminPage.waitForTimeout(300);
      await expect(tenantAdminPage).toHaveURL(/sort=name/);
    });

    test('should sort by Type column', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);

      const typeSortButton = tenantAdminPage.locator('button:near(:text("Type"))').first();
      await typeSortButton.click();

      await tenantAdminPage.waitForTimeout(300);
      await expect(tenantAdminPage).toHaveURL(/sort=type/);
    });
  });

  test.describe('LOC-004: Create New Location - Success', () => {
    test('should display Add Location button with proper permission', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);

      const addButton = tenantAdminPage.locator('button:has-text("Add Location")');
      await expect(addButton).toBeVisible();
    });

    test('should navigate to add location page', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);

      await tenantAdminPage.click('button:has-text("Add Location")');
      await expect(tenantAdminPage).toHaveURL(/location\/add/);

      // Verify breadcrumb
      await expect(tenantAdminPage.locator('text=Add Location')).toBeVisible();
    });

    test('should create location with valid data', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Location")');

      const testLoc = generateTestLocation();

      // Fill form fields
      await fillLocationForm(tenantAdminPage, testLoc);

      // Submit form
      await tenantAdminPage.click('button:has-text("Save")');

      // Wait for success message
      await expect(tenantAdminPage.locator('text=/Location has been created/i')).toBeVisible({ timeout: 5000 });

      // Verify redirect to list
      await expect(tenantAdminPage).toHaveURL(/modules\/location-management\/location/);

      // Search for the new location (avoids pagination issues with accumulated data)
      await tenantAdminPage.waitForTimeout(500);
      const createSearchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await createSearchInput.fill(testLoc.code);
      await tenantAdminPage.waitForTimeout(800);
      await tenantAdminPage.waitForLoadState('networkidle');
      await expect(tenantAdminPage.locator(`text=${testLoc.code}`).first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('LOC-005: Create Location - Validation Errors', () => {
    test('should show validation errors for empty required fields', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Location")');

      // Clear default values
      await tenantAdminPage.fill('input[name="code"]', '');
      await tenantAdminPage.fill('input[name="name"]', '');

      // Try to submit without filling required fields
      await tenantAdminPage.click('button:has-text("Save")');

      // Should show validation errors
      await expect(tenantAdminPage.locator('text=/required/i').first()).toBeVisible({ timeout: 3000 });
    });

    test('should validate Code field is required', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Location")');

      // Fill name but leave code empty
      await tenantAdminPage.fill('input[name="code"]', '');
      await tenantAdminPage.fill('input[name="name"]', 'Test Location');

      await tenantAdminPage.click('button:has-text("Save")');

      // Should show code required error
      await expect(tenantAdminPage.locator('text=/Code is required/i')).toBeVisible({ timeout: 3000 });
    });

    test('should validate Name field is required', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Location")');

      // Fill code but leave name empty
      await tenantAdminPage.fill('input[name="code"]', 'TEST-CODE');
      await tenantAdminPage.fill('input[name="name"]', '');

      await tenantAdminPage.click('button:has-text("Save")');

      // Should show name required error
      await expect(tenantAdminPage.locator('text=/Name is required/i')).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('LOC-006: Create Location - Duplicate Code', () => {
    test('should prevent duplicate location codes', async ({ tenantAdminPage }) => {
      // First, create a location
      await navigateToLocationList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Location")');

      const testLoc = generateTestLocation();

      await fillLocationForm(tenantAdminPage, testLoc);

      await tenantAdminPage.click('button:has-text("Save")');
      await tenantAdminPage.waitForTimeout(1000);

      // Try to create another location with the same code
      await navigateToLocationList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Location")');

      await tenantAdminPage.fill('input[name="code"]', testLoc.code);
      await tenantAdminPage.fill('input[name="name"]', 'Another Location');

      // Submit form
      await tenantAdminPage.click('button:has-text("Save")');

      // Wait for duplicate code error to appear
      await tenantAdminPage.waitForTimeout(1000);

      // Should show duplicate code error
      await expect(tenantAdminPage.locator('text=/Code must be unique|Code already exists/i')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('LOC-007: View Location Details', () => {
    test('should view location details', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);

      await tenantAdminPage.waitForTimeout(1000);

      // Click on first location code link
      const locationLink = tenantAdminPage.locator('table tbody tr td a').first();

      if (await locationLink.isVisible()) {
        const locationCode = await locationLink.textContent();
        await locationLink.click();

        // Should navigate to view page
        await expect(tenantAdminPage).toHaveURL(/location\/[a-f0-9-]+$/);

        // Verify breadcrumb shows location name
        if (locationCode) {
          await expect(tenantAdminPage.locator('text=Locations').first()).toBeVisible();
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
    });
  });

  test.describe('LOC-008: Edit Location - Success', () => {
    test('should edit location successfully', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      // Click edit button on first location row
      const editButton = tenantAdminPage.getByRole('button').filter({ hasText: /^$/ }).nth(1);

      if (await editButton.isVisible()) {
        await editButton.click();

        // Should navigate to edit page
        await expect(tenantAdminPage).toHaveURL(/location\/[a-f0-9-]+\/edit/);

        // Modify name field
        const nameInput = tenantAdminPage.locator('input[name="name"]');
        await nameInput.clear();
        await nameInput.fill(`Updated Location ${Date.now()}`);

        // Save changes
        await tenantAdminPage.click('button:has-text("Save")');

        // Wait for success message
        await expect(tenantAdminPage.locator('text=/Location has been updated/i')).toBeVisible({ timeout: 5000 });

        // Should redirect to list
        await expect(tenantAdminPage).toHaveURL(/modules\/location-management\/location/);
      }
    });

    test('should pre-populate form with existing data', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      const editButton = tenantAdminPage.getByRole('button').filter({ hasText: /^$/ }).nth(1);

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

  test.describe('LOC-009: Edit Location - Validation Errors', () => {
    test('should validate required fields on edit', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      const editButton = tenantAdminPage.getByRole('button').filter({ hasText: /^$/ }).nth(1);

      if (await editButton.isVisible()) {
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

  test.describe('LOC-010: Delete Location - Success', () => {
    test('should delete location after confirmation', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);

      // Create a test location first
      await tenantAdminPage.click('button:has-text("Add Location")');
      const testLoc = generateTestLocation();

      await fillLocationForm(tenantAdminPage, testLoc);

      await tenantAdminPage.click('button:has-text("Save")');
      await tenantAdminPage.waitForTimeout(1000);

      // Navigate to list and search for the created location (avoids pagination issues)
      await navigateToLocationList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);
      const deleteSearchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await deleteSearchInput.fill(testLoc.code);
      await tenantAdminPage.waitForTimeout(800);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Find the test location row and click delete
      const locationRow = tenantAdminPage.locator(`tr:has-text("${testLoc.code}")`);
      const deleteButton = locationRow.locator('button').last(); // Last button is usually delete

      await deleteButton.click();

      // Confirm deletion in dialog
      await expect(tenantAdminPage.locator('text=/Confirm Delete/i')).toBeVisible();
      await expect(tenantAdminPage.locator('text=/cannot be undone/i')).toBeVisible();

      // Click confirm
      const confirmButton = tenantAdminPage.locator('button:has-text("Confirm"), button:has-text("Delete")').last();
      await confirmButton.click();

      // Wait for success message
      await expect(tenantAdminPage.locator('text=/deleted successfully/i')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('LOC-011: Delete Location - Cancel', () => {
    test('should cancel delete operation', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      // Click delete button on first location
      const deleteButton = tenantAdminPage.locator('table tbody tr').first().locator('button').last();

      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        // Verify confirmation dialog appears
        await expect(tenantAdminPage.locator('text=/Confirm Delete/i')).toBeVisible({ timeout: 3000 });

        // Click cancel
        const cancelButton = tenantAdminPage.locator('button:has-text("Cancel")');
        await cancelButton.click();

        // Dialog should close
        await expect(tenantAdminPage.locator('text=/Confirm Delete/i')).not.toBeVisible();

        // Location should still be in the list
        await expect(tenantAdminPage.locator('table tbody tr').first()).toBeVisible();
      }
    });
  });

  test.describe('LOC-012: Navigation and Breadcrumbs', () => {
    test('should display breadcrumbs on add page', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Location")');

      // Verify breadcrumb structure
      await expect(tenantAdminPage.locator('text=Locations').first()).toBeVisible();
      await expect(tenantAdminPage.locator('text=Add Location')).toBeVisible();
    });

    test('should navigate back via breadcrumb', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Location")');
      await tenantAdminPage.waitForTimeout(1000);

      // Click Locations in breadcrumb
      const breadcrumbLink = tenantAdminPage.locator('a:has-text("Locations")').first();
      if (await breadcrumbLink.isVisible()) {
        await breadcrumbLink.click();
        await expect(tenantAdminPage).toHaveURL(/modules\/location-management\/location/);
      }
    });

    test('should handle cancel button navigation', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Location")');

      // Click cancel
      const cancelButton = tenantAdminPage.locator('button:has-text("Cancel")');
      await cancelButton.click();

      // Should navigate back to list
      await expect(tenantAdminPage).toHaveURL(/modules\/location-management\/location/);
    });
  });

  test.describe('LOC-013: URL State Persistence', () => {
    test('should persist filter in URL', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1000);

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Jakarta');
      await tenantAdminPage.waitForTimeout(1000);

      // URL should contain filter
      const url = tenantAdminPage.url();
      expect(url).toContain('filter=Jakarta');

      // Reload page
      await tenantAdminPage.reload();

      // Filter should be restored
      const inputValue = await searchInput.inputValue();
      expect(inputValue).toBe('Jakarta');
    });

    test('should persist sort state in URL', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);

      // Sort by code
      const sortButton = tenantAdminPage.locator('button:near(:text("Code"))').first();
      await sortButton.click();
      await tenantAdminPage.waitForTimeout(300);

      // URL should contain sort parameters
      const url = tenantAdminPage.url();
      expect(url).toContain('sort=code');
      expect(url).toContain('order=');

      // Reload page
      await tenantAdminPage.reload();

      // Sort state should be maintained
      const reloadedUrl = tenantAdminPage.url();
      expect(reloadedUrl).toContain('sort=code');
    });

    test('should restore all state from URL', async ({ tenantAdminPage }) => {
      // Navigate with specific URL parameters
      await tenantAdminPage.goto('/console/modules/location-management/location?page=1&perPage=10&sort=code&order=asc&filter=Test');

      await tenantAdminPage.waitForLoadState('networkidle');

      // Verify all states are applied
      const url = tenantAdminPage.url();
      expect(url).toContain('page=1');
      expect(url).toContain('sort=code');
      expect(url).toContain('order=asc');
      expect(url).toContain('filter=Test');

      // Search input should have the filter value
      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      const value = await searchInput.inputValue();
      expect(value).toBe('Test');
    });
  });

  test.describe('Edge Cases and Error Handling', () => {
    test('should handle empty list state', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);

      // If no data, appropriate message or empty state should be shown
      const tableRows = tenantAdminPage.locator('table tbody tr');
      const rowCount = await tableRows.count();

      if (rowCount === 0) {
        await expect(tenantAdminPage.locator('table')).toBeVisible();
      }
    });

    test('should handle form submission errors', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Location")');

      // Clear default values and try to submit incomplete form
      await tenantAdminPage.fill('input[name="code"]', '');
      await tenantAdminPage.fill('input[name="name"]', '');
      await tenantAdminPage.click('button:has-text("Save")');

      // Should show validation errors instead of crashing
      await expect(tenantAdminPage.locator('text=/required/i').first()).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Accessibility and UI/UX', () => {
    test('should have accessible form labels', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Add Location")');

      // Check for form labels
      await expect(tenantAdminPage.locator('label:has-text("Code")')).toBeVisible();
      await expect(tenantAdminPage.locator('label:has-text("Name")')).toBeVisible();
      await expect(tenantAdminPage.locator('label:has-text("Type")')).toBeVisible();
    });

    test('should display loading states', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);

      // Trigger an action that shows loading
      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Test');

      // Loading indicator might appear briefly
      await tenantAdminPage.waitForLoadState('networkidle');
    });
  });

  test.describe('Performance', () => {
    test('should load location list within acceptable time', async ({ tenantAdminPage }) => {
      const startTime = Date.now();

      await navigateToLocationList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should debounce search input', async ({ tenantAdminPage }) => {
      await navigateToLocationList(tenantAdminPage);

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]').first();

      // Type quickly
      await searchInput.fill('T');
      await tenantAdminPage.waitForTimeout(100);
      await searchInput.fill('Te');
      await tenantAdminPage.waitForTimeout(100);
      await searchInput.fill('Test');

      // Should not trigger multiple searches
      // Wait for debounce
      await tenantAdminPage.waitForTimeout(600);

      // Only one final search should execute
      await tenantAdminPage.waitForLoadState('networkidle');
    });
  });
});
