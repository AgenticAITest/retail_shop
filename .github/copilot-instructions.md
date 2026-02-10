# React Admin Multitenancy - AI Coding Agent Instructions

## Architecture Overview

This is a **schema-per-tenant multi-tenant SaaS platform** built with React 19, TypeScript, Express 5, and PostgreSQL. Each tenant has a completely isolated database schema (e.g., `tenant_acme`, `tenant_xyz`) with shared metadata in the `public` schema.

### Critical Architectural Concepts

**Multi-Tenant Database Architecture:**
- **Shared schema (`public`)**: Contains `sys_tenant`, `sys_module_registry`, `sys_module_auth` tables
- **Tenant schemas (`tenant_{code}`)**: Each tenant has isolated `sys_user`, `sys_role`, `sys_permission`, and module-specific tables
- **Connection pooling**: `TenantConnectionManager` (in `src/server/lib/db/tenant-connection-manager.ts`) manages per-tenant database connections with automatic `search_path` configuration
- **Tenant resolution**: Middleware extracts tenant from subdomain, `X-Tenant-Code` header, or JWT token (priority: header > token > subdomain)

**Request Flow Pattern:**
```typescript
// Every protected API route MUST use this middleware chain:
router.use(resolveTenantContext());  // Attaches req.tenantDb, req.sharedDb, req.tenantCode
router.use(authenticated());          // Validates JWT, attaches req.user
router.get('/', authorized('ROLE', 'permission.code'), handler);
```

**Database Access Pattern:**
```typescript
// Tenant-specific data (users, roles, module data)
const data = await req.tenantDb.select().from(tenantSchema.user);

// Shared data (tenant registry, module registry)
const tenants = await req.sharedDb.select().from(sharedSchema.tenant);
```

## Module System

### Module Structure
Modules are self-contained features in `src/modules/{module-id}/`:
```
src/modules/demo-module/
├── module.json              # Metadata: permissions, routes, dependencies
├── client/
│   ├── pages/              # React components (List, Add, Edit, View)
│   ├── routes/             # React Router config (exported as function)
│   └── menus/              # Sidebar menu config
├── server/
│   ├── routes/             # Express routes with Swagger JSDoc
│   └── lib/db/schemas/     # Drizzle ORM schemas
└── docs/
```

### Module Registration (5-Step Process)
When creating/modifying modules, you MUST register them in these locations:

1. **Server routes** (`src/server/main.ts`):
   ```typescript
   import moduleRoutes from '../modules/demo-module/server/routes/departmentRoutes';
   app.use('/api/modules/demo-module/department', moduleRoutes);
   ```

2. **Client routes** (`src/client/route.ts`):
   ```typescript
   import { demoModuleReactRoutes } from '../modules/demo-module/client/routes/demoModuleReactRoutes';
   // Add to console children: demoModuleReactRoutes("modules/demo-module")
   ```

3. **Sidebar menu** (`src/client/components/app-sidebar.tsx`):
   ```typescript
   import { demoModuleSidebarMenus } from '../../modules/demo-module/client/menus/sideBarMenus';
   // Add to navMain array
   ```

4. **Database schema** (if using central export - optional):
   ```typescript
   // src/server/lib/db/schema/index.ts
   export * from '@modules/demo-module/server/lib/db/schemas/department';
   ```

5. **Database registry**: Run `npm run db:register-module {module-id}` to insert into `sys_module_registry`

### Automated Module Generation
**Use these scripts instead of manual file creation:**
- `npm run create-module` - Interactive CLI to generate complete module structure
- `npm run add-page` - Add new entity/page to existing module
- `npm run register-module` - Auto-register module in all 5 locations
- `npm run generate-sql` - Generate deployment SQL scripts for module tables

## Development Workflows

### Starting Development
```bash
npm run dev              # Starts Express server on :5000 with Vite HMR
# Frontend: http://localhost:5000
# API Docs: http://localhost:5000/api-docs
```

### Database Operations
```bash
npm run db:generate      # Generate Drizzle migrations from schema changes
npm run db:migrate       # Apply migrations to public schema
npm run db:push          # Push schema changes without migration files
npm run db:studio        # Open Drizzle Studio GUI
npm run db:seed          # Seed initial data (creates 'system' tenant)
```

**Important**: Drizzle migrations only apply to the `public` (shared) schema. Tenant schemas are created programmatically via `createTenantSchema()` in `tenant-connection-manager.ts`.

### Adding New Features to Modules
1. **Generate page**: `npm run add-page` (creates List, Add pages + API routes + schema)
2. **Update schema**: Modify `server/lib/db/schemas/*.ts`
3. **Generate SQL**: `npm run generate-sql {module-id}` (creates `modules/{module-id}/scripts/install.sql`)
4. **Apply to tenants**: Manually run SQL scripts against each tenant schema

