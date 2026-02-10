
# React Admin Multitenancy

A comprehensive **multi-tenant admin dashboard** built with React, TypeScript, Vite, and Drizzle ORM. This project serves as an **enterprise-grade foundation platform** for building scalable SaaS applications. It features **schema-per-tenant architecture**, modular development system, automated code generation, and advanced authentication with role-based access control.

## Tech Stack

- **Frontend:**
  - React 19 with TypeScript
  - Vite (build tool with hot reload)
  - shadcn/ui components (modern, accessible UI library)
  - TailwindCSS 4.x (utility-first styling)
  - React Router 7 (client-side routing)
  - React Hook Form + Zod (form validation)
  - Framer Motion (animations)
  - Axios (HTTP client with tenant interceptors)

- **Backend:**
  - Node.js with Express 5
  - TypeScript throughout
  - JWT authentication with refresh tokens
  - Express Rate Limiting & CORS
  - File upload support
  - Swagger API documentation

- **Database & ORM:**
  - PostgreSQL (with schema-per-tenant architecture)
  - Drizzle ORM (type-safe SQL toolkit)
  - Database connection pooling
  - Automated migrations
  - Multi-tenant connection management

- **Development Tools:**
  - Automated module generation scripts
  - Interactive CLI tools for rapid development  
  - SQL script generation for deployments
  - Hot reload for both client and server

## 🚀 Key Features

### **Multi-Tenancy (Schema-per-Tenant)**
- **Complete data isolation** with separate database schemas per tenant
- **Enhanced security** and performance over column-based isolation  
- **Tenant resolution** via subdomain, headers, or JWT tokens
- **Dynamic database connections** with connection pooling
- **Migration system** from column-based to schema-based architecture

### **Modular Architecture**
- **Self-contained modules** with frontend/backend/database components
- **Automated module generation** with interactive CLI tools
- **Hot-pluggable architecture** for easy feature addition/removal
- **Module authorization system** for granular tenant control
- **Auto-registration** of routes, menus, and database schemas

### **Enterprise Authentication & Authorization**
- **JWT-based authentication** with secure token management
- **Multi-level authorization**: Role-based + Permission-based access control
- **Tenant-aware middleware** for all API operations
- **SYSADMIN override** capabilities for system administration
- **Password reset** and user management workflows

### **Modern UI/UX**
- **Responsive design** with mobile-first approach
- **Dark/Light theme** support with system preference detection
- **Accessible components** using shadcn/ui and Radix UI
- **Advanced data tables** with sorting, filtering, and pagination
- **Error boundaries** with graceful fallback UI
- **Toast notifications** and confirmation dialogs

### **Developer Experience**
- **Interactive module generator**: `npm run create-module`
- **Page generator for existing modules**: `npm run add-page`
- **Auto-registration system**: `npm run register-module`
- **SQL script generation**: `npm run generate-sql`
- **TypeScript throughout** for type safety
- **Hot reload** for rapid development
- **Comprehensive API documentation** with Swagger UI

## 🏗️ Database Architecture

The project uses a **schema-per-tenant architecture** for superior data isolation:

```
🏢 Multi-Schema Database Structure
├── 📊 Shared Schema (public)
│   ├── sys_tenant (tenant registry)
│   ├── sys_module_registry (global module catalog)
│   └── sys_module_auth (tenant-specific module permissions)
├── 🏛️ Tenant Schema: tenant_acme
│   ├── sys_user (tenant users)
│   ├── sys_role (tenant roles)
│   ├── sys_permission (tenant permissions)
│   ├── sys_user_role (user-role mappings)
│   ├── sys_role_permission (role-permission mappings)
│   └── [module-specific tables]
└── 🏛️ Tenant Schema: tenant_xyz
    ├── sys_user, sys_role, sys_permission
    └── [module-specific tables]
```

### **Schema Management**
- **Drizzle ORM migrations** for schema versioning
- **Automated schema creation** for new tenants  
- **Connection pooling** with tenant-aware routing
- **Module schemas** automatically included in tenant deployments
- **Migration files**: `drizzle/` directory
- **Schema definitions**: `src/server/lib/db/schema/`

### **Benefits of Schema-per-Tenant**
- ✅ **Complete data isolation** - no cross-tenant queries possible
- ✅ **Better performance** - no tenant_id filtering required
- ✅ **Enhanced security** - physical separation at database level
- ✅ **Easier compliance** - GDPR, SOC2, HIPAA ready
- ✅ **Scalable backups** - per-tenant backup/restore capabilities

## Project Structure

