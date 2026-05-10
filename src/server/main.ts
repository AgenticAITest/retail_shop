import express from "express";
import fileUpload from "express-fileupload";
import { rateLimit } from 'express-rate-limit';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import ViteExpress from "vite-express";
import { processPendingModuleRegistrations } from './lib/utils/moduleRegistrationHelper';
import { initSentry, Sentry } from './lib/sentry';
import { logger } from './lib/logger';
import { getConnectionManager } from './lib/db/tenant-connection-manager';
import { getRedis } from './lib/redis';
import { closeRedis } from './lib/redis';
import { closeAllQueues } from './lib/queue';
import pinoHttp from 'pino-http';

// Initialize Sentry early
initSentry();
import departmentRoutes from '../modules/demo-module/server/routes/departmentRoutes';
import documentRoutes from '../modules/demo-module/server/routes/documentRoutes';
import employeeRoutes from '../modules/demo-module/server/routes/employeeRoutes';
import showcaseModuleRoutes from '../modules/showcase-module/server/routes/showcaseModuleRoutes';
import apiKeyRoutes from '../modules/integration/server/routes/apiKeyRoutes';
import eventRoutes from '../modules/integration/server/routes/eventRoutes';
import partnerRoutes from '../modules/integration/server/routes/partnerRoutes';
import webhookRoutes from '../modules/integration/server/routes/webhookRoutes';
import locationRoutes from '../modules/location-management/server/routes/locationRoutes';
import taxConfigRoutes from '../modules/tax-configuration/server/routes/taxConfigRoutes';
import productRoutes from '../modules/product-catalog/server/routes/productRoutes';
import categoryRoutes from '../modules/product-catalog/server/routes/categoryRoutes';
import importExportRoutes from '../modules/product-catalog/server/routes/importExportRoutes';
import approvalConfigRoutes from '../modules/approval-engine/server/routes/configRoutes';
import supplierRoutes from '../modules/supplier-management/server/routes/supplierRoutes';
import supplierImportRoutes from '../modules/supplier-management/server/routes/supplierImportRoutes';
import onboardingRoutes from '../modules/tenant-onboarding/server/routes/onboardingRoutes';
import approvalRoutes from '../modules/approval-engine/server/routes/approvalRoutes';
import auditLogRoutes from '../modules/approval-engine/server/routes/auditLogRoutes';
import purchaseOrderRoutes from '../modules/purchase-order/server/routes/purchaseOrderRoutes';
import grnRoutes from '../modules/grn/server/routes/grnRoutes';
import returnRoutes from '../modules/supplier-return/server/routes/returnRoutes';
import creditNoteRoutes from '../modules/supplier-return/server/routes/creditNoteRoutes';
import posRoutes from '../modules/pos/server/routes/posRoutes';
import inventoryRoutes from '../modules/pos/server/routes/inventoryRoutes';
import shiftRoutes from '../modules/pos/server/routes/shiftRoutes';
import syncRoutes from '../modules/pos/server/routes/syncRoutes';
import transferRoutes from '../modules/transfer/server/routes/transferRoutes';
import inventoryMgmtRoutes from '../modules/inventory-management/server/routes/inventoryMgmtRoutes';
import reportRoutes from '../modules/report/server/routes/reportRoutes';
import reportScheduleRoutes from '../modules/report/server/routes/scheduleRoutes';
import { registerReportGeneratorWorker } from '../modules/report/server/jobs/reportGeneratorJob';
import { initReportScheduler } from '../modules/report/server/jobs/reportScheduler';
import authRoutes from "./routes/auth/auth";
import moduleAuthorizationRoutes from "./routes/system/moduleAuthorization";
import moduleRegistryRoutes from "./routes/system/moduleRegistry";
import optionRoutes from "./routes/system/option";
import permissionRoutes from "./routes/system/permission";
import roleRoutes from "./routes/system/role";
import tenantRoutes from "./routes/system/tenant";
import userRoutes from "./routes/system/user";
import inboundRoutes from "@modules/integration/server/routes/inboundRoutes";


const app = express();

// rate limiter
// const limiter = rateLimit({
// 	windowMs: 30 * 60 * 1000, // 30 minutes
// 	limit: 15000, // Limit each IP to 15000 requests per `window` (here, per 30 minutes).
// 	standardHeaders: 'draft-8', // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
// 	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
// 	ipv6Subnet: 56, // Set to 60 or 64 to be less aggressive, or 52 or 48 to be more aggressive
// 	// store: ... , // Redis, Memcached, etc. See below.
// })
// app.use(limiter);

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// Structured HTTP request logging (skip health + docs endpoints to reduce noise)
app.use(pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === '/api/health' || (req.url ?? '').startsWith('/api-docs'),
  },
}));