## Code Conventions

### Authentication & Authorization
**SYSADMIN role bypass**: Users with `SYSADMIN` role automatically pass all `authorized()` checks (see `authMiddleware.ts`).

**Permission naming**: `{module-id}.{entity}.{action}` (e.g., `demo-module.department.view`)

**Role-based components** (frontend):
```tsx
import { Authorized } from '@client/components/auth/authorized';
<Authorized roles={['ADMIN']} permissions={['module.entity.view']}>
  <SensitiveComponent />
</Authorized>
```

### API Route Pattern
```typescript
/**
 * @swagger
 * /api/modules/demo-module/department:
 *   get:
 *     summary: Get departments
 *     tags: [Demo Module]
 */
router.get('/', authorized('ADMIN', 'demo-module.department.view'), async (req, res) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  
  const data = await req.tenantDb
    .select()
    .from(tenantSchema.department)
    .where(ilike(tenantSchema.department.name, `%${search}%`))
    .limit(Number(limit))
    .offset(offset);
  
  res.json({ data, total, page, limit });
});
```

### Frontend Data Fetching
```typescript
import axios from 'axios';

// Axios is pre-configured with tenant interceptors (see src/client/lib/axios.ts)
const response = await axios.get('/api/modules/demo-module/department', {
  params: { page: 1, limit: 10, search: 'test' }
});
```

### Form Validation Pattern
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().regex(/^[A-Z_]+$/, 'Use uppercase and underscores')
});

const form = useForm({ resolver: zodResolver(schema) });
```

## Key Files Reference

- **Tenant middleware**: `src/server/middleware/authMiddleware.ts` - All auth/tenant logic
- **Connection manager**: `src/server/lib/db/tenant-connection-manager.ts` - Database pooling
- **Shared schema**: `src/server/lib/db/schema/sharedSchema.ts` - Public schema tables
- **Tenant schema**: `src/server/lib/db/schema/tenantSchema.ts` - Per-tenant tables
- **Module helpers**: `src/modules/moduleHelpers.ts` - Module loading utilities
- **Route config**: `src/client/route.ts` - React Router setup
- **Drizzle config**: `drizzle.config.ts` - Only manages public schema migrations

## Common Pitfalls

1. **Forgetting tenant context**: Always use `resolveTenantContext()` before `authenticated()` in module routes
2. **Wrong database instance**: Use `req.tenantDb` for user/module data, `req.sharedDb` for tenant registry
3. **Missing module registration**: New modules won't appear until registered in all 5 locations (use `npm run register-module`)
4. **Schema migrations**: Drizzle only migrates `public` schema; tenant schemas need manual SQL scripts
5. **Permission codes**: Must match format in `module.json` permissions array
6. **Import paths**: Use `@client`, `@server`, `@modules` aliases (configured in `tsconfig.json`)

## Testing Multi-Tenancy

**Create test tenant**:
```bash
# Via API (POST /api/auth/register-tenant) or seed script
# This creates tenant_testco schema with all tables
```

**Switch tenant context**:
- Set `X-Tenant-Code: testco` header in API requests
- Or use subdomain: `testco.localhost:5000`
- Or switch via UI: User menu → Switch Tenant

## Testing with Playwright

**E2E Test Structure**:
```
tests/
├── e2e/                    # Test files organized by feature
│   ├── auth.spec.ts       # Authentication flows
│   ├── dashboard.spec.ts  # Dashboard functionality
│   ├── modules/           # Module-specific tests
│   └── system/            # System management tests
└── fixtures/
    └── auth.ts            # Authentication helpers & fixtures
```

**Running Tests**:
```bash
npm run test:e2e           # Run all tests headless
npm run test:e2e:ui        # Interactive UI mode
npm run test:e2e:headed    # See browser while testing
npm run test:e2e:debug     # Debug mode with inspector
npm run test:e2e:report    # View HTML report
```

**Writing Tests**:
```typescript
// Use auth fixtures for authenticated tests
import { test, expect } from '../fixtures/auth';

test('should access protected page', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/console/dashboard');
  await expect(authenticatedPage).toHaveURL(/.*dashboard/);
});

// Multi-tenant testing
test('should work with tenant context', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'X-Tenant-Code': 'acme' });
  // ... rest of test
});
```

**Best Practices**:
- Use `data-testid` attributes for stable selectors
- Always wait for navigation: `await page.waitForURL('**/path')`
- Use unique identifiers for test data: `Test Item ${Date.now()}`
- Tests auto-capture screenshots/videos on failure

## Documentation Resources

- Module development: `docs/modules/MODULE_REGISTRATION.md`
- Component usage: `docs/components/*.md`
- Migration guide: `docs/tenant_per_schema/README.md`
- Script usage: `scripts/README.md`
- Testing guide: `tests/README.md`
