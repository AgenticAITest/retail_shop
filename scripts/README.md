# Scripts Directory

This directory contains utility scripts for the React Admin project.

## Available Scripts

### 🚀 create-module.js (Interactive)

An interactive script to generate new modules following the project's modular architecture.

**Usage:**
```bash
# Using npm script (recommended)
npm run create-module

# Or directly
node scripts/create-module.js
```

### ⚡ create-module-cli.js (Command Line)

A command-line version for automated or scripted module generation.

### 📄 add-page-to-module.js (Interactive)

An interactive script to add new pages/entities to existing modules with complete frontend and backend implementation.

**Usage:**
```bash
# Using npm script (recommended)
npm run add-page

# Or directly
node scripts/add-page-to-module.js
```

**What it generates:**
- Frontend page components (List, Add)
- React routes configuration
- Updated sidebar menu items
- Express.js API routes with CRUD operations
- Database schema with Drizzle ORM
- Swagger API documentation
- Multi-tenant support
- Authentication and authorization

### 🔧 register-module.js (Interactive)

An interactive script to automatically register existing modules following the 5-step manual registration process.

**Usage:**
```bash
# Using npm script (recommended)
npm run register-module

# Or directly
node scripts/register-module.js
```

**What it does:**
- **Step 1**: Register client routes in `src/client/route.ts`
- **Step 2**: Register server routes in `src/server/main.ts`
- **Step 3**: Register sidebar menu in `src/client/components/app-sidebar.tsx`
- **Step 4**: Update schema exports in central schema index (if exists)
- **Step 5**: Register module in database (moduleRegistry table)
- **Step 6**: Generate SQL scripts for module tables and relations
- Automatically detects existing registrations to avoid duplicates
- Provides verification steps after registration

### 📊 register-module-db.js (Database Registration)

A specialized script to register modules in the database (moduleRegistry table) using shared database connection.

**Usage:**
```bash
# Using npm script (recommended)
npm run db:register-module <module-id>

# Or directly
node scripts/register-module-db.js <module-id>

# Process temp data from register-module.js
node scripts/register-module-db.js
```

**What it does:**
- Reads module.json file for module metadata
- Connects to shared database using tenant connection manager
- Inserts module information into `sys_module_registry` table
- Prevents duplicate registrations
- Can process temporary data from main registration script

### 🗄️ generate-module-sql.js (SQL Script Generator)

A specialized script to generate SQL scripts for module database tables and relations.

**Usage:**
```bash
# Using npm script (recommended)
npm run generate-sql [module-id]

# Or directly
node scripts/generate-module-sql.js [module-id]

# Interactive mode (if no module-id provided)
npm run generate-sql
```

**What it generates:**
- `create_tables.sql` - Table creation with indexes and constraints
- `drop_tables.sql` - Table removal script (⚠️ destructive)
- `seed_data.sql` - Sample data template
- `install.sql` - Complete installation script
- `README.md` - Documentation for the SQL scripts

**Generated files location:** `modules/[module-id]/scripts/`

**Features:**
- **Uses Drizzle Kit**: Leverages official Drizzle tooling for accurate SQL generation
- **Fallback Support**: Manual parsing as backup if Drizzle Kit fails
- **PostgreSQL Compatible**: Generates production-ready PostgreSQL SQL
- **Multi-tenant Aware**: Scripts designed for tenant schema deployment
- **Performance Optimized**: Includes indexes on common query fields
- **Complete Deployment**: Installation and rollback scripts included

### ⚡ create-module-cli.js (Command Line)

A command-line version for automated or scripted module generation.

**Usage:**
```bash
# Using npm script
npm run create-module-cli "module-id" "Module Name" "Description" "Author" "email@example.com" "Category"

# Or directly
node scripts/create-module-cli.js "user-profile" "User Profile" "User management system" "Developer" "dev@example.com" "System"

# Minimal (uses defaults for optional params)
npm run create-module-cli "blog-posts" "Blog Posts"
```

