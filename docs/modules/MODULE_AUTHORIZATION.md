# Module Authorization System

The Module Authorization System provides tenant-based access control for modules in the React Admin application. This system allows administrators to control which modules are accessible to specific tenants, providing fine-grained control over feature availability.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Server-Side Implementation](#server-side-implementation)
5. [Client-Side Implementation](#client-side-implementation)
6. [Usage Guide](#usage-guide)
7. [API Reference](#api-reference)
8. [Examples](#examples)

## Overview

The Module Authorization System enables:

- **Tenant-based Module Access**: Control which modules each tenant can access
- **Real-time Authorization**: Dynamic checking of module permissions
- **Administrative Management**: UI for managing module authorizations per tenant
- **Route Protection**: Both server and client-side route guards
- **Graceful Handling**: User-friendly messaging when access is denied

## Architecture

The system consists of four main components:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Database      │    │   Server API    │    │   Client UI     │
│                 │    │                 │    │                 │
│ moduleAuth      │◄───┤ Middleware      │◄───┤ Route Guards    │
│ Table           │    │ & Routes        │    │ & Components    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │ Authorization   │
                       │ Management UI   │
                       └─────────────────┘
```

## Database Schema

### moduleAuthorization Table

```sql
CREATE TABLE moduleAuth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moduleId VARCHAR(255) NOT NULL,
  moduleName VARCHAR(255) NOT NULL,
  tenantId UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  isEnabled BOOLEAN NOT NULL DEFAULT true,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(moduleId, tenantId)
);
```

**Fields:**
- `id`: Unique identifier for the authorization record
- `moduleId`: String identifier of the module (e.g., 'sample-module')
- `tenantId`: Reference to the tenant this authorization applies to
- `isEnabled`: Whether the module is enabled for this tenant
- `createdAt`: Timestamp when the authorization was created
- `updatedAt`: Timestamp when the authorization was last modified

## Server-Side Implementation

### Middleware

#### `checkModuleAuthorization(moduleId: string)`

Server middleware that validates module access for authenticated users:

```typescript
import { checkModuleAuthorization } from '../middleware/moduleAuthMiddleware';

// Usage in routes
router.get('/api/modules/sample-module', 
  authenticated(), 
  checkModuleAuthorization('sample-module'), 
  handler
);
```

**Features:**
- Automatically extracts tenant ID from authenticated user
- Checks module authorization in database
- Returns 403 if module is not authorized for tenant
- Caches authorization status for performance

#### Helper Functions

```typescript
// Check if a module is authorized for a tenant
const isAuthorized = await isModuleAuthorized('sample-module', tenantId);

// Get all module authorizations for a tenant
const authorizations = await getModuleAuthorizationsForTenant(tenantId);
```

### API Routes

The system provides REST endpoints for managing module authorizations:

```typescript
// Get module authorizations for current tenant
GET /api/system/module-authorization

// Enable/disable module for current tenant
PATCH /api/system/module-authorization/:moduleId

// Bulk update module authorizations
POST /api/system/module-authorization/bulk
```

## Client-Side Implementation

### React Context and Hooks

#### `ModuleAuthorizationProvider`

Provides authorization state to React components:

```tsx
import { ModuleAuthorizationProvider } from '@client/hooks/useModuleAuthorization';

function App() {
  return (
    <ModuleAuthorizationProvider>
      <YourApp />
    </ModuleAuthorizationProvider>
  );
}
```

#### `useModuleAuthorization()`

Hook for accessing module authorization state:

```tsx
import { useModuleAuthorization } from '@client/hooks/useModuleAuthorization';

function MyComponent() {
  const { 
    isModuleAuthorized, 
    loadingStates, 
    toggleModuleAuthorization 
  } = useModuleAuthorization();

  const canAccessSampleModule = isModuleAuthorized('sample-module');
  
  if (!canAccessSampleModule) {
    return <UnauthorizedMessage />;
  }

  return <ModuleContent />;
}
```

### Route Guards

#### `ModuleRouteGuard`

Component that protects routes based on module authorization:

```tsx
import ModuleRouteGuard from '@client/components/auth/ModuleRouteGuard';

<ModuleRouteGuard 
  moduleId="sample-module" 
  moduleName="Sample Module"
  fallback={<CustomUnauthorizedPage />}
>
  <ProtectedContent />
</ModuleRouteGuard>
```

#### `withModuleAuthorization` HOC

Higher-order component for wrapping page components:

```tsx
import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';

const ProtectedPage = withModuleAuthorization(MyPageComponent, {
  moduleId: 'sample-module',
  moduleName: 'Sample Module',
  fallback: <CustomFallback />
});
```

### Management UI

#### `ModuleAuthorizationPage`

Administrative interface for managing module access:

- **Location**: `/console/system/module-authorization`
- **Features**:
  - View all registered modules
  - Toggle module access per tenant
  - Real-time status updates
  - Bulk operations support

## Usage Guide

### 1. Setting Up Module Authorization

#### Step 1: Database Setup
The `moduleAuthorization` table is automatically created via Drizzle migrations.

#### Step 2: Server Route Protection
Add middleware to your module routes:

```typescript
import { checkModuleAuthorization } from '../middleware/moduleAuthMiddleware';

router.get('/api/modules/your-module', 
  authenticated(), 
  checkModuleAuthorization('your-module-id'), 
  yourHandler
);
```

#### Step 3: Client Route Protection
Wrap your page components:

```tsx
export default withModuleAuthorization(YourPageComponent, {
  moduleId: 'your-module-id',
  moduleName: 'Your Module Name'
});
```

### 2. Managing Module Access

#### Via Admin UI
1. Navigate to `/console/system/module-authorization`
2. Toggle switches to enable/disable modules for your tenant
3. Changes are applied immediately

#### Via API
```typescript
// Enable a module
await axios.patch(`/api/system/module-authorization/your-module-id`, {
  isEnabled: true
});

// Check authorization status
const { isAuthorized } = await axios.get(`/api/system/module-authorization/your-module-id`);
```

### 3. Creating New Modules

When creating a new module:

1. **Server Routes**: Add `checkModuleAuthorization('module-id')` middleware
2. **Client Pages**: Wrap with `withModuleAuthorization` HOC
3. **Module Metadata**: Ensure `module.json` contains correct module ID
4. **Default Authorization**: Consider auto-enabling for existing tenants

## API Reference

### GET /api/system/module-authorization

Get all module authorizations for the current tenant.

**Response:**
```json
{
  "data": [
    {
      "moduleId": "sample-module",
      "moduleName": "Sample Module",
      "isAuthorized": true,
      "lastUpdated": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### PATCH /api/system/module-authorization/:moduleId

Update authorization status for a specific module.

**Request Body:**
```json
{
  "isEnabled": true
}
```

**Response:**
```json
{
  "moduleId": "sample-module",
  "isEnabled": true,
  "updatedAt": "2024-01-15T10:05:00Z"
}
```

### POST /api/system/module-authorization/bulk

Bulk update multiple module authorizations.

**Request Body:**
```json
{
  "updates": [
    { "moduleId": "module-1", "isEnabled": true },
    { "moduleId": "module-2", "isEnabled": false }
  ]
}
```

## Examples

### Example 1: Basic Module Protection

```tsx
// MyModulePage.tsx
import React from 'react';
import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';

const MyModulePage: React.FC = () => {
  return (
    <div>
      <h1>My Protected Module</h1>
      <p>This content is only visible to authorized tenants.</p>
    </div>
  );
};

export default withModuleAuthorization(MyModulePage, {
  moduleId: 'my-module',
  moduleName: 'My Module'
});
```

### Example 2: Conditional Rendering

```tsx
// Dashboard.tsx
import React from 'react';
import { useModuleAuthorization } from '@client/hooks/useModuleAuthorization';

const Dashboard: React.FC = () => {
  const { isModuleAuthorized } = useModuleAuthorization();

  return (
    <div>
      <h1>Dashboard</h1>
      
      {isModuleAuthorized('analytics') && (
        <AnalyticsWidget />
      )}
      
      {isModuleAuthorized('reports') && (
        <ReportsSection />
      )}
      
      {!isModuleAuthorized('premium-features') && (
        <UpgradePrompt />
      )}
    </div>
  );
};
```

### Example 3: Server Route with Authorization

```typescript
// server/routes/myModule.ts
import express from 'express';
import { authenticated } from '../middleware/authMiddleware';
import { checkModuleAuthorization } from '../middleware/moduleAuthMiddleware';

const router = express.Router();

router.get('/api/my-module/data', 
  authenticated(), 
  checkModuleAuthorization('my-module'), 
  async (req, res) => {
    // This endpoint is only accessible if:
    // 1. User is authenticated
    // 2. User's tenant has 'my-module' authorization enabled
    
    const data = await getModuleSpecificData(req.user.activeTenantId);
    res.json(data);
  }
);

export default router;
```

### Example 4: Custom Fallback UI

```tsx
// CustomUnauthorizedPage.tsx
import React from 'react';
import { Button } from '@client/components/ui/button';

const CustomUnauthorizedPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">Access Restricted</h1>
      <p className="text-gray-600 mb-6 text-center max-w-md">
        This module is not registered for your current plan. 
        Contact your administrator to upgrade your access.
      </p>
      <Button onClick={() => window.history.back()}>
        Go Back
      </Button>
    </div>
  );
};

// Usage with custom fallback
export default withModuleAuthorization(MyComponent, {
  moduleId: 'premium-module',
  moduleName: 'Premium Module',
  fallback: <CustomUnauthorizedPage />
});
```

## Best Practices

1. **Module ID Consistency**: Use consistent module IDs across server routes, client components, and database records
2. **Graceful Degradation**: Provide meaningful fallback UI when modules are not authorized
3. **Performance**: Cache authorization checks where possible
4. **Security**: Always validate authorization on the server side, not just client side
5. **User Experience**: Provide clear messaging about why access is restricted
6. **Admin Tools**: Use the management UI for easy module access control

## Troubleshooting

### Common Issues

1. **Module Not Found**: Ensure module ID matches exactly between client and server
2. **Authorization Not Working**: Check that middleware is applied in correct order
3. **UI Not Updating**: Verify ModuleAuthorizationProvider wraps your app
4. **Database Errors**: Ensure migrations have been run for moduleAuthorization table

### Debugging

Enable debug logging by setting environment variable:
```bash
DEBUG=module-auth npm start
```

This will log all module authorization checks for debugging purposes.