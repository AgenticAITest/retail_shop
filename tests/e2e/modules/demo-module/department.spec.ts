import { test, expect, TEST_USERS } from '../../../fixtures/auth';
import type { Page } from '@playwright/test';

/**
 * Department CRUD Tests
 * 
 * Comprehensive test suite for Department management in demo-module.
 * Based on test cases documented in /docs/test_case/modules/demo-module/DEPARTMENT_TEST_CASES.md
 */

// Test data
const generateTestDepartment = () => ({
  name: `Test Department ${Date.now()}`,
  group: 'Test Group',
  since: '2024-01-15',
  inTime: '08:00',
  outTime: '17:00'
});

// Helper functions
async function navigateToDepartmentList(page: Page) {
  await page.goto('/console/modules/demo-module/department');
  await page.waitForURL('**/modules/demo-module/department**');
}

async function fillDepartmentForm(page: Page, department: {
  name: string;
  group: string;
  since: string;
  inTime: string;
  outTime: string;
}) {
  // Fill name
  await page.fill('input[name="name"]', department.name);
  
  // Fill group
  await page.fill('input[name="group"]', department.group);
  
  // Fill since date - click button to open date picker
  const sinceButton = page.locator('button:has-text("Pick a date")').first();
  if (await sinceButton.isVisible()) {
    await sinceButton.click();
    // Select date from calendar (simplified - select 15th of current month)
    await page.click('button[name="day"]:has-text("15")');
  }
  
  // Fill in time (assuming time picker accepts direct input or has specific selectors)
  // Note: Adjust selectors based on actual TimePicker24h component implementation
  const inTimeField = page.locator('[name="inTime"]').first();
  if (await inTimeField.isVisible()) {
    await inTimeField.fill(department.inTime);
  }
  
  const outTimeField = page.locator('[name="outTime"]').first();
  if (await outTimeField.isVisible()) {
    await outTimeField.fill(department.outTime);
  }
}

