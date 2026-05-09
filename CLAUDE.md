# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mandatory Pre-Coding Step

**Before writing any code**, read `base-multi-tenant/docs/DEVELOPMENT_GUIDE.md`. This is a hard rule, not optional.

## Repository Layout

All application code lives in `base-multi-tenant/`. The root also contains `PRD.md`, `implementation-plan.md`, and planning docs. Run all commands from inside `base-multi-tenant/`.

## Commands

```bash
# Development
npm run dev              # Express + Vite on http://localhost:5000 (API docs at /api-docs)

# Database
npm run db:generate      # Generate Drizzle migration files from schema changes
npm run db:migrate       # Apply migrations (public schema only)
npm run db:push          # Push schema without migration files
npm run db:seed          # Seed initial data (creates 'system' tenant)
npm run db:studio        # Open Drizzle Studio GUI

# Module generation (prefer these over manual file creation)
npm run create-module              # Interactive CLI: generates full module structure
npm run add-page                   # Add entity/CRUD pages to existing module
npm run register-module            # Auto-register module in all 5 locations
npm run generate-sql {module-id}   # Generate SQL scripts for module tables
npm run db:register-module {module-id}  # Insert module into sys_module_registry

# E2E Testing
npm run test:e2e           # Headless, all tests
npm run test:e2e:ui        # Interactive Playwright UI
npm run test:e2e:headed    # Visible browser
npm run test:e2e:debug     # Inspector mode
npm run test:e2e:report    # HTML report
```

To run a single test file: `npx playwright test tests/e2e/path/to/spec.ts`

## Architecture

### Multi-Tenancy: Schema-Per-Tenant

- **`public` schema**: shared tables — `sys_tenant`, `sys_module_registry`, `sys_module_auth`
- **`tenant_{code}` schema**: per-tenant isolated tables — `sys_user`, `sys_role`, `sys_permission`, all module tables
- Drizzle migrations **only apply to `public`**. Tenant schemas are created programmatically via `createTenantSchema()`. Module tables require manual SQL scripts (`npm run generate-sql`).
- Tenant is resolved from: `X-Tenant-Code` header > JWT token > subdomain (header wins)

### Request Middleware Chain (order is critical)

```typescript
router.use(resolveTenantContext());  // Attaches req.tenantDb, req.sharedDb, req.tenantCode
router.use(authenticated());          // Validates JWT, attaches req.user
router.get('/', authorized('ADMIN', 'module.entity.view'), handler);
```

Never call `authenticated()` before `resolveTenantContext()`. `SYSADMIN` role bypasses all `authorized()` checks automatically.

### Database Access

```typescript
req.tenantDb   // for all module/user/role data in the current tenant
req.sharedDb   // for tenant registry and module registry only
```

### Module System

Modules live in `src/modules/{module-id}/` and are self-contained:

```
src/modules/{module-id}/
├── module.json          # permissions, routes, dependencies metadata
├── client/
│   ├── pages/           # React components (List, Add, Edit, View)
│   ├── routes/          # React Router config (exported as function)
│   └── menus/           # Sidebar menu config
├── server/
│   ├── routes/          # Express routes with Swagger JSDoc
│   └── lib/db/schemas/  # Drizzle ORM schemas
└── scripts/
    └── install.sql      # SQL for module table creation in tenant schemas
```

New modules must be registered in 5 locations (use `npm run register-module` to automate):
1. `src/server/main.ts` — server route mount
2. `src/client/route.ts` — React Router config
3. `src/client/components/app-sidebar.tsx` — sidebar menu
4. `src/server/lib/db/schema/index.ts` — schema exports (optional)
5. `sys_module_registry` table — via `npm run db:register-module`

### Layouts

- `/auth/*` → `AuthLayout` (login, register, password reset)
- `/console/*` → `ConsoleLayout` (admin with sidebar)
- `/pos` → `PosLayout` (full-screen POS terminal, no sidebar)

### Key Framework Files (do not modify)

| File | Purpose |
|------|---------|
| `src/server/main.ts` | Express server config & route registration |
| `src/server/middleware/authMiddleware.ts` | All auth/tenant middleware |
| `src/server/lib/db/tenant-connection-manager.ts` | DB connection pooling |
| `src/client/route.ts` | React Router configuration |
| `src/modules/moduleHelpers.ts` | Module registration utilities |
| `src/server/lib/db/schema/sharedSchema.ts` | Public schema table definitions |
| `src/server/lib/db/schema/tenantSchema.ts` | Per-tenant table definitions |

## Code Conventions

| Target | Convention |
|--------|-----------|
| Files | `kebab-case.ts` |
| React components | `PascalCase.tsx` |
| Functions | `camelCase` |
| Constants | `UPPER_SNAKE_CASE` |
| DB tables | `snake_case` |
| API routes | `/api/modules/{module-id}/{entity}` |
| Permissions | `{module-id}.{entity}.{action}` |

**Import path aliases** (use these, not relative paths):
- `@client/*` → `src/client/*`
- `@server/*` → `src/server/*`
- `@modules/*` → `src/modules/*`

## Frontend Patterns

**Data fetching**: Use `axios` (pre-configured with tenant interceptors in `src/client/lib/axios.ts`), wrapped in TanStack React Query hooks.

**Forms**: React Hook Form + Zod resolver. If the frontend sends invalid data to the server, fix the frontend payload — do not loosen server-side Zod validation.

**Authorization gating**:
```tsx
import { Authorized } from '@client/components/auth/authorized';
<Authorized roles={['ADMIN']} permissions={['module.entity.view']}>
  <SensitiveComponent />
</Authorized>
```

**UI components**: shadcn/ui (new-york style) + Tailwind CSS 4 + Recharts for charts.

## Testing

Tests use Playwright E2E with custom auth fixtures. Import from `../fixtures/auth` (not `@playwright/test`) to get `authenticatedPage`.

Add `data-testid` attributes to interactive elements for stable selectors.

Test scenarios are documented in `tests/scenarios/` (CSV) and the Page Object Model in `tests/POM.json` (393 elements) and `tests/POM.md`.

## Roles

Built-in roles: `SYSADMIN` (all access, tenant management), `ADMIN` (all retail modules), `MANAGER` (POS + reports), `CASHIER` (POS sales only).

## Hard Rules

- **Never modify base framework files** — extend only via new modules and new files
- **Always use the framework's RBAC, auth, and seeding systems** — no parallel implementations
- **Always follow the 5-step module registration** — partial registration causes silent failures
- **Drizzle migrations = public schema only** — tenant schema changes require manual SQL scripts
