# Playwright E2E Testing

This directory contains end-to-end tests for the React Admin Multitenancy application using Playwright.

## Structure

```
tests/
├── e2e/                          # End-to-end test files
│   ├── auth.spec.ts             # Authentication tests
│   ├── dashboard.spec.ts        # Dashboard tests
│   ├── accessibility.spec.ts    # Accessibility tests
│   ├── responsive.spec.ts       # Responsive design tests
│   ├── modules/                 # Module-specific tests
│   │   └── demo-module.spec.ts
│   └── system/                  # System management tests
│       ├── users.spec.ts
│       └── roles.spec.ts
├── fixtures/                     # Test fixtures and helpers
│   └── auth.ts                  # Authentication fixtures
└── README.md                    # This file
```

## Running Tests

### Run all tests
```bash
npm run test:e2e
```

### Run tests in UI mode (interactive)
```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:e2e:headed
```

### Run specific test file
```bash
npx playwright test tests/e2e/auth.spec.ts
```

### Run tests for specific browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Debug tests
```bash
npm run test:e2e:debug
```

## Environment Variables

Create a `.env.test` file for test-specific configuration:

```env
# Test user credentials
TEST_ADMIN_USERNAME=admin
TEST_ADMIN_PASSWORD=admin123
TEST_USER_USERNAME=testuser
TEST_USER_PASSWORD=user123

# Test tenant
TEST_TENANT_CODE=system

# Application URL
PLAYWRIGHT_BASE_URL=http://localhost:5000
```

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/some-page');
    await expect(page.locator('h1')).toContainText('Expected Text');
  });
});
```

### Using Authentication Fixtures

```typescript
import { test, expect } from '../fixtures/auth';

test.describe('Protected Feature', () => {
  test('should access as authenticated user', async ({ authenticatedPage }) => {
    // authenticatedPage is already logged in
    await authenticatedPage.goto('/console/dashboard');
    await expect(authenticatedPage).toHaveURL(/.*dashboard/);
  });

  test('should access as admin', async ({ adminPage }) => {
    // adminPage is logged in as admin
    await adminPage.goto('/console/system/user');
    await expect(adminPage).toHaveURL(/.*system\/user/);
  });
});
```

### Multi-Tenant Testing

```typescript
test('should work with specific tenant', async ({ page }) => {
  // Set tenant context via header
  await page.setExtraHTTPHeaders({
    'X-Tenant-Code': 'acme'
  });
  
  await page.goto('/auth/login');
  // ... rest of test
});
```

## Best Practices

### 1. Use Data Test IDs
Add `data-testid` attributes to important elements:
```tsx
<button data-testid="submit-button">Submit</button>
```

Then in tests:
```typescript
await page.click('[data-testid="submit-button"]');
```

### 2. Wait for Navigation
Always wait for navigation after actions:
```typescript
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard');
```

### 3. Use Specific Selectors
Prefer specific selectors over generic ones:
```typescript
// Good
await page.click('button[type="submit"]');

// Avoid
await page.click('button');
```

### 4. Handle Dynamic Content
Use proper waiting strategies:
```typescript
// Wait for element to be visible
await expect(page.locator('.loading')).toBeHidden();

// Wait for specific state
await page.waitForSelector('.data-loaded');
```

### 5. Clean Up Test Data
Use unique identifiers for test data:
```typescript
const timestamp = Date.now();
await page.fill('input[name="name"]', `Test Item ${timestamp}`);
```

## Test Reports

After running tests, view the HTML report:
```bash
npx playwright show-report
```

Reports are generated in:
- `playwright-report/` - HTML report
- `test-results/` - JSON results and artifacts

## Debugging

### Visual Debugging
```bash
npx playwright test --debug
```

### Trace Viewer
```bash
npx playwright show-trace test-results/trace.zip
```

### Screenshots and Videos
Failed tests automatically capture:
- Screenshots: `test-results/*/test-failed-*.png`
- Videos: `test-results/*/video.webm`

## CI/CD Integration

The tests are configured to run in CI environments. In CI:
- Tests run in headless mode
- Retries are enabled (2 retries)
- Workers are limited to 1 for stability
- Full traces are captured on failure

## Module-Specific Tests

When creating new modules, add corresponding test files:

```
tests/e2e/modules/
└── your-module/
    ├── entity-list.spec.ts
    ├── entity-crud.spec.ts
    └── entity-permissions.spec.ts
```

## Common Patterns

### Testing Forms
```typescript
test('should submit form', async ({ page }) => {
  await page.fill('input[name="field"]', 'value');
  await page.click('button[type="submit"]');
  await expect(page.locator('.success-message')).toBeVisible();
});
```

### Testing Tables
```typescript
test('should display data in table', async ({ page }) => {
  const table = page.locator('table');
  await expect(table).toBeVisible();
  
  const rows = table.locator('tbody tr');
  await expect(rows).toHaveCount(10); // or .toHaveCountGreaterThan(0)
});
```

### Testing Modals
```typescript
test('should open and close modal', async ({ page }) => {
  await page.click('button:has-text("Open Modal")');
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  
  await page.click('[role="dialog"] button:has-text("Close")');
  await expect(page.locator('[role="dialog"]')).toBeHidden();
});
```

## Troubleshooting

### Tests Timing Out
- Increase timeout in `playwright.config.ts`
- Check if dev server is running
- Verify network conditions

### Flaky Tests
- Add explicit waits: `await page.waitForLoadState('networkidle')`
- Use `toBeVisible()` instead of checking existence
- Increase action timeout for slow operations

### Authentication Issues
- Verify test credentials in `.env.test`
- Check if seed data is loaded
- Ensure tenant context is set correctly

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
