# Modular Architecture Guide

This document explains the modular architecture implemented in the React Admin project.

## Overview

The modular architecture allows you to organize features into self-contained modules, each with their own:
- Frontend components and pages
- Backend API routes
- Database schemas
- Menu configurations
- Route definitions

## Module Structure

Each module follows this standardized structure:

```
src/modules/[module-name]/
├── module.json                      # Module metadata and configuration
├── client/                          # Frontend code
│   ├── components/                  # Reusable UI components
│   │   └── [ModuleName]Component.tsx
│   ├── pages/                       # Page components
│   │   ├── [ModuleName]List.tsx
│   │   ├── [ModuleName]Add.tsx
│   │   ├── [ModuleName]Edit.tsx
│   │   └── [ModuleName]Detail.tsx
│   ├── menus/                       # Sidebar menu configuration
│   │   └── sideBarMenus.ts
│   └── routes/                      # React route definitions
│       └── [moduleName]ReactRoutes.ts
└── server/                          # Backend code
    ├── routes/                      # Express API routes
    │   └── [moduleName]Routes.ts
    └── lib/
        └── db/
            └── schemas/             # Database schema definitions
                └── [moduleName].ts
```

## Creating a New Module

### Step 1: Create Directory Structure

```bash
mkdir -p src/modules/your-module/client/{components,pages,menus,routes}
mkdir -p src/modules/your-module/server/{routes,lib/db/schemas}
```

### Step 2: Create Module Metadata

Create `src/modules/your-module/module.json`:

```json
{
  "id": "your-module",
  "name": "Your Module Name",
  "owner": "Your Team",
  "description": "Description of what your module does",
  "version": "1.0.0",
  "metadata": {
    "category": "Business",
    "tags": ["tag1", "tag2"],
    "dependencies": {
      "requires": ["authentication"],
      "optional": []
    },
    "permissions": [
      "your-module.view",
      "your-module.create",
      "your-module.edit",
      "your-module.delete"
    ],
    "routes": {
      "api": "/api/modules/your-module",
      "client": "/console/modules/your-module"
    },
    "database": {
      "tables": ["your_module"],
      "relations": ["tenant"]
    },
    "features": [
      "CRUD operations",
      "Search and filtering",
      "Multi-tenant support"
    ]
  },
  "author": {
    "name": "Your Name",
    "email": "your.email@example.com",
    "url": "https://github.com/your-username"
  },
  "license": "MIT",
  "createdAt": "2025-10-09T00:00:00Z",
  "updatedAt": "2025-10-09T00:00:00Z"
}
```

### Step 3: Database Schema

Create `src/modules/your-module/server/lib/db/schemas/yourModule.ts`:

```typescript
import { relations } from 'drizzle-orm';
import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { tenant } from '@client/../server/lib/db/schema/system';

export const yourModule = pgTable('your_module', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 500 }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const yourModuleRelations = relations(yourModule, ({ one }) => ({
  tenant: one(tenant, {
    fields: [yourModule.tenantId],
    references: [tenant.id],
  }),
}));

export type YourModule = typeof yourModule.$inferSelect;
export type NewYourModule = typeof yourModule.$inferInsert;
```

### Step 4: API Routes

Create `src/modules/your-module/server/routes/yourModuleRoutes.ts`:

```typescript
import express from 'express';
import { db } from '@client/../server/lib/db';
import { yourModule } from '../lib/db/schemas/yourModule';
import { eq, and, desc } from 'drizzle-orm';
import { authenticated, authorized } from '@server/middleware/authMiddleware';
import { checkModuleAuthorization } from '@server/middleware/moduleAuthMiddleware';

const router = express.Router();
router.use(authenticated());
router.use(checkModuleAuthorization('your-module-id'));

// GET /api/modules/your-module
router.get('/', authorized('ADMIN','your-module-id.view'), async (req, res) => {
  // Implementation
});

// POST /api/modules/your-module
router.post('/', authorized('ADMIN','your-module-id.create'), async (req, res) => {
  // Implementation
});

// GET /api/modules/your-module/:id
router.get('/:id', authorized('ADMIN','your-module-id.view'), async (req, res) => {
  // Implementation
});

// PUT /api/modules/your-module/:id
router.put('/:id', authorized('ADMIN','your-module-id.edit'), async (req, res) => {
  // Implementation
});

// DELETE /api/modules/your-module/:id
router.delete('/:id', authorized('ADMIN','your-module-id.delete'), async (req, res) => {
  // Implementation
});

export default router;
```

