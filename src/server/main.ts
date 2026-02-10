import express from "express";
import fileUpload from "express-fileupload";
import { rateLimit } from 'express-rate-limit';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import ViteExpress from "vite-express";
import { processPendingModuleRegistrations } from './lib/utils/moduleRegistrationHelper';
import departmentRoutes from '../modules/demo-module/server/routes/departmentRoutes';
import documentRoutes from '../modules/demo-module/server/routes/documentRoutes';
import employeeRoutes from '../modules/demo-module/server/routes/employeeRoutes';
import showcaseModuleRoutes from '../modules/showcase-module/server/routes/showcaseModuleRoutes';
import apiKeyRoutes from '../modules/integration/server/routes/apiKeyRoutes';
import eventRoutes from '../modules/integration/server/routes/eventRoutes';
import partnerRoutes from '../modules/integration/server/routes/partnerRoutes';
import webhookRoutes from '../modules/integration/server/routes/webhookRoutes';
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

// integration routes
app.use('/api/modules/integration/apikey', apiKeyRoutes);
app.use('/api/modules/integration/event', eventRoutes);
app.use('/api/modules/integration/partner', partnerRoutes);
app.use('/api/modules/integration/webhook', webhookRoutes);
app.use('/api/modules/integration/inbound', inboundRoutes);

ViteExpress.listen(app, 5000, () =>
  console.log("Server is listening on port 5000..."),
);
