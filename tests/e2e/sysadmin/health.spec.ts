import { test, expect } from '../../fixtures/auth';

/**
 * SA Health tests: SA-026
 */

// ============================================================
// SA-026 — Health check endpoint
// ============================================================

test('SA-026: Health check endpoint returns correct status', async ({ request }) => {
  // Health check is public — no auth needed. Use request fixture (uses baseURL) not page.evaluate.
  const response = await request.get('/api/health');

  // 200 = all services healthy; 503 = degraded but endpoint is responding
  expect([200, 503]).toContain(response.status());
  const data = await response.json();
  expect(data).toHaveProperty('status');
  expect(['healthy', 'degraded']).toContain(data.status);
});
