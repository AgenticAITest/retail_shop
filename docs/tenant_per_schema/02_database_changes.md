# Phase 2: Database Infrastructure Changes

## Task 2.1: Update Drizzle Configuration

### 1. Modify `drizzle.config.ts`

Update the Drizzle configuration to support schema-based tenancy:

```typescript
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: [
    './src/server/lib/db/schema/shared/*.ts',   // Shared tables (tenant registry, etc.)
    './src/server/lib/db/schema/tenant/*.ts',   // Tenant-specific tables template
    './src/modules/*/server/lib/db/schemas/*.ts' // Module schemas
  ],
  dialect: 'postgresql',
  verbose: true,
  strict: true,
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    table: 'drizzle_migrations',
    schema: 'public', // Keep migrations in public schema
    prefix: 'timestamp'
  },
  // Add schema configuration for multi-schema support
  schemaFilter: ['public', 'tenant_*'],
  tablesFilter: ['!drizzle_*'], // Exclude drizzle internal tables
});
```

### 2. Environment Variables Update

Add new environment variables for schema management:

```env
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/react_admin
DATABASE_POOL_SIZE=20
DATABASE_SCHEMA_PREFIX=tenant_

# Tenant Management
DEFAULT_TENANT_SCHEMA=tenant_system
SHARED_SCHEMA=public
MAX_TENANT_SCHEMAS=100

# Migration Settings  
MIGRATION_TIMEOUT=300000
ENABLE_SCHEMA_MIGRATIONS=true
```

## Task 2.2: Restructure Database Schema Files

### 1. Create New Directory Structure

```bash
src/server/lib/db/schema/
├── shared/           # Tables that stay in public schema
│   ├── index.ts
│   ├── tenant-registry.ts
│   └── module-registry.ts
├── tenant/           # Template for tenant-specific tables  
│   ├── index.ts
│   ├── system.ts     # User, Role, Permission tables without tenant_id
│   └── demo.ts       # Demo tables without tenant_id
└── migrations/       # Schema migration utilities
    ├── create-tenant-schema.ts
    └── migrate-tenant-data.ts
```

### 2. Create Shared Schema (`shared/tenant-registry.ts`)

```typescript
import { relations } from 'drizzle-orm';
import { pgTable, timestamp, uniqueIndex, uuid, varchar, boolean } from 'drizzle-orm/pg-core';

// This table remains in public schema to manage all tenants
export const tenant = pgTable('sys_tenant', {
  id: uuid('id').primaryKey(),
  code: varchar('code', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 255 }),
  schemaName: varchar('schema_name', { length: 255 }).notNull().unique(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("tenant_code_idx").on(t.code),
  uniqueIndex("tenant_schema_idx").on(t.schemaName),
]);

export type Tenant = typeof tenant.$inferSelect;
export type InsertTenant = typeof tenant.$inferInsert;
```

### 3. Create Shared Schema (`shared/module-registry.ts`)

```typescript
import { relations } from 'drizzle-orm';
import { boolean, pgTable, timestamp, uuid, varchar, text, jsonb } from 'drizzle-orm/pg-core';

// Module registry stays in public schema as it's shared across tenants
export const moduleRegistry = pgTable('module_registry', {
  id: uuid('id').primaryKey(),
  moduleId: varchar('module_id', { length: 255 }).notNull().unique(),
  moduleName: varchar('module_name', { length: 255 }).notNull(),
  version: varchar('version', { length: 50 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  isGlobal: boolean('is_global').default(false).notNull(), // Global vs tenant-specific
  metadata: jsonb('metadata'), // Module configuration
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

// Module authorization per tenant - stays in public schema
export const moduleAuthorization = pgTable('module_authorization', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenant.id),
  moduleId: varchar('module_id', { length: 255 }).notNull()
    .references(() => moduleRegistry.moduleId),
  isEnabled: boolean('is_enabled').default(true).notNull(),
  configuration: jsonb('configuration'), // Tenant-specific module config
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("module_auth_unique_idx").on(t.tenantId, t.moduleId),
]);

export type ModuleRegistry = typeof moduleRegistry.$inferSelect;
export type ModuleAuthorization = typeof moduleAuthorization.$inferSelect;
```

