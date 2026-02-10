# Quick Start Guide - Building Apps with Saas Admin Multitenancy

**Version:** 1.0.0  
**Last Updated:** January 26, 2026

---

## 🚀 Quick Start

```bash
# Start development server
npm run dev
# Frontend: http://localhost:5000
# API Docs: http://localhost:5000/api-docs
```

---

## 📦 Creating a New Module

### Step 1: Generate Module Structure
```bash
npm run create-module
```
Follow the interactive prompts to create a complete module with:
- Client pages (List, Add, Edit, View)
- Server routes with Swagger docs
- Database schemas
- Menu configurations

### Step 2: Add Pages/Entities to Module
```bash
npm run add-page
```
Creates CRUD pages for new entities within existing modules.

### Step 3: Register Module (5 Locations)
```bash
npm run register-module
```
Automatically registers your module in:
1. Server routes (`src/server/main.ts`)
2. Client routes (`src/client/route.ts`)
3. Sidebar menu (`src/client/components/app-sidebar.tsx`)
4. Database schema exports
5. Database registry

### Step 4: Generate SQL Scripts
```bash
npm run generate-sql {module-id}
```
Creates SQL scripts for module tables in `modules/{module-id}/scripts/install.sql`

### Step 5: Register in Database
```bash
npm run db:register-module {module-id}
```
Inserts module metadata into `sys_module_registry` table.

---

## 🔐 Creating API Routes

### Pattern (MUST Follow)
```typescript
import { Router } from 'express';
import { resolveTenantContext, authenticated, authorized } from '@server/middleware/authMiddleware';

const router = Router();

// Middleware chain (ORDER MATTERS!)
router.use(resolveTenantContext());  // 1. Resolve tenant
router.use(authenticated());          // 2. Authenticate user

/**
 * @swagger
 * /api/modules/{module-id}/{entity}:
 *   get:
 *     summary: Get {entities}
 *     tags: [{Module Name}]
 */
router.get('/', authorized('ADMIN', '{module-id}.{entity}.view'), async (req, res) => {
  // Use req.tenantDb for tenant-specific data
  const data = await req.tenantDb.select().from(tenantSchema.entity);
  res.json({ data });
});
```

### Authorization Options
```typescript
// Single role
authorized('ADMIN')

// Single permission
authorized(null, 'module.entity.view')

// Multiple roles (OR logic)
authorized(['ADMIN', 'MANAGER'])

// Both roles and permissions
authorized('ADMIN', 'module.entity.view')
```

### Database Access
```typescript
// Tenant-specific data (users, roles, module data)
const data = await req.tenantDb.select().from(tenantSchema.entity);

// Shared data (tenant registry, module registry)
const tenants = await req.sharedDb.select().from(sharedSchema.tenant);
```

---

## 🎨 Creating Frontend Pages

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

### Data Fetching
```typescript
import axios from 'axios';

// Axios is pre-configured with tenant interceptors
const response = await axios.get('/api/modules/demo-module/department', {
  params: { page: 1, limit: 10, search: 'test' }
});
```

### Authorization Components
```tsx
import { Authorized } from '@client/components/auth/authorized';

<Authorized roles={['ADMIN']} permissions={['module.entity.view']}>
  <SensitiveComponent />
</Authorized>
```

---

## 🗄️ Database Operations

### Generate Migrations
```bash
npm run db:generate      # Generate migration files
npm run db:migrate       # Apply migrations to public schema
npm run db:push          # Push schema changes without migration files
npm run db:studio        # Open Drizzle Studio GUI
npm run db:seed          # Seed initial data
```

### ⚠️ Important Notes
- **Drizzle migrations only apply to `public` (shared) schema**
- **Tenant schemas are created programmatically** via `createTenantSchema()`
- **Module tables need manual SQL scripts** via `npm run generate-sql`

### Creating Tenant Schemas
```typescript
import { createTenantSchema } from '@server/lib/db/tenant-connection-manager';

// Creates tenant_{code} schema with all required tables
await createTenantSchema('acme');
```

---

## 🧪 Testing

### Run E2E Tests
```bash
npm run test:e2e           # Run all tests headless
npm run test:e2e:ui        # Interactive UI mode
npm run test:e2e:headed    # See browser while testing
npm run test:e2e:debug     # Debug mode with inspector
npm run test:e2e:report    # View HTML report
```

### Writing Tests
```typescript
import { test, expect } from '../fixtures/auth';

test('should access protected page', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/console/dashboard');
  await expect(authenticatedPage).toHaveURL(/.*dashboard/);
});
```

---

## 📁 Module Structure

