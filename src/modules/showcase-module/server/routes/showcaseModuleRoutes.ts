import express from 'express';
import { authenticated, authorized, resolveTenantContext } from '@server/middleware/authMiddleware'; // Adjust import path as needed
import { eq, and, desc, count, ilike, sql } from 'drizzle-orm';
import { checkModuleAuthorization } from '@server/middleware/moduleAuthMiddleware';

const router = express.Router();
router.use(resolveTenantContext());
router.use(authenticated());
router.use(checkModuleAuthorization('showcase-module'));

export default router;