### 4. Create Tenant Schema Template (`tenant/system.ts`)

```typescript
import { relations } from 'drizzle-orm';
import { boolean, pgTable, primaryKey, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

// Remove tenant_id columns from all tables - schema provides tenant context
export const user = pgTable('sys_user', {
  id: uuid('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullname: varchar('fullname', { length: 255 }).notNull(),
  status: varchar('status', { length: 255, enum: ["active", "inactive"] }).notNull(),
  email: varchar('email', { length: 255 }),
  avatar: varchar('avatar', { length: 255 }),
  // Removed: activeTenantId - no longer needed with schema separation
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const role = pgTable('sys_role', {
  id: uuid('id').primaryKey(),
  code: varchar('code', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 255 }),
  isSystem: boolean('is_system').notNull(),
  // Removed: tenantId - schema provides tenant context
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const permission = pgTable('sys_permission', {
  id: uuid('id').primaryKey(),
  code: varchar('code', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 255 }),
  // Removed: tenantId - schema provides tenant context
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const option = pgTable('sys_option', {
  id: uuid('id').primaryKey(),
  code: varchar('code', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  value: varchar('value', { length: 255 }).notNull(),
  // Removed: tenantId - schema provides tenant context
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

// Junction tables also lose tenant_id since they're in tenant schema
export const userRole = pgTable('sys_user_role', {
  userId: uuid('user_id').notNull().references(() => user.id),
  roleId: uuid('role_id').notNull().references(() => role.id),
}, (t) => [
  primaryKey({ columns: [t.userId, t.roleId] })
]);

export const rolePermission = pgTable('sys_role_permission', {
  roleId: uuid('role_id').notNull().references(() => role.id),
  permissionId: uuid('permission_id').notNull().references(() => permission.id),
}, (t) => [
  primaryKey({ columns: [t.roleId, t.permissionId] })
]);

// Relations updated - removed tenant relations
export const userRelations = relations(user, ({ many }) => ({
  roles: many(userRole),
}));

export const roleRelations = relations(role, ({ many }) => ({
  users: many(userRole),
  permissions: many(rolePermission)
}));

export const permissionRelations = relations(permission, ({ many }) => ({
  roles: many(rolePermission),
}));

export const userRoleRelations = relations(userRole, ({ one }) => ({
  role: one(role, {
    fields: [userRole.roleId],
    references: [role.id],
  }),
  user: one(user, {
    fields: [userRole.userId],
    references: [user.id],
  }),
}));

export const rolePermissionRelations = relations(rolePermission, ({ one }) => ({
  role: one(role, {
    fields: [rolePermission.roleId],
    references: [role.id],
  }),
  permission: one(permission, {
    fields: [rolePermission.permissionId],
    references: [permission.id],
  }),
}));

// Type exports
export type User = typeof user.$inferSelect;
export type Role = typeof role.$inferSelect;
export type Permission = typeof permission.$inferSelect;
export type Option = typeof option.$inferSelect;
export type UserRole = typeof userRole.$inferSelect;
export type RolePermission = typeof rolePermission.$inferSelect;
```

### 5. Update Schema Index Files

**`shared/index.ts`:**
```typescript
export * from './tenant-registry';
export * from './module-registry';
```

**`tenant/index.ts`:**
```typescript
export * from './system';
export * from './demo';
```

**Main `schema/index.ts`:**
```typescript
// Export both shared and tenant schemas
export * from './shared';
export * from './tenant';
```

## Task 2.3: Database Connection Management

### 1. Create Tenant Connection Manager

Create `src/server/lib/db/tenant-connection-manager.ts`:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as sharedSchema from './schema/shared';
import * as tenantSchema from './schema/tenant';

interface TenantConnection {
  db: ReturnType<typeof drizzle>;
  schema: string;
  tenantCode: string;
}

interface ConnectionConfig {
  maxConnections: number;
  idleTimeout: number;
  connectionTimeout: number;
}

class TenantConnectionManager {
  private connections: Map<string, TenantConnection> = new Map();
  private config: ConnectionConfig;

  constructor(config?: Partial<ConnectionConfig>) {
    this.config = {
      maxConnections: 20,
      idleTimeout: 300, // 5 minutes
      connectionTimeout: 30, // 30 seconds
      ...config
    };
  }

