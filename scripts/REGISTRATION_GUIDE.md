# Module Registration Instructions

After generating a new module with the create-module script, you need to manually register it in the following locations:

## 1. Register Client Routes

**File**: `src/client/route.ts`

1. Import the module routes at the top:
```typescript
import { yourModuleReactRoutes } from '../modules/your-module/client/routes/yourModuleReactRoutes';
```

2. Add the route in the console children array:
```typescript
{
  path: "console",
  Component: ConsoleLayout,
  children: [
    // ... existing routes
    yourModuleReactRoutes("modules/your-module"), 
  ],
},
```

## 2. Register Server Routes

**File**: `src/server/main.ts`

1. Import the server routes at the top:
```typescript
import yourModuleRoutes from '../modules/your-module/server/routes/yourModuleRoutes';
```

2. Register the routes before ViteExpress.listen():
```typescript
// your module routes
app.use('/api/modules/your-module', yourModuleRoutes);
```

## 3. Register Sidebar Menu

If you want the module to appear in the sidebar navigation:

**File**: Look for existing sidebar menu registration patterns in your layout components.

1. Import the menu configuration:
```typescript
import { yourModuleSidebarMenus } from '@modules/your-module/client/menus/sideBarMenus';
```

2. Add to the menu items array:
```typescript
const menuItems = [
  // ... existing menu items
  ...yourModuleSidebarMenus,
];
```

## 4. Update Drizzle Schema Exports

If you have a central schema export file, add your new schema:

**File**: `src/server/lib/db/schema/index.ts` (if it exists)

```typescript
export * from '@modules/your-module/server/lib/db/schemas/yourModule';
```

## Example Registration

For a module named "inventory-management":

### route.ts
```typescript
import { inventoryManagementReactRoutes } from '../modules/inventory-management/client/routes/inventoryManagementReactRoutes';

// In routes array:
inventoryManagementReactRoutes("modules/inventory-management"),
```

### main.ts
```typescript
import inventoryManagementRoutes from '../modules/inventory-management/server/routes/inventoryManagementRoutes';

// Register route:
app.use('/api/modules/inventory-management', inventoryManagementRoutes);
```

## Verification

After registration:

1. Start the development server: `npm run dev`
2. Check that routes are accessible
3. Verify API endpoints work in browser or API client
4. Test the UI navigation and functionality
5. Check for any TypeScript errors
6. Run database migrations if needed

## Troubleshooting

- **Import errors**: Check file paths and naming conventions
- **Route conflicts**: Ensure unique route paths
- **Database errors**: Run migrations and check schema
- **Permission errors**: Verify module authorization setup
- **TypeScript errors**: Check type definitions and imports