```
react-admin/
├── components.json
├── drizzle.config.ts
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── drizzle/
│   ├── [migration files].sql
│   └── meta/
│       ├── _journal.json
│       └── [snapshot].json
├── public/
│   ├── vite.svg
│   └── fonts/
│       └── Geist/
│           ├── geist-mono.woff2
│           ├── geist.woff2
│           └── LICENSE.TXT
├── src/
│   └── client/
│       ├── App.css
│       ├── App.tsx
│       ├── index.css
│       ├── main.tsx
│       ├── route.ts
│       ├── tsconfig.json
│       ├── vite-env.d.ts
│       ├── assets/
│       │   └── react.svg
│       ├── components/
│       │   ├── app-sidebar.tsx
│       │   ├── nav-main.tsx
│       │   ├── nav-projects.tsx
│       │   ├── nav-user.tsx
│       │   ├── team-switcher.tsx
│       │   └── auth/
│       │       ├── authorized.tsx
│       │       ├── has-permissions.tsx
│       │       ├── has-roles.tsx
│       │       ├── login-form.tsx
│       │       └── register-form.tsx
│       │   └── ui/
│       │       ├── avatar.tsx
│       │       ├── breadcrumb.tsx
│       │       ├── button.tsx
│       │       ├── card.tsx
│       │       ├── collapsible.tsx
│       │       ├── dropdown-menu.tsx
│       │       ├── input.tsx
│       │       ├── label.tsx
│       │       ├── separator.tsx
│       │       ├── sheet.tsx
│       │       ├── sidebar.tsx
│       │       ├── skeleton.tsx
│       │       └── tooltip.tsx
│       ├── hooks/
│       │   └── use-mobile.ts
│       ├── lib/
│       │   └── utils.ts
│       ├── pages/
│       │   ├── ErrorPage.tsx
│       │   ├── Home.tsx
│       │   ├── RootLayout.tsx
│       │   └── auth/
│       │       ├── AuthLayout.tsx
│       │       ├── Login.tsx
│       │       └── Register.tsx
│       │   └── console/
│       │       ├── ConsoleLayout.tsx
│       │       ├── Dashboard.tsx
│       │       └── system/
│       │           ├── Permission.tsx
│       │           ├── Role.tsx
│       │           └── User.tsx
│       ├── provider/
│       │   └── authProvider.tsx
│       ├── server/
│       │   ├── main.ts
│       │   └── lib/
│       │       └── db/
│       │           ├── index.ts
│       │           ├── seed.ts
│       │           └── schema/
│       │               └── system.ts
│       │   └── middleware/
│       │       ├── authMiddleware.ts
│       │       └── validationMiddleware.ts
│       │   └── routes/
│       │       └── auth/
│       │           └── auth.ts
│       │       └── system/
│       │           └── permission.ts
│       │   └── schemas/
│       │       └── userSchema.ts
│       │   └── types/
│       │       └── express/
│       │           └── index.d.ts
```

## 🚀 Quick Start

### **1. Installation**
```bash
# Clone and install dependencies
git clone <repository-url>
cd react-admin-multitenancy
npm install
```

### **2. Environment Configuration**
```bash
# Copy and configure environment variables
cp .env.example .env

# Required environment variables:
# DATABASE_URL=postgresql://user:password@localhost:5432/dbname
# ACCESS_TOKEN_SECRET=your-jwt-secret-key
# REFRESH_TOKEN_SECRET=your-refresh-secret-key
```

### **3. Database Setup**
```bash
# Generate and run initial migrations
npm run db:generate
npm run db:migrate

# Seed the database with initial data
npm run db:seed
```

### **4. Development Server**
```bash
# Start both frontend and backend (runs on port 5000)
npm run dev

# The application will be available at:
# - Frontend: http://localhost:5000
# - API: http://localhost:5000/api
# - API Docs: http://localhost:5000/api-docs
```

### **5. Create Your First Module** 
```bash
# Interactive module generator
npm run create-module

# Follow the prompts to create a new feature module
# Then register it in the application:
npm run register-module
```

## 🏗️ Available Scripts

### **Development**
```bash
npm run dev              # Start development server (frontend + backend)
npm run db:generate      # Generate new migration files
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed database with initial data
npm run db:studio        # Open Drizzle Studio for database management
```

### **Module Development**
```bash
npm run create-module        # Interactive module generator
npm run create-module-cli    # CLI module generator (non-interactive)
npm run add-page            # Add new page to existing module
npm run register-module     # Register module in application
npm run generate-sql        # Generate SQL scripts for module deployment
```