  async getConnection(tenantCode: string): Promise<TenantConnection> {
    const cacheKey = tenantCode.toLowerCase();
    
    if (this.connections.has(cacheKey)) {
      return this.connections.get(cacheKey)!;
    }

    const schemaName = `tenant_${cacheKey}`;
    
    // Ensure schema exists
    await this.ensureSchemaExists(schemaName);
    
    // Create connection with schema-specific search path
    const client = postgres(process.env.DATABASE_URL!, {
      max: this.config.maxConnections,
      idle_timeout: this.config.idleTimeout,
      connect_timeout: this.config.connectionTimeout,
      onnotice: () => {}, // Silence notices
      transform: {
        undefined: null
      },
      // Set search path to tenant schema first, then public
      options: `search_path=${schemaName},public`
    });
    
    const db = drizzle(client, { 
      schema: { ...sharedSchema, ...tenantSchema },
      logger: process.env.NODE_ENV === 'development'
    });
    
    const connection: TenantConnection = { 
      db, 
      schema: schemaName, 
      tenantCode: cacheKey 
    };
    
    this.connections.set(cacheKey, connection);
    return connection;
  }

  async getSharedConnection() {
    const client = postgres(process.env.DATABASE_URL!, {
      max: this.config.maxConnections,
      options: 'search_path=public'
    });
    
    return drizzle(client, { 
      schema: sharedSchema,
      logger: process.env.NODE_ENV === 'development' 
    });
  }

  private async ensureSchemaExists(schemaName: string) {
    const publicClient = postgres(process.env.DATABASE_URL!);
    
    try {
      // Check if schema exists
      const result = await publicClient`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name = ${schemaName}
      `;
      
      if (result.length === 0) {
        throw new Error(`Schema ${schemaName} does not exist. Create tenant first.`);
      }
    } finally {
      await publicClient.end();
    }
  }

  async createTenantSchema(tenantCode: string): Promise<string> {
    const schemaName = `tenant_${tenantCode.toLowerCase()}`;
    const client = postgres(process.env.DATABASE_URL!);
    
    try {
      // Create schema
      await client`CREATE SCHEMA IF NOT EXISTS ${client(schemaName)}`;
      
      // Run tenant-specific migrations
      await this.runTenantMigrations(schemaName);
      
      return schemaName;
    } finally {
      await client.end();
    }
  }

  private async runTenantMigrations(schemaName: string) {
    // This will be implemented in the migration phase
    // For now, we'll create the tables manually
    const client = postgres(process.env.DATABASE_URL!, {
      options: `search_path=${schemaName}`
    });
    
    try {
      // Run migration SQL to create tables in the tenant schema
      // This will be populated with actual table creation SQL
      console.log(`Creating tables in schema: ${schemaName}`);
      // Implementation will be added in Task 2.4
    } finally {
      await client.end();
    }
  }

  async closeTenantConnection(tenantCode: string) {
    const connection = this.connections.get(tenantCode.toLowerCase());
    if (connection) {
      // Close the connection (postgres-js handles this automatically)
      this.connections.delete(tenantCode.toLowerCase());
    }
  }

  async closeAllConnections() {
    this.connections.clear();
    // postgres-js will handle connection cleanup
  }

  getTenantList(): string[] {
    return Array.from(this.connections.keys());
  }
}

export const tenantConnectionManager = new TenantConnectionManager({
  maxConnections: parseInt(process.env.DATABASE_POOL_SIZE || '20'),
  idleTimeout: 300,
  connectionTimeout: 30
});
```

### 2. Update Main Database Connection

Update `src/server/lib/db/index.ts`:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Main connection for shared/public schema operations
const client = postgres(process.env.DATABASE_URL!, {
  max: parseInt(process.env.DATABASE_POOL_SIZE || '20'),
  idle_timeout: 300,
  connect_timeout: 30,
  options: 'search_path=public'
});

export const db = drizzle(client, { 
  schema,
  logger: process.env.NODE_ENV === 'development'
});

// Export tenant connection manager
export { tenantConnectionManager } from './tenant-connection-manager';

// Export schema types
export * from './schema';
```

## Task 2.4: Create Schema Migration Utilities

### 1. Create Schema Creation Script

