import { defineConfig } from '@playwright/test';

/**
 * Playwright Configuration for React Admin Multitenancy
 * 
 * This configuration is optimized for testing multi-tenant applications
 * with schema-per-tenant architecture.
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  // Maximum time one test can run for
  timeout: 30 * 1000,
  
  // Test execution settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  
  // Reporter configuration
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  
  // Shared settings for all projects
  use: {
    // Base URL for your application
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5000',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video on failure
    video: 'retain-on-failure',
    
    // Timeout for each action (click, fill, etc.)
    actionTimeout: 10 * 1000,
    
    // Navigation timeout
    navigationTimeout: 30 * 1000,
  },

  // Role-based test projects
  projects: [
    // Saves auth states for all roles (runs first, required by all other projects)
    {
      name: 'setup',
      testMatch: '**/global-setup.ts',
    },

    // All existing SYSADMIN tests (system admin, module management, etc.)
    {
      name: 'sysadmin',
      testDir: './tests/e2e',
      testIgnore: [
        '**/admin/**',
        '**/manager/**',
        '**/cashier/**',
        '**/rbac/**',
        '**/global-setup.ts',
        '**/pos/pos.spec.ts',
        '**/pos/pos-shift.spec.ts',
        '**/pos/pos-checkout.spec.ts',
        '**/pos/pos-offline-sync.spec.ts',
      ],
      dependencies: ['setup'],
    },

    // POS shift-sensitive tests isolated in their own project (fullyParallel:false
    // keeps tests within each file serial, workers=4 lets files run in parallel)
    {
      name: 'pos',
      testDir: './tests/e2e/modules/pos',
      testMatch: ['**/pos.spec.ts', '**/pos-shift.spec.ts', '**/pos-checkout.spec.ts', '**/pos-offline-sync.spec.ts'],
      fullyParallel: false,
      dependencies: ['setup'],
    },

    // Tenant-admin tests — Phase 2+ (uses pre-saved auth state)
    {
      name: 'admin',
      testDir: './tests/e2e/admin',
      use: { storageState: 'tests/auth-states/admin.json' },
      dependencies: ['setup'],
    },

    // Manager tests — Phase 4+ (uses pre-saved auth state)
    {
      name: 'manager',
      testDir: './tests/e2e/manager',
      use: { storageState: 'tests/auth-states/manager.json' },
      dependencies: ['setup'],
    },

    // Cashier tests — Phase 4+ (uses pre-saved auth state)
    {
      name: 'cashier',
      testDir: './tests/e2e/cashier',
      use: { storageState: 'tests/auth-states/cashier.json' },
      dependencies: ['setup'],
    },

    // RBAC boundary tests — verify roles cannot cross their access boundaries
    {
      name: 'rbac',
      testDir: './tests/e2e/rbac',
      dependencies: ['setup'],
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