// misc middleware
app.use(fileUpload())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Process any pending module registrations on startup
processPendingModuleRegistrations().catch(console.error);

const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0', // Specify OpenAPI version
    info: {
      title: 'React Admin API',
      version: '1.0.0',
      description: 'API documentation for react admin application',
    },
    servers: [
      {
        url: 'http://localhost:5000', // Replace with your API base URL
        description: 'Development server',
      },
    ],
    // Add security schemes, components (schemas), etc. here if needed
  },
  // Path to your route files where JSDoc comments are located
  apis: [
    './src/server/routes/*/*.ts',
    './src/modules/*/server/routes/*.ts',
  ], 
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// auth routes
app.use('/api/auth', authRoutes);

// system routes
app.use('/api/system/permission', permissionRoutes);
app.use('/api/system/role', roleRoutes);
app.use('/api/system/tenant', tenantRoutes);
app.use('/api/system/option', optionRoutes);
app.use('/api/system/user', userRoutes);
app.use('/api/system/module-registry', moduleRegistryRoutes);
app.use('/api/system/module-authorization', moduleAuthorizationRoutes);

// demo-module routes
app.use('/api/modules/demo-module/department', departmentRoutes);
app.use('/api/modules/demo-module/document', documentRoutes);
app.use('/api/modules/demo-module/employee', employeeRoutes);

// showcase-module routes
app.use('/api/modules/showcase-module', showcaseModuleRoutes);

// location-management routes
app.use('/api/modules/location-management/location', locationRoutes);

// tax-configuration routes
app.use('/api/modules/tax-configuration/config', taxConfigRoutes);

// product-catalog routes
app.use('/api/modules/product-catalog/product', productRoutes);
app.use('/api/modules/product-catalog/category', categoryRoutes);
app.use('/api/modules/product-catalog/import-export', importExportRoutes);

// tenant-onboarding routes
app.use('/api/modules/tenant-onboarding/onboarding', onboardingRoutes);

// supplier-management routes
app.use('/api/modules/supplier-management/supplier', supplierRoutes);
app.use('/api/modules/supplier-management/import', supplierImportRoutes);

// approval-engine routes
app.use('/api/modules/approval-engine/config', approvalConfigRoutes);
app.use('/api/modules/approval-engine/approval', approvalRoutes);
app.use('/api/modules/approval-engine/audit-log', auditLogRoutes);

// purchase-order routes
app.use('/api/modules/purchase-order/po', purchaseOrderRoutes);

// grn routes
app.use('/api/modules/grn/grn', grnRoutes);

// supplier-return routes
app.use('/api/modules/supplier-return/return', returnRoutes);
app.use('/api/modules/supplier-return/credit-note', creditNoteRoutes);

// pos routes
app.use('/api/modules/pos/transaction', posRoutes);
app.use('/api/modules/pos/inventory', inventoryRoutes);
app.use('/api/modules/pos/shift', shiftRoutes);
app.use('/api/modules/pos/sync', syncRoutes);

// transfer routes
app.use('/api/modules/transfer/transfer', transferRoutes);

// inventory-management routes
app.use('/api/modules/inventory-management', inventoryMgmtRoutes);

// report routes
app.use('/api/modules/report', reportRoutes);
app.use('/api/modules/report/schedule', reportScheduleRoutes);

// integration routes
app.use('/api/modules/integration/apikey', apiKeyRoutes);
app.use('/api/modules/integration/event', eventRoutes);
app.use('/api/modules/integration/partner', partnerRoutes);
app.use('/api/modules/integration/webhook', webhookRoutes);
app.use('/api/modules/integration/inbound', inboundRoutes);

// Health check endpoint
app.get('/api/health', async (_req, res) => {
  try {
    const connManager = getConnectionManager();
    const dbHealth = await connManager.healthCheck();

    let redisHealthy = false;
    try {
      const redis = getRedis();
      await redis.ping();
      redisHealthy = true;
    } catch {
      // Redis may not be running
    }

    const healthy = dbHealth.shared.healthy;
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth.shared.healthy ? 'up' : 'down',
        redis: redisHealthy ? 'up' : 'down',
      },
      tenantConnections: dbHealth.tenants,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Sentry error handler (must be after all routes)
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Initialize background job workers
registerReportGeneratorWorker();
initReportScheduler();

ViteExpress.listen(app, 5000, () =>
  logger.info("Server is listening on port 5000"),
);

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received, closing gracefully');
  try {
    await closeAllQueues();
    await closeRedis();
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