Create `src/server/lib/db/migrations/create-tenant-schema.ts`:

```typescript
import postgres from 'postgres';

export async function createTenantSchemaSQL(schemaName: string): Promise<string[]> {
  return [
    `CREATE SCHEMA IF NOT EXISTS ${schemaName};`,
    
    `CREATE TABLE ${schemaName}.sys_user (
      id UUID PRIMARY KEY,
      username VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      fullname VARCHAR(255) NOT NULL,
      status VARCHAR(255) NOT NULL CHECK (status IN ('active', 'inactive')),
      email VARCHAR(255),
      avatar VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    
    `CREATE TABLE ${schemaName}.sys_role (
      id UUID PRIMARY KEY,
      code VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      description VARCHAR(255),
      is_system BOOLEAN NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    
    `CREATE TABLE ${schemaName}.sys_permission (
      id UUID PRIMARY KEY,
      code VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      description VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    
    `CREATE TABLE ${schemaName}.sys_option (
      id UUID PRIMARY KEY,
      code VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      value VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    
    `CREATE TABLE ${schemaName}.sys_user_role (
      user_id UUID NOT NULL REFERENCES ${schemaName}.sys_user(id),
      role_id UUID NOT NULL REFERENCES ${schemaName}.sys_role(id),
      PRIMARY KEY (user_id, role_id)
    );`,
    
    `CREATE TABLE ${schemaName}.sys_role_permission (
      role_id UUID NOT NULL REFERENCES ${schemaName}.sys_role(id),
      permission_id UUID NOT NULL REFERENCES ${schemaName}.sys_permission(id),
      PRIMARY KEY (role_id, permission_id)
    );`,
    
    // Add indexes
    `CREATE INDEX idx_${schemaName.replace('tenant_', '')}_user_username ON ${schemaName}.sys_user(username);`,
    `CREATE INDEX idx_${schemaName.replace('tenant_', '')}_role_code ON ${schemaName}.sys_role(code);`,
    `CREATE INDEX idx_${schemaName.replace('tenant_', '')}_permission_code ON ${schemaName}.sys_permission(code);`,
    
    // Add update triggers for updated_at
    `CREATE OR REPLACE FUNCTION update_updated_at_column()
     RETURNS TRIGGER AS $$
     BEGIN
       NEW.updated_at = NOW();
       RETURN NEW;
     END;
     $$ language 'plpgsql';`,
     
    `CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON ${schemaName}.sys_user
     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`,
     
    `CREATE TRIGGER update_role_updated_at BEFORE UPDATE ON ${schemaName}.sys_role
     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`,
     
    `CREATE TRIGGER update_permission_updated_at BEFORE UPDATE ON ${schemaName}.sys_permission  
     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`,
     
    `CREATE TRIGGER update_option_updated_at BEFORE UPDATE ON ${schemaName}.sys_option
     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
  ];
}

export async function createTenantSchema(tenantCode: string): Promise<void> {
  const schemaName = `tenant_${tenantCode.toLowerCase()}`;
  const client = postgres(process.env.DATABASE_URL!);
  
  try {
    const sqlStatements = await createTenantSchemaSQL(schemaName);
    
    for (const sql of sqlStatements) {
      await client.unsafe(sql);
    }
    
    console.log(`✅ Created schema: ${schemaName}`);
  } catch (error) {
    console.error(`❌ Error creating schema ${schemaName}:`, error);
    throw error;
  } finally {
    await client.end();
  }
}
```

## Next Steps

After completing Phase 2:

1. ✅ Test schema creation in development environment
2. ✅ Validate connection manager functionality  
3. ✅ Run schema generation with new structure
4. ✅ Verify no breaking changes in existing functionality
5. ➡️ Proceed to [Phase 3: Application Layer Changes](./03_application_changes.md)

## Checklist

- [ ] Drizzle config updated for multi-schema support
- [ ] Directory structure reorganized (shared vs tenant)
- [ ] Shared schema created (tenant registry, module registry)
- [ ] Tenant schema template created (without tenant_id columns)  
- [ ] Tenant connection manager implemented
- [ ] Schema creation utilities built
- [ ] Database migrations prepared
- [ ] Connection pooling configured
- [ ] Error handling implemented
- [ ] Development environment tested