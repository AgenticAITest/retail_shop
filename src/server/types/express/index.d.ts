import { Request } from 'express';

// This file is intentionally minimal.
// All req.* type augmentations are declared in their respective middleware files:
//   - req.user, req.tenantCode, req.tenantDb, req.tenantInfo, req.sharedDb → authMiddleware.ts
//   - req.locationScope → locationScopeMiddleware.ts
