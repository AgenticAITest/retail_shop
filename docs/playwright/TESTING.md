# Testing Guide

## Quick Start

### 1. Setup Test Environment

Make sure your development server is running and database is seeded:

```bash
# Start the dev server (in one terminal)
npm run dev

# Ensure database is migrated and seeded (in another terminal)
npm run db:migrate
npm run db:seed
```

### 2. Configure Test Credentials

Update `.env.test` with your test user credentials (should match your seed data):

```env
TEST_ADMIN_USERNAME=admin
TEST_ADMIN_PASSWORD=admin123
TEST_TENANT_CODE=system
```

### 3. Run Your First Test

```bash
# Run all tests
npm run test:e2e

# Or run in UI mode (recommended for first time)
npm run test:e2e:ui
```

## Test Organization

### Authentication Tests (`tests/e2e/auth.spec.ts`)
- Login/logout flows
- Session management
- Multi-tenant context handling

### Dashboard Tests (`tests/e2e/dashboard.spec.ts`)
- Dashboard access
- Navigation
- Sidebar menu

### Module Tests (`tests/e2e/modules/`)
- CRUD operations for each module
- Form validation
- Search and pagination

### System Tests (`tests/e2e/system/`)
- User management
- Role management
- Permission assignments

### Accessibility Tests (`tests/e2e/accessibility.spec.ts`)
- ARIA labels
- Keyboard navigation
- Form labels

### Responsive Tests (`tests/e2e/responsive.spec.ts`)
- Mobile viewports
- Desktop viewports
- Responsive tables and forms

## Writing New Tests

### For New Modules

When you create a new module, add corresponding tests:

```bash
# Create test file
touch tests/e2e/modules/your-module.spec.ts
```

Example test structure:

```typescript
import { test, expect } from '../../fixtures/auth';

test.describe('Your Module', () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto('/console/modules/your-module');
  });

  test('should display list page', async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/.*your-module/);
  });

  test('should create new item', async ({ adminPage }) => {
    await adminPage.click('text=/add|create/i');
    await adminPage.fill('input[name="name"]', `Test ${Date.now()}`);
    await adminPage.click('button[type="submit"]');
    await expect(adminPage.locator('text=/success/i')).toBeVisible();
  });
});
```

## Common Test Patterns

### Testing Multi-Tenant Features

```typescript
test('should work with specific tenant', async ({ page }) => {
  await page.setExtraHTTPHeaders({
    'X-Tenant-Code': 'your-tenant-code'
  });
  
  // Login and test
  await page.goto('/auth/login');
  // ... rest of test
});
```

### Testing Forms with Validation

```typescript
test('should validate required fields', async ({ adminPage }) => {
  await adminPage.goto('/console/system/user/add');
  
  // Submit without filling
  await adminPage.click('button[type="submit"]');
  
  // Should show validation errors
  await expect(adminPage.locator('text=/required/i')).toBeVisible();
});
```

### Testing Tables and Lists

```typescript
test('should display and search data', async ({ adminPage }) => {
  await adminPage.goto('/console/system/user');
  
  // Check table exists
  const table = adminPage.locator('table');
  await expect(table).toBeVisible();
  
  // Search
  await adminPage.fill('input[type="search"]', 'admin');
  await adminPage.waitForTimeout(1000); // Wait for debounce
  
  // Verify results
  await expect(table.locator('tbody tr')).toHaveCount(1);
});
```

### Testing Modals/Dialogs

```typescript
test('should open and close modal', async ({ adminPage }) => {
  await adminPage.click('button:has-text("Delete")');
  
  // Modal should appear
  const modal = adminPage.locator('[role="dialog"]');
  await expect(modal).toBeVisible();
  
  // Confirm action
  await modal.locator('button:has-text("Confirm")').click();
  
  // Modal should close
  await expect(modal).toBeHidden();
});
```

## Debugging Tests

### Visual Debugging

```bash
# Run with browser visible
npm run test:e2e:headed

# Run in debug mode (step through)
npm run test:e2e:debug
```

### Using Playwright Inspector

```typescript
test('debug this test', async ({ page }) => {
  await page.pause(); // Pauses execution, opens inspector
  // ... rest of test
});
```

### Screenshots and Traces

Failed tests automatically capture:
- Screenshots: `test-results/*/test-failed-*.png`
- Videos: `test-results/*/video.webm`
- Traces: View with `npx playwright show-trace test-results/trace.zip`

## CI/CD Integration

Tests run automatically in GitHub Actions on:
- Push to `main` or `develop` branches
- Pull requests

View results in the Actions tab of your repository.

## Best Practices

### 1. Use Stable Selectors

```typescript
// Good - using data-testid
await page.click('[data-testid="submit-button"]');

// Good - using specific attributes
await page.click('button[type="submit"]');

// Avoid - fragile text selectors
await page.click('text=Submit'); // Breaks if text changes
```

### 2. Wait for State Changes

```typescript
// Wait for navigation
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard');

// Wait for element state
await expect(page.locator('.loading')).toBeHidden();
await expect(page.locator('.data-loaded')).toBeVisible();
```

### 3. Clean Test Data

```typescript
// Use timestamps for unique data
const timestamp = Date.now();
await page.fill('input[name="name"]', `Test User ${timestamp}`);

// Or use test-specific prefixes
await page.fill('input[name="name"]', `TEST_${Date.now()}`);
```

### 4. Isolate Tests

Each test should be independent:
- Don't rely on data from previous tests
- Clean up after yourself (or use unique identifiers)
- Use `test.beforeEach()` for common setup

### 5. Handle Async Operations

```typescript
// Wait for API calls to complete
await page.waitForLoadState('networkidle');

// Wait for specific elements
await page.waitForSelector('.data-loaded');

// Use expect with timeout
await expect(page.locator('.result')).toBeVisible({ timeout: 5000 });
```

## Troubleshooting

### Tests Timing Out

**Problem**: Tests fail with timeout errors

**Solutions**:
- Increase timeout in `playwright.config.ts`
- Add explicit waits: `await page.waitForLoadState('networkidle')`
- Check if dev server is running
- Verify database is seeded

### Authentication Failures

**Problem**: Tests can't log in

**Solutions**:
- Verify credentials in `.env.test` match seed data
- Check tenant code is correct
- Ensure database is seeded: `npm run db:seed`
- Check if user exists in correct tenant schema

### Flaky Tests

**Problem**: Tests pass sometimes, fail other times

**Solutions**:
- Add explicit waits instead of `waitForTimeout()`
- Use `toBeVisible()` instead of checking existence
- Wait for network idle: `await page.waitForLoadState('networkidle')`
- Increase action timeout for slow operations

### Element Not Found

**Problem**: Selector doesn't find element

**Solutions**:
- Use Playwright Inspector: `npm run test:e2e:debug`
- Check if element is in iframe
- Wait for element: `await page.waitForSelector('.element')`
- Verify selector is correct (use browser DevTools)

## Performance Tips

### Run Tests in Parallel

```bash
# Run with specific number of workers
npx playwright test --workers=4
```

### Run Specific Tests

```bash
# Run single file
npx playwright test auth.spec.ts

# Run tests matching pattern
npx playwright test --grep "login"

# Run specific project (browser)
npx playwright test --project=chromium
```

### Skip Slow Tests in Development

```typescript
test.skip('slow test', async ({ page }) => {
  // This test will be skipped
});

test.only('focus on this test', async ({ page }) => {
  // Only this test will run
});
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Test Fixtures](tests/fixtures/auth.ts)
- [Example Tests](tests/e2e/)
- [Configuration](playwright.config.ts)