### Step 5: React Components

Create your React components in `src/modules/your-module/client/pages/`:
- `YourModuleList.tsx` - List/table view
- `YourModuleAdd.tsx` - Create form
- `YourModuleEdit.tsx` - Edit form  
- `YourModuleDetail.tsx` - Detail view

### Step 6: Menu Configuration

Create `src/modules/your-module/client/menus/sideBarMenus.ts`:

```typescript
import { YourIcon } from 'lucide-react';

export const yourModuleSidebarMenus = {
  id: "your-module",
  title: "Your Module",
  url: "/console/modules/your-module",
  icon: YourIcon,
  roles: "ADMIN",
  permissions: "your-module-id.view",
  items: [
    {
      id: "list",
      title: "Module List",
      url: "/console/modules/your-module",
      roles: "ADMIN",
      permissions: "your-module-id.view",
    }
  ],
};
```

### Step 7: Route Configuration

Create `src/modules/your-module/client/routes/yourModuleReactRoutes.ts`:

```typescript
import YourModuleList from '../pages/YourModuleList';
import YourModuleAdd from '../pages/YourModuleAdd';
import YourModuleEdit from '../pages/YourModuleEdit';
import YourModuleDetail from '../pages/YourModuleDetail';

export const yourModuleReactRoutes  = (basePath = "modules/your-module-id") => ({
  path: basePath, 
  children: [
    { index: true, Component: YourModuleList },
    { path: "add", Component: YourModuleAdd },
    { path: ":id", Component: YourModuleDetail },
    { path: ":id/edit", Component: YourModuleEdit },
  ]
});
```

## Registration

### Server Route Registration

In `src/server/main.ts`:

```typescript
import yourModuleRoutes from '../modules/your-module/server/routes/yourModuleRoutes';

app.use('/api/modules/your-module', yourModuleRoutes);
```

### Client Route Registration

In `src/client/route.ts`:

```typescript
import { yourModuleReactRoutes } from '../modules/your-module/client/routes/yourModuleReactRoutes';

// Add to console children
{
  path: "console",
  Component: ConsoleLayout,
  children: [
    // ... existing routes
    yourModuleReactRoutes,
  ],
}
```

### Sidebar Menu Registration

In `src/client/components/app-sidebar.tsx`:

```typescript
import { yourModuleSidebarMenus } from '../modules/your-module/client/menus/sideBarMenus';

const data = {
  navMain: [
    // ... existing items
    yourModuleSidebarMenus,
  ],
};
```

In `src/server/lib//db/schema/index.ts`:
```typescript
export * from '@modules/your-module/server/lib/db/schemas/yourModule';

```

## Database Migration

After creating a new module:

```bash
# Generate migration files
npm run db:generate

# Apply migrations
npm run db:migrate
```

## Configuration

The following files have been updated to support modules:

- `vite.config.ts` - Added `@modules` alias
- `tsconfig.json` - Added module path mapping and JSX support
- `drizzle.config.ts` - Include module schemas in migrations

## Benefits

1. **Separation of Concerns**: Each module is self-contained
2. **Reusability**: Modules can be easily moved between projects
3. **Scalability**: Large applications can be broken into manageable modules
4. **Team Development**: Different teams can work on different modules
5. **Testing**: Modules can be tested in isolation
6. **Maintenance**: Easier to maintain and update individual features

## Best Practices

1. **Naming Convention**: Use kebab-case for directory names, PascalCase for components
2. **Type Safety**: Always define TypeScript interfaces for your data
3. **Error Handling**: Implement proper error handling in both client and server
4. **Validation**: Validate data on both client and server sides
5. **Documentation**: Document your module's API and usage
6. **Testing**: Write tests for your module's functionality
7. **Security**: Use authentication/authorization middlewares
8. **Multi-tenancy**: Always filter by tenant ID for data isolation

## Example Modules

The project includes a `sample-module` as a complete reference implementation. Use it as a template for creating new modules.