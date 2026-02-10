# Manual Module Registration Instructions

This document provides step-by-step instructions for manually registering modules in the React Admin application.

## 1. Register Server Routes

### Location: `src/server/main.ts`

Add your module's server routes to the main Express application:

```typescript
// Import your module routes
import sampleModuleRoutes from '../modules/sample-module/server/routes/sampleModuleRoutes';

// Register the routes (add this after existing route registrations)
app.use('/api/modules/sample-module', sampleModuleRoutes);
```

### Update Swagger Configuration

In the same file, update the `swaggerOptions.apis` array to include your module routes:

```typescript
const swaggerOptions = {
  // ... existing config
  apis: [
    './src/server/routes/auth/*.ts',
    './src/server/routes/system/*.ts',
    './src/server/routes/demo/*.ts',
    './src/modules/*/server/routes/*.ts', // Add this line
  ], 
};
```

## 2. Register Client Routes

### Location: `src/client/route.ts`

Add your module's React routes to the router configuration:

```typescript
// Import your module routes
import { sampleModuleReactRoutes } from '../modules/sample-module/client/routes/sampleModuleReactRoutes';

// Add to the console children array
{
  path: "console",
  Component: ConsoleLayout,
  children: [
    { path: "error-test", Component: ErrorTest },
    { path: "dashboard", Component: Dashboard },
    // ... existing routes ...
    
    // Add your module routes here
    sampleModuleReactRoutes,
  ],
}
```

## 3. Register Sidebar Menu

### Location: `src/client/components/app-sidebar.tsx`

Add your module's menu items to the sidebar navigation:

```typescript
// Import your module menu
import { sampleModuleSidebarMenus } from '../../modules/sample-module/client/menus/sideBarMenus';

// Add to the navMain array in the data object
const data = {
  navMain: [
    {
      id: "dashboard",
      title: "Dashboard",
      url: "/console/dashboard",
      icon: SquareTerminal,
      isActive: true,
    },
    // ... existing menu items ...
    
    // Add your module menu here
    sampleModuleSidebarMenus,
  ],
}
```

## 4. Register Database Schema

### Location: `src/server/lib//db/schema/index.ts`

Add your module's db schema :

```typescript
// ... existing db shemas ...

export * from '@modules/sample-module/server/lib/db/schemas/sampleModule';
```

## 5. Database Migration

After creating a new module with database schema:

```bash
# Generate migration files
npm run db:generate

# Review the generated migration in drizzle/ folder

# Apply migrations to database
npm run db:migrate
```

## 6. Verification Steps

### Check Server Routes
1. Start the development server: `npm run dev`
2. Visit `http://localhost:3000/api-docs` to see your module's API endpoints in Swagger
3. Test API endpoints with tools like Postman or curl

### Check Client Routes
1. Navigate to your module's URL in the browser
2. Verify all CRUD operations work correctly
3. Check that navigation breadcrumbs are correct

### Check Sidebar Menu
1. Verify the menu item appears in the sidebar
2. Check that menu items have correct links
3. Test any role/permission-based visibility

## 7. Example Registration

Here's a complete example for registering the sample module:

### In `src/server/main.ts`:
```typescript
import sampleModuleRoutes from '../modules/sample-module/server/routes/sampleModuleRoutes';

app.use('/api/modules/sample-module', sampleModuleRoutes);
```

### In `src/client/route.ts`:
```typescript
import { sampleModuleReactRoutes } from '../modules/sample-module/client/routes/sampleModuleReactRoutes';

// In console children array:
sampleModuleReactRoutes,
```

### In `src/client/components/app-sidebar.tsx`:
```typescript
import { sampleModuleSidebarMenus } from '../../modules/sample-module/client/menus/sideBarMenus';

// In navMain array:
sampleModuleSidebarMenus,
```

### In `src/server/lib//db/schema/index.ts`:
```typescript
export * from '@modules/sample-module/server/lib/db/schemas/sampleModule';

```

## 8. Troubleshooting

### Common Issues:

1. **Route conflicts**: Ensure unique paths for each module
2. **Import errors**: Check file paths and exports
3. **Database errors**: Run migrations after schema changes
4. **Permission errors**: Verify authentication middleware is applied
5. **TypeScript errors**: Check imports and type definitions

### Debug Steps:

1. Check browser console for JavaScript errors
2. Check server logs for API errors
3. Verify database table creation with `npm run db:studio`
4. Test API endpoints directly before testing UI

## 9. Best Practices

1. **Naming Convention**: Use consistent naming for routes, files, and components
2. **Error Handling**: Implement proper error handling in all components
3. **Loading States**: Show loading indicators during API calls
4. **Validation**: Validate inputs on both client and server
5. **Testing**: Test all CRUD operations thoroughly
6. **Documentation**: Keep module documentation updated