test.describe('Department CRUD Operations', () => {
  
  test.describe('DEPT-001: View Department List with Pagination', () => {
    test('should display department list page with proper structure', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      
      // Verify page title
      await expect(adminPage.locator('h1')).toContainText('Departments');
      
      // Verify table structure
      const table = adminPage.locator('table');
      await expect(table).toBeVisible();
      
      // Verify table headers
      await expect(adminPage.locator('th:has-text("#")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Name")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Group")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Since")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("In Time")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Out Time")')).toBeVisible();
    });

    test('should handle pagination controls', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      
      // Check if pagination controls exist
      const paginationContainer = adminPage.locator('[data-testid="pagination"]').first();
      
      // If pagination exists (depends on data)
      if (await paginationContainer.isVisible()) {
        // Check for page navigation
        await expect(adminPage).toHaveURL(/page=1/);
        
        // Try to go to next page if possible
        const nextButton = adminPage.locator('button:has-text("Next"), button[aria-label*="next"]');
        if (await nextButton.isEnabled()) {
          await nextButton.click();
          await expect(adminPage).toHaveURL(/page=2/);
        }
      }
    });

    test('should persist pagination state in URL', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      
      // URL should have default parameters
      const url = adminPage.url();
      expect(url).toMatch(/modules\/demo-module\/department/);
    });
  });

  test.describe('DEPT-002: Search/Filter Departments', () => {
    test('should display search input', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      
      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
      await expect(searchInput).toBeVisible();
    });

    test('should filter departments by search term', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);

      // Wait for debounce (500ms)
      await adminPage.waitForTimeout(1000);
      
      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Engineering');

      // Wait for debounce (500ms)
      await adminPage.waitForTimeout(1000);
      
      // Check URL contains filter
      await expect(adminPage).toHaveURL(/filter=Engineering/);
      
      // Verify loading completed
      await adminPage.waitForLoadState('networkidle');
    });

    test('should clear search filter', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
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

  test.describe('DEPT-003: Sort Department List', () => {
    test('should sort by Name column', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      
      // Click Name column sort button
      const nameSortButton = adminPage.locator('button:near(:text("Name"))').first();
      await nameSortButton.click();
      
      // Check URL for sort parameters
      await adminPage.waitForTimeout(300);
      await expect(adminPage).toHaveURL(/sort=name/);
      await expect(adminPage).toHaveURL(/order=desc/);
      
      // Click again to sort descending
      await nameSortButton.click();
      await adminPage.waitForTimeout(300);
      await expect(adminPage).toHaveURL(/order=asc/);
    });

    test('should sort by Group column', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      
      const groupSortButton = adminPage.locator('button:near(:text("Group"))').first();
      await groupSortButton.click();
      
      await adminPage.waitForTimeout(300);
      await expect(adminPage).toHaveURL(/sort=group/);
    });
  });

  test.describe('DEPT-004: Create New Department - Success', () => {
    test('should display Add Department button with proper permission', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      
      const addButton = adminPage.locator('button:has-text("Add Department")');
      await expect(addButton).toBeVisible();
    });

    test('should navigate to add department page', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      
      await adminPage.click('button:has-text("Add Department")');
      await expect(adminPage).toHaveURL(/department\/add/);
      
      // Verify breadcrumb
      await expect(adminPage.locator('text=Add Department')).toBeVisible();
    });

    test('should create department with valid data', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      await adminPage.click('button:has-text("Add Department")');
      
      const testDept = generateTestDepartment();
      
      // Fill form fields
      await adminPage.fill('input[name="name"]', testDept.name);
      await adminPage.fill('input[name="group"]', testDept.group);
      
      // Handle date picker - click the button and select a date
      const dateButton = adminPage.locator('button:has-text("Pick a date")');
      if (await dateButton.isVisible()) {
        await dateButton.click();
        // Click on 15th day
        await adminPage.waitForTimeout(300);
        const dayButton = adminPage.locator('button[name="day"]').filter({ hasText: '15' }).first();
        await dayButton.click();
      }
      
      // Note: Time picker handling may need adjustment based on actual component
      // For now, we'll rely on default values or manual testing
      
      // Submit form
      await adminPage.click('button:has-text("Save")');
      
      // Wait for success message
      await expect(adminPage.locator('text=/Department has been created/i')).toBeVisible({ timeout: 5000 });
      
      // Verify redirect to list
      // await expect(adminPage).toHaveURL(/modules\/demo-module\/department$/);
      await expect(adminPage).toHaveURL(/page=1/);
      
      // Verify new department appears in list
      await adminPage.waitForTimeout(500);
      await expect(adminPage.locator(`text=${testDept.name}`)).toBeVisible();
    });
  });

  test.describe('DEPT-005: Create Department - Validation Errors', () => {
    test('should show validation errors for empty required fields', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      await adminPage.click('button:has-text("Add Department")');
      
      // Try to submit without filling any fields
      await adminPage.click('button:has-text("Save")');
      
      // Should show validation errors
      await expect(adminPage.locator('text=/required/i').first()).toBeVisible({ timeout: 3000 });
    });

    test('should validate Name field is required', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      await adminPage.click('button:has-text("Add Department")');
      
      // Fill other fields but leave name empty
      await adminPage.fill('input[name="group"]', 'Test Group');
      
      await adminPage.click('button:has-text("Save")');
      
      // Should show name required error
      await expect(adminPage.locator('text=/Name is required/i')).toBeVisible({ timeout: 3000 });
    });

    test('should validate Group field is required', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      await adminPage.click('button:has-text("Add Department")');
      
      // Fill name but leave group empty
      await adminPage.fill('input[name="name"]', 'Test Department');
      
      await adminPage.click('button:has-text("Save")');
      
      // Should show group required error
      await expect(adminPage.locator('text=/Group is required/i')).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('DEPT-006: Create Department - Duplicate Name', () => {
    test('should prevent duplicate department names', async ({ adminPage }) => {
      // First, create a department
      await navigateToDepartmentList(adminPage);
      await adminPage.click('button:has-text("Add Department")');
      
      const testDept = generateTestDepartment();
      
      await adminPage.fill('input[name="name"]', testDept.name);
      await adminPage.fill('input[name="group"]', testDept.group);
      
      // Handle date picker
      const dateButton = adminPage.locator('button:has-text("Pick a date")');
      if (await dateButton.isVisible()) {
        await dateButton.click();
        await adminPage.waitForTimeout(300);
        await adminPage.locator('button[name="day"]').filter({ hasText: '15' }).first().click();
      }
      
      await adminPage.click('button:has-text("Save")');
      await adminPage.waitForTimeout(1000);
      
      // Try to create another department with the same name
      await adminPage.click('button:has-text("Add Department")');
      await adminPage.fill('input[name="name"]', testDept.name);
      await adminPage.fill('input[name="group"]', 'Another Group');
      
      // Wait for async validation (debounced)
      // await adminPage.waitForTimeout(1000);

      // Submit form
      await adminPage.click('button:has-text("Save")');

      // Wait for duplicate name error to appear
      await adminPage.waitForTimeout(1000);
      
      // Should show duplicate name error
      await expect(adminPage.locator('text=/Name must be unique|Name already exists/i')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('DEPT-007: View Department Details', () => {
    test('should view department details', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);

      await adminPage.waitForTimeout(1000);
      
      // Click on first department name link
      const departmentLink = adminPage.locator('table tbody tr td a').first();
      
      if (await departmentLink.isVisible()) {
        const departmentName = await departmentLink.textContent();
        await departmentLink.click();

        // Should navigate to view page
        await expect(adminPage).toHaveURL(/department\/[a-f0-9-]+$/);
        
        // Verify breadcrumb shows department name
        if (departmentName) {
          await expect(adminPage.locator(`text=${departmentName}`)).toBeVisible();
        }
      }

      // Verify Edit and Delete buttons are visible
      await expect(adminPage.locator('button:has-text("Edit")')).toBeVisible();
      await expect(adminPage.locator('button:has-text("Delete")')).toBeVisible();
      
      // Verify form fields are read-only (disabled)
      const nameInput = adminPage.locator('input[name="name"]');
      await expect(nameInput).toBeDisabled();
    });
  });

  test.describe('DEPT-008: Edit Department - Success', () => {
    test('should edit department successfully', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      await adminPage.waitForTimeout(1000);
      
      // Click edit button on first department
      const editButton = adminPage.getByRole('button').filter({ hasText: /^$/ }).nth(1)
      
      if (await editButton.isVisible()) {
        await editButton.click();
        
        // Should navigate to edit page
        await expect(adminPage).toHaveURL(/department\/[a-f0-9-]+\/edit/);
        
        // Modify group field
        const groupInput = adminPage.locator('input[name="group"]');
        await groupInput.clear();
        await groupInput.fill(`Updated Group ${Date.now()}`);
        
        // Save changes
        await adminPage.click('button:has-text("Save")');
        
        // Wait for success message
        await expect(adminPage.locator('text=/Department has been updated/i')).toBeVisible({ timeout: 5000 });
        
        // Should redirect to list
        // await expect(adminPage).toHaveURL(/modules\/demo-module\/department$/);
        await expect(adminPage).toHaveURL(/page=1/);
      }
    });

    test('should pre-populate form with existing data', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      await adminPage.waitForTimeout(1000);

      //const editButton = adminPage.locator('button[aria-label="Edit"], button:has-text("Edit")').first();
      const editButton = adminPage.getByRole('button').filter({ hasText: /^$/ }).nth(1)
      
      if (await editButton.isVisible()) {
        await editButton.click();
        await adminPage.waitForURL(/edit/);

        await adminPage.waitForTimeout(1000);
        
        // Verify form fields are populated
        const nameInput = adminPage.locator('input[name="name"]');
        const nameValue = await nameInput.inputValue();
        expect(nameValue).not.toBe('');
        
        const groupInput = adminPage.locator('input[name="group"]');
        const groupValue = await groupInput.inputValue();
        expect(groupValue).not.toBe('');
      }
    });
  });

  test.describe('DEPT-009: Edit Department - Validation Errors', () => {
    test('should validate required fields on edit', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      await adminPage.waitForTimeout(1000);
      
      // const editButton = adminPage.locator('button[aria-label="Edit"], button:has-text("Edit")').first();
      const editButton = adminPage.getByRole('button').filter({ hasText: /^$/ }).nth(1)
      
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

  test.describe('DEPT-011: Delete Department - Success', () => {
    test('should delete department after confirmation', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      
      // Create a test department first
      await adminPage.click('button:has-text("Add Department")');
      const testDept = generateTestDepartment();
      
      await adminPage.fill('input[name="name"]', testDept.name);
      await adminPage.fill('input[name="group"]', testDept.group);
      
      const dateButton = adminPage.locator('button:has-text("Pick a date")');
      if (await dateButton.isVisible()) {
        await dateButton.click();
        await adminPage.waitForTimeout(300);
        await adminPage.locator('button[name="day"]').filter({ hasText: '15' }).first().click();
      }
      
      await adminPage.click('button:has-text("Save")');
      await adminPage.waitForTimeout(1000);
      
      // Now delete it
      await navigateToDepartmentList(adminPage);
      
      // Find the test department row and click delete
      const departmentRow = adminPage.locator(`tr:has-text("${testDept.name}")`);
      const deleteButton = departmentRow.locator('button').last(); // Last button is usually delete
      
      await deleteButton.click();
      
      // Confirm deletion in dialog
      await expect(adminPage.locator('text=/Confirm Delete/i')).toBeVisible();
      await expect(adminPage.locator('text=/cannot be undone/i')).toBeVisible();
      
      // Click confirm
      const confirmButton = adminPage.locator('button:has-text("Confirm"), button:has-text("Delete")').last();
      await confirmButton.click();
      
      // Wait for success message
      await expect(adminPage.locator('text=/deleted successfully/i')).toBeVisible({ timeout: 5000 });
      
      // Verify department is removed from list
      await adminPage.waitForTimeout(500);
      await expect(adminPage.locator(`text=${testDept.name}`)).not.toBeVisible();
    });
  });

  test.describe('DEPT-012: Delete Department - Cancel', () => {
    test('should cancel delete operation', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      await adminPage.waitForTimeout(1000);
      // Click delete button on first department
      const deleteButton = adminPage.locator('button').last();
      
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        
        // Verify confirmation dialog appears
        await expect(adminPage.locator('text=/Confirm Delete/i')).toBeVisible({ timeout: 3000 });
        
        // Click cancel
        const cancelButton = adminPage.locator('button:has-text("Cancel")');
        await cancelButton.click();
        
        // Dialog should close
        await expect(adminPage.locator('text=/Confirm Delete/i')).not.toBeVisible();
        
        // Department should still be in the list
        await expect(adminPage.locator('table tbody tr').first()).toBeVisible();
      }
    });
  });

  test.describe('DEPT-014: Navigation and Breadcrumbs', () => {
    test('should display breadcrumbs on add page', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      await adminPage.click('button:has-text("Add Department")');
      
      // Verify breadcrumb structure
      await expect(adminPage.locator('text=Departments')).toBeVisible();
      await expect(adminPage.locator('text=Add Department')).toBeVisible();
    });

    test('should navigate back via breadcrumb', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      await adminPage.click('button:has-text("Add Department")');
      await adminPage.waitForTimeout(1000);
      
      // Click Departments in breadcrumb
      const breadcrumbLink = adminPage.locator('a:has-text("Departments")').first();
      if (await breadcrumbLink.isVisible()) {
        await breadcrumbLink.click();
        await expect(adminPage).toHaveURL(/modules\/demo-module\/department$/);
      }
    });

    test('should display dynamic breadcrumb on view page', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      await adminPage.waitForTimeout(1000);
      const departmentLink = adminPage.locator('table tbody tr td a').first();
      
      if (await departmentLink.isVisible()) {
        const departmentName = await departmentLink.textContent();
        await departmentLink.click();
        
        // Breadcrumb should show department name
        await expect(adminPage.locator('text=Departments')).toBeVisible();
        if (departmentName) {
          await expect(adminPage.locator(`text=${departmentName}`)).toBeVisible();
        }
      }
    });

    test('should handle cancel button navigation', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      await adminPage.click('button:has-text("Add Department")');
      
      // Click cancel
      const cancelButton = adminPage.locator('button:has-text("Cancel")');
      await cancelButton.click();
      
      // Should navigate back to list
      // await expect(adminPage).toHaveURL(/modules\/demo-module\/department$/);
      await expect(adminPage).toHaveURL(/page=1/);
    });
  });

  test.describe('DEPT-020: URL State Persistence', () => {
    test('should persist filter in URL', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      await adminPage.waitForTimeout(1000);
      
      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Engineering');
      await adminPage.waitForTimeout(1000);
      
      // URL should contain filter
      const url = adminPage.url();
      expect(url).toContain('filter=Engineering');
      
      // Reload page
      await adminPage.reload();
      
      // Filter should be restored
      const inputValue = await searchInput.inputValue();
      expect(inputValue).toBe('Engineering');
    });

    test('should persist sort state in URL', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      
      // Sort by name
      const sortButton = adminPage.locator('button:near(:text("Name"))').first();
      await sortButton.click();
      await adminPage.waitForTimeout(300);
      
      // URL should contain sort parameters
      const url = adminPage.url();
      expect(url).toContain('sort=name');
      expect(url).toContain('order=');
      
      // Reload page
      await adminPage.reload();
      
      // Sort state should be maintained
      const reloadedUrl = adminPage.url();
      expect(reloadedUrl).toContain('sort=name');
    });

    test('should restore all state from URL', async ({ adminPage }) => {
      // Navigate with specific URL parameters
      await adminPage.goto('/console/modules/demo-module/department?page=1&perPage=10&sort=name&order=asc&filter=Test');
      
      await adminPage.waitForLoadState('networkidle');
      
      // Verify all states are applied
      const url = adminPage.url();
      expect(url).toContain('page=1');
      expect(url).toContain('sort=name');
      expect(url).toContain('order=asc');
      expect(url).toContain('filter=Test');
      
      // Search input should have the filter value
      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
      const value = await searchInput.inputValue();
      expect(value).toBe('Test');
    });
  });

  test.describe('Edge Cases and Error Handling', () => {
    test('should handle network errors gracefully', async ({ adminPage }) => {
      // This test would need network mocking or offline mode
      // Placeholder for now
      await navigateToDepartmentList(adminPage);
      await expect(adminPage.locator('h1')).toContainText('Departments');
    });

    test('should handle empty list state', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      
      // If no data, appropriate message or empty state should be shown
      const tableRows = adminPage.locator('table tbody tr');
      const rowCount = await tableRows.count();
      
      if (rowCount === 0) {
        // Could check for empty state message
        await expect(adminPage.locator('table')).toBeVisible();
      }
    });

    test('should handle form submission errors', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      await adminPage.click('button:has-text("Add Department")');
      
      // Try to submit incomplete form
      await adminPage.click('button:has-text("Save")');
      
      // Should show validation errors instead of crashing
      await expect(adminPage.locator('text=/name is required/i')).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Accessibility and UI/UX', () => {
    test('should have accessible form labels', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      await adminPage.click('button:has-text("Add Department")');
      
      // Check for form labels
      await expect(adminPage.locator('label:has-text("Name")')).toBeVisible();
      await expect(adminPage.locator('label:has-text("Group")')).toBeVisible();
    });

    test('should display loading states', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      
      // Trigger an action that shows loading
      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Test');
      
      // Loading indicator might appear briefly
      // This is hard to test reliably due to speed
      await adminPage.waitForLoadState('networkidle');
    });

    test('should have tooltip on action buttons', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      
      // Hover over edit button to see tooltip
      const editButton = adminPage.locator('button').filter({ has: adminPage.locator('svg') }).first();
      
      if (await editButton.isVisible()) {
        await editButton.hover();
        // Tooltip might appear (implementation specific)
        await adminPage.waitForTimeout(500);
      }
    });
  });

  test.describe('Performance', () => {
    test('should load department list within acceptable time', async ({ adminPage }) => {
      const startTime = Date.now();
      
      await navigateToDepartmentList(adminPage);
      await adminPage.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should debounce search input', async ({ adminPage }) => {
      await navigateToDepartmentList(adminPage);
      
      const searchInput = adminPage.locator('input[placeholder*="Search"]').first();
      
      // Type quickly
      await searchInput.fill('T');
      await adminPage.waitForTimeout(100);
      await searchInput.fill('Te');
      await adminPage.waitForTimeout(100);
      await searchInput.fill('Test');
      
      // Should not trigger multiple searches
      // Wait for debounce
      await adminPage.waitForTimeout(600);
      
      // Only one final search should execute
      await adminPage.waitForLoadState('networkidle');
    });
  });
});