**What it generates:**
- Complete module directory structure
- `module.json` with metadata
- React components and pages (List, Add)
- Client-side routes configuration
- Sidebar menu configuration
- Express.js API routes with CRUD operations
- Database schema with Drizzle ORM
- Swagger API documentation
- README with module documentation

**Generated structure:**
```
src/modules/your-module/
├── module.json
├── client/
│   ├── components/
│   │   └── YourModuleComponent.tsx
│   ├── pages/
│   │   ├── YourModuleList.tsx
│   │   └── YourModuleAdd.tsx
│   ├── menus/
│   │   └── sideBarMenus.ts
│   └── routes/
│       └── yourModuleReactRoutes.ts
├── server/
│   ├── routes/
│   │   └── yourModuleRoutes.ts
│   └── lib/db/schemas/
│       └── yourModule.ts
└── docs/
    └── README.md
```

**Interactive prompts:**
- Module ID (kebab-case)
- Module Name (display name)
- Description
- Author information
- Category

**After generation:**
1. Follow the instructions in `REGISTRATION_GUIDE.md`
2. Register routes in `src/client/route.ts` and `src/server/main.ts`
3. Run database migrations
4. Configure module authorization if needed

### 📖 REGISTRATION_GUIDE.md

Detailed step-by-step instructions for manually registering generated modules in the application.

**Covers:**
- Client route registration
- Server route registration
- Sidebar menu integration
- Database migration steps
- Module authorization setup
- Troubleshooting tips

## Features of Generated Modules

### Frontend (React)
- **TypeScript** support throughout
- **React Hook Form** with Zod validation
- **shadcn/ui** components for consistent design
- **Responsive design** with TailwindCSS
- **List page** with search, pagination, and actions
- **Add page** with form validation
- **Route configuration** with React Router
- **Menu configuration** for sidebar navigation

### Backend (Express)
- **RESTful API** endpoints
- **Multi-tenant** support with tenant isolation
- **Authentication** middleware integration
- **Database operations** with Drizzle ORM
- **Swagger documentation** with JSDoc annotations
- **Error handling** and validation
- **Pagination** and search support
- **TypeScript** interfaces and types

### Database
- **PostgreSQL** schema with Drizzle ORM
- **UUID** primary keys
- **Tenant isolation** with foreign keys
- **Timestamps** for audit trails
- **Migration** support
- **SQL scripts** generation for deployment

### SQL Scripts (Auto-generated)
- **Installation scripts** for easy deployment
- **Drop scripts** for cleanup and rollback
- **Seed data** templates for testing
- **Multi-tenant** compatible (tenant schema aware)
- **Indexes** for optimal performance
- **Documentation** for each script set

## Best Practices

### Module Naming
- Use **kebab-case** for module IDs (e.g., `user-profile`)
- Use **PascalCase** for component names (e.g., `UserProfile`)
- Use **camelCase** for variable names (e.g., `userProfile`)

### File Organization
- Keep components reusable and focused
- Follow the established naming conventions
- Use TypeScript for type safety
- Include proper error handling
- Add comprehensive documentation

### Development Workflow
1. Generate module with the script
2. Register the module manually
3. Implement TODO items (Edit, View, Delete)
4. Add proper validation and error handling
5. Write tests
6. Update documentation

## Extending the Generator

The `create-module.js` script can be customized to:
- Add more page templates (Edit, View, Delete)
- Include additional form fields
- Generate test files
- Add more complex relationships
- Customize API endpoints
- Add different UI patterns

## Contributing

When adding new features to the generator:
1. Update templates with new patterns
2. Maintain backward compatibility
3. Update this README
4. Test with different module configurations
5. Update the registration guide if needed

## Examples

### Simple CRUD Module
```bash
npm run create-module
# Enter: product-catalog, Product Catalog, Manage product inventory...
```

### System Module
```bash
npm run create-module
# Enter: audit-log, Audit Log, System audit trail, System...
```

### Business Module
```bash
npm run create-module
# Enter: customer-orders, Customer Orders, Order management system, Business...
```

Each generates a fully functional starting point that can be extended based on specific requirements.