```
src/modules/{module-id}/
├── module.json              # Metadata: permissions, routes, dependencies
├── client/
│   ├── pages/              # React components (List, Add, Edit, View)
│   ├── routes/             # React Router config
│   └── menus/              # Sidebar menu config
├── server/
│   ├── routes/             # Express routes with Swagger JSDoc
│   └── lib/db/schemas/     # Drizzle ORM schemas
└── scripts/
    └── install.sql         # SQL script for module table creation
```

---

## 🔑 Key Concepts

### Multi-Tenancy
- **Schema-per-tenant**: Each tenant has isolated database schema (`tenant_{code}`)
- **Tenant resolution**: `X-Tenant-Code` header > JWT token > subdomain
- **Connection pooling**: Managed by `TenantConnectionManager`

### Permission Naming
Format: `{module-id}.{entity}.{action}`
- `demo-module.department.view`
- `demo-module.department.create`
- `demo-module.department.edit`
- `demo-module.department.delete`

### SYSADMIN Role
Users with `SYSADMIN` role automatically pass all `authorized()` checks.

---

## ⚠️ Common Pitfalls

### ❌ Wrong
```typescript
// Forgetting tenant context
router.use(authenticated());

// Using wrong database instance
const users = await req.sharedDb.select().from(tenantSchema.user);
```

### ✅ Correct
```typescript
// Always resolve tenant first
router.use(resolveTenantContext());
router.use(authenticated());

// Use correct database instance
const users = await req.tenantDb.select().from(tenantSchema.user);
```

---

## 📝 Code Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `department-routes.ts` |
| Components | PascalCase | `DepartmentList.tsx` |
| Functions | camelCase | `getDepartments` |
| Constants | UPPER_SNAKE_CASE | `MAX_CONNECTIONS` |
| Database Tables | snake_case | `sys_user` |
| API Routes | kebab-case | `/api/modules/demo-module/department` |

### Import Path Aliases
```typescript
// Use these instead of relative paths
import { Component } from '@client/components/...';
import { middleware } from '@server/middleware/...';
import { schema } from '@modules/demo-module/...';
```

---

## 🎯 Development Workflow

### Adding New Feature
```bash
# 1. Create module (if needed)
npm run create-module

# 2. Add pages/entities
npm run add-page

# 3. Register module
npm run register-module

# 4. Generate SQL scripts
npm run generate-sql {module-id}

# 5. Register in database
npm run db:register-module {module-id}
```

### Testing Multi-Tenancy
```bash
# Create test tenant via API or seed script
# Switch tenant context:
# - Set X-Tenant-Code header
# - Or use subdomain: tenant.localhost:5000
# - Or switch via UI: User menu → Switch Tenant
```

---

## 📚 Key Files Reference

| File | Purpose |
|------|---------|
| `src/server/main.ts` | Express server config & route registration |
| `src/server/middleware/authMiddleware.ts` | Auth & authorization middleware |
| `src/server/lib/db/tenant-connection-manager.ts` | DB connection pooling |
| `src/client/route.ts` | React Router configuration |
| `src/modules/moduleHelpers.ts` | Module registration utilities |
| `drizzle.config.ts` | Drizzle ORM configuration |

---

## 🛠️ Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/react_admin_multitenancy
ACCESS_TOKEN_SECRET=your_access_token_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret
BASE_URL=http://localhost:5000
NODE_ENV=development
TENANT_SCHEMA_PREFIX=tenant_
SHARED_SCHEMA=public
MAX_CONNECTIONS=10
```

---

## 📖 Additional Resources

- Module development: `docs/modules/MODULE_REGISTRATION.md`
- Component usage: `docs/components/*.md`
- Testing guide: `tests/README.md`
- Script usage: `scripts/README.md`

---

## 💡 Tips

1. **Always** use `resolveTenantContext()` before `authenticated()` in module routes
2. **Always** use `req.tenantDb` for tenant-specific data
3. **Always** use `req.sharedDb` for shared data
4. **Never** forget to register modules in all 5 locations
5. **Always** follow permission naming convention
6. **Remember** Drizzle migrations only apply to `public` schema
7. **Use** automated scripts instead of manual file creation
8. **Add** `data-testid` attributes for stable E2E test selectors

---

## 🎓 Summary

This platform provides a **schema-per-tenant multi-tenant SaaS foundation** with:
- Complete data isolation per tenant
- Modular, hot-pluggable architecture
- Enterprise-grade authentication & authorization
- Automated module generation tools
- Comprehensive testing support

**Core Pattern:** `resolveTenantContext()` → `authenticated()` → `authorized()` → handler

**Database Access:** `req.tenantDb` (tenant data) vs `req.sharedDb` (shared data)

**Module Development:** Use CLI scripts, follow 5-step registration, generate SQL manually

Happy coding! 🚀