### **Production**
```bash
npm run build           # Build frontend for production
npm run start          # Start production server
```

### **Database Management**
```bash
npm run db:push         # Push schema changes to database
npm run db:register-module  # Register module in database registry
```

## 🔗 API Endpoints

### **Authentication**
- `POST /api/auth/login` — User login with credentials
- `POST /api/auth/register` — New user registration  
- `POST /api/auth/register-tenant` — Tenant registration
- `POST /api/auth/forget-password` — Password reset request
- `POST /api/auth/reset-password` — Password reset with token
- `POST /api/auth/refresh` — Refresh access token

### **System Management** 
- `GET|POST|PUT|DELETE /api/system/user` — User management
- `GET|POST|PUT|DELETE /api/system/role` — Role management
- `GET|POST|PUT|DELETE /api/system/permission` — Permission management
- `GET|POST|PUT|DELETE /api/system/tenant` — Tenant management
- `GET|POST|PUT|DELETE /api/system/option` — System options
- `POST /api/system/user/switch-tenant` — Switch active tenant

### **Module System**
- `GET|POST|PUT /api/system/module-registry` — Module catalog management
- `GET|POST|PUT /api/system/module-authorization` — Module authorization per tenant
- `GET|POST|PUT|DELETE /api/modules/{module-id}` — Module-specific endpoints

### **Development Tools**
- `/api-docs` — **Swagger UI** for interactive API documentation
- All endpoints include comprehensive **JSDoc annotations**
- **Multi-tenant aware** - automatic tenant context resolution
- **Authentication required** for all system endpoints

## 🛠️ Modular Development

### **Creating New Features**
The project uses a **modular architecture** where each feature is completely self-contained:

```bash
# Generate a new module with full CRUD operations
npm run create-module

# Add additional pages to existing modules  
npm run add-page

# Register all components in the application
npm run register-module
```

### **Module Structure**
Each module follows this standardized structure:
```
src/modules/your-module/
├── module.json                    # Module metadata & configuration
├── client/                        # Frontend components
│   ├── components/               # Reusable UI components
│   ├── pages/                    # Route-based page components
│   ├── routes/                   # React Router configuration
│   └── menus/                    # Sidebar menu configuration
├── server/                       # Backend API
│   ├── routes/                   # Express.js API routes
│   └── lib/db/schemas/          # Database schema definitions
└── docs/                         # Module documentation
```

### **What Gets Auto-Generated**
- ✅ **React components** with TypeScript + shadcn/ui
- ✅ **API routes** with authentication & tenant isolation
- ✅ **Database schemas** with Drizzle ORM
- ✅ **Form validation** with React Hook Form + Zod
- ✅ **Swagger documentation** for all endpoints
- ✅ **Menu integration** with role-based visibility
- ✅ **SQL deployment scripts** for production

### **Manual Customization**
- **Frontend pages**: `src/client/pages/`
- **Reusable components**: `src/client/components/`
- **API routes**: `src/server/routes/`
- **Database schemas**: `src/server/lib/db/schema/`
- **Middleware**: `src/server/middleware/`

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[Module Development Guide](docs/modules/)** - Creating and managing modules
- **[Component Usage](docs/components/)** - UI component documentation  
- **[Tenant Migration](docs/tenant_per_schema/)** - Schema-per-tenant migration guide
- **[API Documentation](http://localhost:5000/api-docs)** - Interactive Swagger UI

## 🎯 Use Cases

This platform is ideal for:
- **SaaS Applications** with multi-tenant requirements
- **Enterprise Admin Dashboards** with complex permissions
- **B2B Platforms** requiring tenant isolation
- **Rapid Prototyping** of data-driven applications
- **Microservice Backends** with modular architecture

## 🔐 Security Features

- **JWT Authentication** with secure token storage
- **Role-Based Access Control (RBAC)** with granular permissions
- **Tenant Isolation** at database schema level
- **Rate Limiting** to prevent abuse
- **CORS Protection** for cross-origin requests
- **Input Validation** on both client and server
- **SQL Injection Protection** via Drizzle ORM

## 🚀 Production Deployment

1. **Build the application**: `npm run build`
2. **Configure environment variables** for production
3. **Run database migrations**: `npm run db:migrate`
4. **Deploy SQL scripts** for each tenant schema
5. **Start production server**: `npm run start`

The application is designed to be deployed on platforms like:
- **Docker containers** with PostgreSQL
- **Cloud platforms** (AWS, GCP, Azure)
- **Traditional VPS** with reverse proxy (nginx)

