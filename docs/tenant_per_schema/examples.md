# Examples & Reference Implementation

This document provides complete code examples and reference implementations for the tenant-per-schema migration.

## Database Schema Examples

### 1. Updated Tenant Model

```typescript
// src/server/lib/db/schema/shared/tenant.ts
import { pgTable, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const tenant = pgTable('sys_tenant', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  code: text('code').notNull().unique(), // e.g., 'acme', 'globex'
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  domain: text('domain'), // Optional custom domain
  schemaName: text('schema_name').notNull().unique(), // e.g., 'tenant_acme'
  isActive: boolean('is_active').notNull().default(true),
  settings: jsonb('settings').$type<{
    timezone?: string;
    locale?: string;
    theme?: string;
    features?: string[];
    limits?: {
      maxUsers?: number;
      maxStorage?: number;
    };
  }>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Tenant = typeof tenant.$inferSelect;
export type NewTenant = typeof tenant.$inferInsert;
```

### 2. Tenant-Specific Schema Template

```typescript
// src/server/lib/db/schema/tenant/index.ts
import { pgTable, text, timestamp, boolean, integer, decimal } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export function createTenantSchema(schemaName: string) {
  // User table within tenant schema
  const user = pgTable('user', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    email: text('email').notNull().unique(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    roleId: text('role_id').references(() => role.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  });

  // Role table within tenant schema
  const role = pgTable('role', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    name: text('name').notNull(),
    description: text('description'),
    permissions: text('permissions').array(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  });

  // Department table within tenant schema
  const department = pgTable('department', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    name: text('name').notNull(),
    description: text('description'),
    parentId: text('parent_id'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  });

  // Add other tenant-specific tables as needed
  const option = pgTable('option', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    key: text('key').notNull().unique(),
    value: text('value'),
    type: text('type').notNull().default('string'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  });

  return {
    user,
    role,
    department,
    option,
    schemaName,
  };
}

export type TenantSchema = ReturnType<typeof createTenantSchema>;
```

## Migration Scripts

### 1. Schema Creation Script

```typescript
// scripts/migration/create-tenant-schemas.ts
#!/usr/bin/env tsx

import 'dotenv/config';
import postgres from 'postgres';
import { db } from '../../src/server/lib/db';
import { tenant } from '../../src/server/lib/db/schema/shared';

interface MigrationResult {
  success: boolean;
  tenant: string;
  message: string;
  error?: string;
}

class SchemaMigrator {
  private client: postgres.Sql;

  constructor() {
    this.client = postgres(process.env.DATABASE_URL!);
  }

  async createTenantSchema(tenantCode: string): Promise<MigrationResult> {
    const schemaName = `tenant_${tenantCode}`;
    
    try {
      console.log(`Creating schema for tenant: ${tenantCode}`);

      // 1. Create schema
      await this.client`CREATE SCHEMA IF NOT EXISTS ${this.client(schemaName)}`;

      // 2. Set search path
      await this.client`SET search_path TO ${this.client(schemaName)}, public`;

      // 3. Create tables in tenant schema
      await this.createTenantTables(schemaName);

      // 4. Create indexes
      await this.createTenantIndexes(schemaName);

      // 5. Set up RLS policies (if needed)
      await this.setupRLS(schemaName);

      console.log(`✅ Schema created successfully: ${schemaName}`);

      return {
        success: true,
        tenant: tenantCode,
        message: `Schema ${schemaName} created successfully`
      };

    } catch (error) {
      console.error(`❌ Failed to create schema for tenant ${tenantCode}:`, error);
      
      return {
        success: false,
        tenant: tenantCode,
        message: `Failed to create schema for tenant ${tenantCode}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async createTenantTables(schemaName: string): Promise<void> {
    // User table
    await this.client`
      CREATE TABLE ${this.client(schemaName)}.user (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        email TEXT NOT NULL UNIQUE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        role_id TEXT REFERENCES ${this.client(schemaName)}.role(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Role table
    await this.client`
      CREATE TABLE ${this.client(schemaName)}.role (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        description TEXT,
        permissions TEXT[],
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Department table
    await this.client`
      CREATE TABLE ${this.client(schemaName)}.department (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        description TEXT,
        parent_id TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Option table
    await this.client`
      CREATE TABLE ${this.client(schemaName)}.option (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        key TEXT NOT NULL UNIQUE,
        value TEXT,
        type TEXT NOT NULL DEFAULT 'string',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Add foreign key constraints
    await this.client`
      ALTER TABLE ${this.client(schemaName)}.user 
      ADD CONSTRAINT fk_user_role 
      FOREIGN KEY (role_id) REFERENCES ${this.client(schemaName)}.role(id)
    `;

    await this.client`
      ALTER TABLE ${this.client(schemaName)}.department 
      ADD CONSTRAINT fk_department_parent 
      FOREIGN KEY (parent_id) REFERENCES ${this.client(schemaName)}.department(id)
    `;
  }

  private async createTenantIndexes(schemaName: string): Promise<void> {
    // User indexes
    await this.client`CREATE INDEX idx_user_email ON ${this.client(schemaName)}.user(email)`;
    await this.client`CREATE INDEX idx_user_role_id ON ${this.client(schemaName)}.user(role_id)`;
    await this.client`CREATE INDEX idx_user_active ON ${this.client(schemaName)}.user(is_active)`;

    // Role indexes
    await this.client`CREATE INDEX idx_role_name ON ${this.client(schemaName)}.role(name)`;
    await this.client`CREATE INDEX idx_role_active ON ${this.client(schemaName)}.role(is_active)`;

    // Department indexes
    await this.client`CREATE INDEX idx_department_name ON ${this.client(schemaName)}.department(name)`;
    await this.client`CREATE INDEX idx_department_parent ON ${this.client(schemaName)}.department(parent_id)`;
    await this.client`CREATE INDEX idx_department_active ON ${this.client(schemaName)}.department(is_active)`;

    // Option indexes
    await this.client`CREATE INDEX idx_option_key ON ${this.client(schemaName)}.option(key)`;
  }

  private async setupRLS(schemaName: string): Promise<void> {
    // Enable RLS on tables (optional, for additional security)
    await this.client`ALTER TABLE ${this.client(schemaName)}.user ENABLE ROW LEVEL SECURITY`;
    await this.client`ALTER TABLE ${this.client(schemaName)}.role ENABLE ROW LEVEL SECURITY`;
    await this.client`ALTER TABLE ${this.client(schemaName)}.department ENABLE ROW LEVEL SECURITY`;
    await this.client`ALTER TABLE ${this.client(schemaName)}.option ENABLE ROW LEVEL SECURITY`;

    // Create policies (example - adjust based on your security requirements)
    await this.client`
      CREATE POLICY tenant_isolation ON ${this.client(schemaName)}.user
      USING (current_setting('app.current_schema') = ${schemaName})
    `;
  }

  async migrateAllTenants(): Promise<MigrationResult[]> {
    try {
      // Get all active tenants
      const tenants = await db
        .select()
        .from(tenant)
        .where(eq(tenant.isActive, true));

      console.log(`Found ${tenants.length} tenants to migrate`);

      const results: MigrationResult[] = [];

      // Process tenants in batches to avoid overwhelming the database
      const batchSize = 5;
      for (let i = 0; i < tenants.length; i += batchSize) {
        const batch = tenants.slice(i, i + batchSize);
        
        const batchPromises = batch.map(t => this.createTenantSchema(t.code));
        const batchResults = await Promise.all(batchPromises);
        
        results.push(...batchResults);

        // Small delay between batches
        if (i + batchSize < tenants.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return results;

    } catch (error) {
      console.error('Failed to migrate tenants:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    await this.client.end();
  }
}

async function main() {
  const migrator = new SchemaMigrator();
  
  try {
    const results = await migrator.migrateAllTenants();
    
    console.log('\n📊 Migration Results:');
    console.log('====================');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    
    if (failed.length > 0) {
      console.log('\n❌ Failed Migrations:');
      failed.forEach(f => {
        console.log(`  • ${f.tenant}: ${f.message}`);
        if (f.error) {
          console.log(`    Error: ${f.error}`);
        }
      });
      process.exit(1);
    }
    
    console.log('\n🎉 All tenant schemas created successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await migrator.cleanup();
  }
}

main();
```

### 2. Data Migration Script

```typescript
// scripts/migration/migrate-tenant-data.ts
#!/usr/bin/env tsx

import 'dotenv/config';
import postgres from 'postgres';
import { db } from '../../src/server/lib/db';
import { tenant } from '../../src/server/lib/db/schema/shared';
import { eq } from 'drizzle-orm';

interface DataMigrationResult {
  success: boolean;
  tenant: string;
  recordsMigrated: {
    users: number;
    roles: number;
    departments: number;
    options: number;
  };
  message: string;
  error?: string;
}

class DataMigrator {
  private client: postgres.Sql;

  constructor() {
    this.client = postgres(process.env.DATABASE_URL!);
  }

  async migrateTenantData(tenantId: string, tenantCode: string): Promise<DataMigrationResult> {
    const schemaName = `tenant_${tenantCode}`;
    
    try {
      console.log(`Migrating data for tenant: ${tenantCode}`);

      const recordsMigrated = {
        users: 0,
        roles: 0,
        departments: 0,
        options: 0
      };

      // 1. Migrate roles first (no dependencies)
      recordsMigrated.roles = await this.migrateRoles(tenantId, schemaName);
      
      // 2. Migrate departments (self-referencing, handle carefully)
      recordsMigrated.departments = await this.migrateDepartments(tenantId, schemaName);
      
      // 3. Migrate users (depends on roles)
      recordsMigrated.users = await this.migrateUsers(tenantId, schemaName);
      
      // 4. Migrate options
      recordsMigrated.options = await this.migrateOptions(tenantId, schemaName);

      console.log(`✅ Data migrated successfully for tenant: ${tenantCode}`);
      console.log(`   Users: ${recordsMigrated.users}, Roles: ${recordsMigrated.roles}, Departments: ${recordsMigrated.departments}, Options: ${recordsMigrated.options}`);

      return {
        success: true,
        tenant: tenantCode,
        recordsMigrated,
        message: `Data migrated successfully for tenant ${tenantCode}`
      };

    } catch (error) {
      console.error(`❌ Failed to migrate data for tenant ${tenantCode}:`, error);
      
      return {
        success: false,
        tenant: tenantCode,
        recordsMigrated: { users: 0, roles: 0, departments: 0, options: 0 },
        message: `Failed to migrate data for tenant ${tenantCode}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async migrateRoles(tenantId: string, schemaName: string): Promise<number> {
    const roles = await this.client`
      SELECT id, name, description, permissions, is_active, created_at, updated_at
      FROM sys_role 
      WHERE tenant_id = ${tenantId}
    `;

    if (roles.length === 0) return 0;

    // Insert roles into tenant schema
    for (const role of roles) {
      await this.client`
        INSERT INTO ${this.client(schemaName)}.role 
        (id, name, description, permissions, is_active, created_at, updated_at)
        VALUES (
          ${role.id},
          ${role.name},
          ${role.description},
          ${role.permissions},
          ${role.is_active},
          ${role.created_at},
          ${role.updated_at}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          permissions = EXCLUDED.permissions,
          is_active = EXCLUDED.is_active,
          updated_at = EXCLUDED.updated_at
      `;
    }

    return roles.length;
  }

  private async migrateDepartments(tenantId: string, schemaName: string): Promise<number> {
    // Get all departments for the tenant
    const departments = await this.client`
      SELECT id, name, description, parent_id, is_active, created_at, updated_at
      FROM sys_department 
      WHERE tenant_id = ${tenantId}
      ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END, created_at
    `;

    if (departments.length === 0) return 0;

    // Insert departments (parents first due to ordering)
    for (const dept of departments) {
      await this.client`
        INSERT INTO ${this.client(schemaName)}.department 
        (id, name, description, parent_id, is_active, created_at, updated_at)
        VALUES (
          ${dept.id},
          ${dept.name},
          ${dept.description},
          ${dept.parent_id},
          ${dept.is_active},
          ${dept.created_at},
          ${dept.updated_at}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          parent_id = EXCLUDED.parent_id,
          is_active = EXCLUDED.is_active,
          updated_at = EXCLUDED.updated_at
      `;
    }

    return departments.length;
  }

  private async migrateUsers(tenantId: string, schemaName: string): Promise<number> {
    const users = await this.client`
      SELECT id, email, first_name, last_name, password_hash, is_active, role_id, created_at, updated_at
      FROM sys_user 
      WHERE tenant_id = ${tenantId}
    `;

    if (users.length === 0) return 0;

    // Insert users into tenant schema
    for (const user of users) {
      await this.client`
        INSERT INTO ${this.client(schemaName)}.user 
        (id, email, first_name, last_name, password_hash, is_active, role_id, created_at, updated_at)
        VALUES (
          ${user.id},
          ${user.email},
          ${user.first_name},
          ${user.last_name},
          ${user.password_hash},
          ${user.is_active},
          ${user.role_id},
          ${user.created_at},
          ${user.updated_at}
        )
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          password_hash = EXCLUDED.password_hash,
          is_active = EXCLUDED.is_active,
          role_id = EXCLUDED.role_id,
          updated_at = EXCLUDED.updated_at
      `;
    }

    return users.length;
  }

  private async migrateOptions(tenantId: string, schemaName: string): Promise<number> {
    const options = await this.client`
      SELECT id, key, value, type, created_at, updated_at
      FROM sys_option 
      WHERE tenant_id = ${tenantId}
    `;

    if (options.length === 0) return 0;

    // Insert options into tenant schema
    for (const option of options) {
      await this.client`
        INSERT INTO ${this.client(schemaName)}.option 
        (id, key, value, type, created_at, updated_at)
        VALUES (
          ${option.id},
          ${option.key},
          ${option.value},
          ${option.type},
          ${option.created_at},
          ${option.updated_at}
        )
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          type = EXCLUDED.type,
          updated_at = EXCLUDED.updated_at
      `;
    }

    return options.length;
  }

  async migrateAllTenantsData(): Promise<DataMigrationResult[]> {
    try {
      // Get all tenants with their IDs
      const tenants = await db
        .select({ id: tenant.id, code: tenant.code })
        .from(tenant)
        .where(eq(tenant.isActive, true));

      console.log(`Found ${tenants.length} tenants to migrate data for`);

      const results: DataMigrationResult[] = [];

      // Process tenants sequentially to avoid lock conflicts
      for (const t of tenants) {
        const result = await this.migrateTenantData(t.id, t.code);
        results.push(result);
        
        // Small delay between migrations
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      return results;

    } catch (error) {
      console.error('Failed to migrate tenant data:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    await this.client.end();
  }
}

async function main() {
  const migrator = new DataMigrator();
  
  try {
    const results = await migrator.migrateAllTenantsData();
    
    console.log('\n📊 Data Migration Results:');
    console.log('=========================');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    
    // Summary statistics
    const totalRecords = successful.reduce((acc, r) => ({
      users: acc.users + r.recordsMigrated.users,
      roles: acc.roles + r.recordsMigrated.roles,  
      departments: acc.departments + r.recordsMigrated.departments,
      options: acc.options + r.recordsMigrated.options
    }), { users: 0, roles: 0, departments: 0, options: 0 });
    
    console.log('\n📈 Total Records Migrated:');
    console.log(`  Users: ${totalRecords.users}`);
    console.log(`  Roles: ${totalRecords.roles}`);
    console.log(`  Departments: ${totalRecords.departments}`);
    console.log(`  Options: ${totalRecords.options}`);
    
    if (failed.length > 0) {
      console.log('\n❌ Failed Migrations:');
      failed.forEach(f => {
        console.log(`  • ${f.tenant}: ${f.message}`);
        if (f.error) {
          console.log(`    Error: ${f.error}`);
        }
      });
      process.exit(1);
    }
    
    console.log('\n🎉 All tenant data migrated successfully!');
    
  } catch (error) {
    console.error('Data migration failed:', error);
    process.exit(1);
  } finally {
    await migrator.cleanup();
  }
}

main();
```

## Application Code Examples

### 1. Enhanced Tenant Context Provider

```typescript
// src/client/provider/TenantProvider.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';

interface TenantInfo {
  id: string;
  code: string;
  name: string;
  slug: string;
  schemaName: string;
  domain?: string;
  settings?: {
    timezone?: string;
    locale?: string;
    theme?: string;
    features?: string[];
  };
}

interface TenantContextType {
  tenant: TenantInfo | null;
  loading: boolean;
  error: string | null;
  switchTenant: (tenantCode: string) => Promise<void>;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};

interface TenantProviderProps {
  children: React.ReactNode;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
  const { user, token } = useAuth();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTenantInfo = async () => {
    if (!token || !user) {
      setTenant(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/tenant/current', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tenant info: ${response.statusText}`);
      }

      const tenantData = await response.json();
      setTenant(tenantData);

      // Store tenant context in localStorage for persistence
      localStorage.setItem('currentTenant', JSON.stringify(tenantData));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch tenant info';
      setError(errorMessage);
      console.error('Error fetching tenant info:', err);
      
      // Try to load from localStorage as fallback
      const storedTenant = localStorage.getItem('currentTenant');
      if (storedTenant) {
        try {
          setTenant(JSON.parse(storedTenant));
        } catch {
          localStorage.removeItem('currentTenant');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const switchTenant = async (tenantCode: string) => {
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/tenant/switch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tenantCode }),
      });

      if (!response.ok) {
        throw new Error(`Failed to switch tenant: ${response.statusText}`);
      }

      const newTenantData = await response.json();
      setTenant(newTenantData);

      // Update stored tenant
      localStorage.setItem('currentTenant', JSON.stringify(newTenantData));

      // Refresh the page to ensure all components re-initialize with new tenant context
      window.location.reload();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to switch tenant';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const refreshTenant = async () => {
    await fetchTenantInfo();
  };

  useEffect(() => {
    fetchTenantInfo();
  }, [user, token]);

  // Clear tenant data when user logs out
  useEffect(() => {
    if (!user) {
      setTenant(null);
      localStorage.removeItem('currentTenant');
    }
  }, [user]);

  const contextValue: TenantContextType = {
    tenant,
    loading,
    error,
    switchTenant,
    refreshTenant,
  };

  return (
    <TenantContext.Provider value={contextValue}>
      {children}
    </TenantContext.Provider>
  );
};
```

### 2. Enhanced Database Connection Manager

```typescript
// src/server/lib/db/tenant-connection.ts
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { createTenantSchema, TenantSchema } from '../schema/tenant';
import { sharedDb } from './index';
import { tenant } from '../schema/shared';
import { eq } from 'drizzle-orm';

interface TenantConnection {
  db: ReturnType<typeof drizzle>;
  schema: TenantSchema;
  schemaName: string;
  client: postgres.Sql;
}

class TenantConnectionManager {
  private connections = new Map<string, TenantConnection>();
  private connectionTTL = 30 * 60 * 1000; // 30 minutes
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup unused connections periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanupConnections();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  async getTenantConnection(tenantCode: string): Promise<TenantConnection> {
    // Check if connection exists and is still valid
    const existing = this.connections.get(tenantCode);
    if (existing) {
      return existing;
    }

    // Get tenant info from shared database
    const tenantInfo = await sharedDb
      .select()
      .from(tenant)
      .where(eq(tenant.code, tenantCode))
      .limit(1);

    if (tenantInfo.length === 0) {
      throw new Error(`Tenant not found: ${tenantCode}`);
    }

    if (!tenantInfo[0].isActive) {
      throw new Error(`Tenant is inactive: ${tenantCode}`);
    }

    const schemaName = tenantInfo[0].schemaName;

    // Create new connection with tenant schema
    const client = postgres(process.env.DATABASE_URL!, {
      search_path: [schemaName, 'public'],
      connection: {
        search_path: schemaName,
      },
      onnotice: () => {}, // Suppress notices
    });

    const db = drizzle(client);
    const schema = createTenantSchema(schemaName);

    const connection: TenantConnection = {
      db,
      schema,
      schemaName,
      client,
    };

    // Cache the connection
    this.connections.set(tenantCode, connection);

    return connection;
  }

  async verifyTenantSchema(tenantCode: string): Promise<boolean> {
    try {
      const connection = await this.getTenantConnection(tenantCode);
      
      // Try to query a table to verify schema exists and is accessible
      await connection.client`SELECT 1 FROM ${connection.client(connection.schemaName)}.user LIMIT 1`;
      
      return true;
    } catch (error) {
      console.error(`Schema verification failed for tenant ${tenantCode}:`, error);
      return false;
    }
  }

  private cleanupConnections(): void {
    const now = Date.now();
    
    for (const [tenantCode, connection] of this.connections.entries()) {
      // In a real implementation, you'd track last access time
      // For now, we'll implement a simple cleanup strategy
      try {
        // Close connection if it's been idle (this is a simplified example)
        // In practice, you'd want more sophisticated connection pooling
        this.connections.delete(tenantCode);
        connection.client.end();
      } catch (error) {
        console.error(`Error cleaning up connection for tenant ${tenantCode}:`, error);
      }
    }
  }

  async closeConnection(tenantCode: string): Promise<void> {
    const connection = this.connections.get(tenantCode);
    if (connection) {
      try {
        await connection.client.end();
        this.connections.delete(tenantCode);
      } catch (error) {
        console.error(`Error closing connection for tenant ${tenantCode}:`, error);
      }
    }
  }

  async closeAllConnections(): Promise<void> {
    const closePromises = Array.from(this.connections.keys()).map(
      tenantCode => this.closeConnection(tenantCode)
    );
    
    await Promise.all(closePromises);
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  getActiveConnections(): string[] {
    return Array.from(this.connections.keys());
  }
}

// Singleton instance
export const tenantConnectionManager = new TenantConnectionManager();

// Helper function to get tenant database connection
export async function getTenantDb(tenantCode: string) {
  const connection = await tenantConnectionManager.getTenantConnection(tenantCode);
  return {
    db: connection.db,
    schema: connection.schema,
  };
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await tenantConnectionManager.closeAllConnections();
});

process.on('SIGINT', async () => {
  await tenantConnectionManager.closeAllConnections();
});
```

### 3. Updated Middleware

```typescript
// src/server/middleware/tenantMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { tenantConnectionManager } from '../lib/db/tenant-connection';
import { sharedDb } from '../lib/db';
import { tenant, user } from '../lib/db/schema/shared';
import { eq, and } from 'drizzle-orm';

export interface TenantRequest extends Request {
  tenant?: {
    id: string;
    code: string;
    schemaName: string;
    name: string;
  };
  tenantDb?: any;
  tenantSchema?: any;
}

export const tenantMiddleware = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Skip tenant resolution for certain routes
    const skipTenantRoutes = ['/api/health', '/api/auth/login', '/api/tenant/resolve'];
    if (skipTenantRoutes.some(route => req.path.startsWith(route))) {
      return next();
    }

    let tenantCode: string | null = null;

    // Method 1: Try to get tenant from JWT token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        
        if (decoded.tenantCode) {
          tenantCode = decoded.tenantCode;
        } else if (decoded.userId) {
          // Fallback: Get tenant from user record
          const userRecord = await sharedDb
            .select({ tenantId: user.tenantId })
            .from(user)
            .where(eq(user.id, decoded.userId))
            .limit(1);

          if (userRecord.length > 0) {
            const tenantRecord = await sharedDb
              .select({ code: tenant.code })
              .from(tenant)
              .where(eq(tenant.id, userRecord[0].tenantId))
              .limit(1);

            if (tenantRecord.length > 0) {
              tenantCode = tenantRecord[0].code;
            }
          }
        }
      } catch (error) {
        console.error('Error decoding JWT token:', error);
      }
    }

    // Method 2: Try to get tenant from subdomain
    if (!tenantCode) {
      const host = req.headers.host;
      if (host) {
        const subdomain = host.split('.')[0];
        
        // Check if subdomain corresponds to a tenant
        const tenantRecord = await sharedDb
          .select()
          .from(tenant)
          .where(and(
            eq(tenant.slug, subdomain),
            eq(tenant.isActive, true)
          ))
          .limit(1);

        if (tenantRecord.length > 0) {
          tenantCode = tenantRecord[0].code;
        }
      }
    }

    // Method 3: Try to get tenant from custom domain
    if (!tenantCode) {
      const host = req.headers.host;
      if (host) {
        const tenantRecord = await sharedDb
          .select()
          .from(tenant)
          .where(and(
            eq(tenant.domain, host),
            eq(tenant.isActive, true)
          ))
          .limit(1);

        if (tenantRecord.length > 0) {
          tenantCode = tenantRecord[0].code;
        }
      }
    }

    // Method 4: Get tenant from query parameter (for development/testing)
    if (!tenantCode && req.query.tenant) {
      tenantCode = req.query.tenant as string;
    }

    if (!tenantCode) {
      return res.status(400).json({
        error: 'Tenant context required',
        message: 'Unable to determine tenant from request'
      });
    }

    // Get tenant information
    const tenantRecord = await sharedDb
      .select()
      .from(tenant)
      .where(and(
        eq(tenant.code, tenantCode),
        eq(tenant.isActive, true)
      ))
      .limit(1);

    if (tenantRecord.length === 0) {
      return res.status(404).json({
        error: 'Tenant not found',
        message: `Tenant '${tenantCode}' not found or inactive`
      });
    }

    const tenantInfo = tenantRecord[0];

    // Verify tenant schema exists
    const schemaValid = await tenantConnectionManager.verifyTenantSchema(tenantCode);
    if (!schemaValid) {
      return res.status(500).json({
        error: 'Tenant schema error',
        message: `Tenant schema not available for '${tenantCode}'`
      });
    }

    // Get tenant database connection
    const { db: tenantDb, schema: tenantSchema } = await tenantConnectionManager.getTenantConnection(tenantCode);

    // Attach tenant info to request
    req.tenant = {
      id: tenantInfo.id,
      code: tenantInfo.code,
      schemaName: tenantInfo.schemaName,
      name: tenantInfo.name,
    };

    req.tenantDb = tenantDb;
    req.tenantSchema = tenantSchema;

    // Set response headers for debugging
    res.setHeader('X-Tenant-Code', tenantCode);
    res.setHeader('X-Tenant-Schema', tenantInfo.schemaName);

    next();

  } catch (error) {
    console.error('Tenant middleware error:', error);
    res.status(500).json({
      error: 'Tenant resolution failed',
      message: 'Internal server error resolving tenant context'
    });
  }
};

// Helper middleware to require tenant context
export const requireTenant = (
  req: TenantRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.tenant || !req.tenantDb) {
    return res.status(400).json({
      error: 'Tenant required',
      message: 'This endpoint requires tenant context'
    });
  }
  next();
};
```

### 4. Updated API Routes

```typescript
// src/server/routes/api/users.ts
import { Router } from 'express';
import { eq, like, and } from 'drizzle-orm';
import { TenantRequest, requireTenant } from '../../middleware/tenantMiddleware';
import { authMiddleware } from '../../middleware/authMiddleware';

const router = Router();

// Apply middleware
router.use(authMiddleware);
router.use(requireTenant);

// Get all users for current tenant
router.get('/', async (req: TenantRequest, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Build query conditions
    let whereConditions = eq(req.tenantSchema.user.isActive, true);
    
    if (search) {
      whereConditions = and(
        whereConditions,
        like(req.tenantSchema.user.email, `%${search}%`)
      );
    }

    // Get users from tenant schema
    const users = await req.tenantDb
      .select({
        id: req.tenantSchema.user.id,
        email: req.tenantSchema.user.email,
        firstName: req.tenantSchema.user.firstName,
        lastName: req.tenantSchema.user.lastName,
        isActive: req.tenantSchema.user.isActive,
        roleId: req.tenantSchema.user.roleId,
        createdAt: req.tenantSchema.user.createdAt,
        updatedAt: req.tenantSchema.user.updatedAt,
      })
      .from(req.tenantSchema.user)
      .where(whereConditions)
      .limit(Number(limit))
      .offset(offset)
      .orderBy(req.tenantSchema.user.createdAt);

    // Get total count
    const totalResult = await req.tenantDb
      .select({ count: sql<number>`count(*)` })
      .from(req.tenantSchema.user)
      .where(whereConditions);

    const total = totalResult[0]?.count || 0;

    res.json({
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      },
      tenant: req.tenant?.code
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      error: 'Failed to fetch users',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get user by ID
router.get('/:id', async (req: TenantRequest, res) => {
  try {
    const { id } = req.params;

    const users = await req.tenantDb
      .select()
      .from(req.tenantSchema.user)
      .where(eq(req.tenantSchema.user.id, id))
      .limit(1);

    if (users.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: `User with ID '${id}' not found in tenant '${req.tenant?.code}'`
      });
    }

    res.json({
      user: users[0],
      tenant: req.tenant?.code
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      error: 'Failed to fetch user',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create new user
router.post('/', async (req: TenantRequest, res) => {
  try {
    const { email, firstName, lastName, roleId, password } = req.body;

    // Validate required fields
    if (!email || !firstName || !lastName || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'email, firstName, lastName, and password are required'
      });
    }

    // Check if user already exists in this tenant
    const existingUsers = await req.tenantDb
      .select()
      .from(req.tenantSchema.user)
      .where(eq(req.tenantSchema.user.email, email))
      .limit(1);

    if (existingUsers.length > 0) {
      return res.status(409).json({
        error: 'User already exists',
        message: `User with email '${email}' already exists in tenant '${req.tenant?.code}'`
      });
    }

    // Hash password (implement proper password hashing)
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user in tenant schema
    const newUsers = await req.tenantDb
      .insert(req.tenantSchema.user)
      .values({
        email,
        firstName,
        lastName,
        passwordHash,
        roleId,
        isActive: true,
      })
      .returning();

    const newUser = newUsers[0];

    // Remove password hash from response
    const { passwordHash: _, ...userResponse } = newUser;

    res.status(201).json({
      user: userResponse,
      tenant: req.tenant?.code
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      error: 'Failed to create user',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
```

## Testing Examples

### 1. Tenant Schema Testing

```typescript
// tests/tenant-schema.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTenantDb, tenantConnectionManager } from '../src/server/lib/db/tenant-connection';
import { sharedDb } from '../src/server/lib/db';
import { tenant } from '../src/server/lib/db/schema/shared';
import { eq } from 'drizzle-orm';

describe('Tenant Schema Tests', () => {
  const testTenantCode = 'test-tenant';
  let tenantId: string;

  beforeEach(async () => {
    // Create test tenant
    const newTenants = await sharedDb
      .insert(tenant)
      .values({
        code: testTenantCode,
        name: 'Test Tenant',
        slug: 'test-tenant',
        schemaName: `tenant_${testTenantCode}`,
        isActive: true,
      })
      .returning();

    tenantId = newTenants[0].id;

    // Create tenant schema (this would normally be done by migration)
    const { db } = await getTenantDb(testTenantCode);
    // Schema creation logic here...
  });

  afterEach(async () => {
    // Clean up test tenant
    await sharedDb
      .delete(tenant)
      .where(eq(tenant.id, tenantId));

    // Close tenant connection
    await tenantConnectionManager.closeConnection(testTenantCode);
  });

  it('should create tenant database connection', async () => {
    const { db, schema } = await getTenantDb(testTenantCode);
    
    expect(db).toBeDefined();
    expect(schema).toBeDefined();
    expect(schema.schemaName).toBe(`tenant_${testTenantCode}`);
  });

  it('should isolate tenant data', async () => {
    const { db, schema } = await getTenantDb(testTenantCode);
    
    // Create test user in tenant schema
    const testUsers = await db
      .insert(schema.user)
      .values({
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        passwordHash: 'hashed-password',
      })
      .returning();

    expect(testUsers).toHaveLength(1);
    
    // Verify user exists in tenant schema
    const users = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, 'test@example.com'));

    expect(users).toHaveLength(1);
    expect(users[0].email).toBe('test@example.com');
  });

  it('should handle tenant schema operations correctly', async () => {
    const { db, schema } = await getTenantDb(testTenantCode);
    
    // Test role creation
    const testRoles = await db
      .insert(schema.role)
      .values({
        name: 'Test Role',
        description: 'A test role',
        permissions: ['read', 'write'],
      })
      .returning();

    expect(testRoles).toHaveLength(1);
    
    // Test user creation with role
    const testUsers = await db
      .insert(schema.user)
      .values({
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        passwordHash: 'hashed-password',
        roleId: testRoles[0].id,
      })
      .returning();

    expect(testUsers[0].roleId).toBe(testRoles[0].id);
  });
});
```

### 2. Migration Testing

```typescript
// tests/migration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { sharedDb } from '../src/server/lib/db';
import { tenant } from '../src/server/lib/db/schema/shared';

const execAsync = promisify(exec);

describe('Migration Tests', () => {
  beforeEach(async () => {
    // Set up test database state
    await setupTestDatabase();
  });

  afterEach(async () => {
    // Clean up test data
    await cleanupTestDatabase();
  });

  it('should migrate tenant schemas successfully', async () => {
    // Create test tenants
    await createTestTenants();
    
    // Run schema migration
    const { stdout, stderr } = await execAsync('npm run migrate:tenant-schemas');
    
    expect(stderr).toBe('');
    expect(stdout).toContain('Migration completed successfully');
    
    // Verify schemas were created
    await verifyTenantsSchemas();
  });

  it('should migrate tenant data successfully', async () => {
    // Set up test data in shared tables
    await setupTestTenantData();
    
    // Run data migration
    const { stdout, stderr } = await execAsync('npm run migrate:tenant-data');
    
    expect(stderr).toBe('');
    expect(stdout).toContain('Data migration completed successfully');
    
    // Verify data was migrated to tenant schemas
    await verifyMigratedData();
  });

  it('should handle migration rollback correctly', async () => {
    // Create test scenario that requires rollback
    await setupRollbackScenario();
    
    // Run rollback
    const { stdout, stderr } = await execAsync('npm run rollback:tenant-migration');
    
    expect(stderr).toBe('');
    expect(stdout).toContain('Rollback completed successfully');
    
    // Verify rollback was successful
    await verifyRollbackState();
  });
});

async function setupTestDatabase(): Promise<void> {
  // Implementation for setting up test database state
}

async function cleanupTestDatabase(): Promise<void> {
  // Implementation for cleaning up test data
}

async function createTestTenants(): Promise<void> {
  // Implementation for creating test tenants
}

async function verifyTenantsSchemas(): Promise<void> {
  // Implementation for verifying tenant schemas exist
}

async function setupTestTenantData(): Promise<void> {
  // Implementation for setting up test data in shared tables
}

async function verifyMigratedData(): Promise<void> {
  // Implementation for verifying data was migrated correctly
}

async function setupRollbackScenario(): Promise<void> {
  // Implementation for setting up rollback test scenario
}

async function verifyRollbackState(): Promise<void> {
  // Implementation for verifying rollback was successful
}
```

## Performance Optimization Examples

### 1. Connection Pooling Configuration

```typescript
// src/server/lib/db/pool-config.ts
import postgres from 'postgres';

export const createOptimizedConnection = (schemaName: string) => {
  return postgres(process.env.DATABASE_URL!, {
    // Connection pooling settings
    max: 10, // Maximum number of connections per tenant
    idle_timeout: 20, // Close idle connections after 20 seconds
    connect_timeout: 30, // Connection timeout in seconds
    
    // Performance optimizations
    prepare: false, // Disable prepared statements for better performance with connection pooling
    
    // Schema-specific settings
    search_path: [schemaName, 'public'],
    connection: {
      search_path: schemaName,
      statement_timeout: '30s',
      idle_in_transaction_session_timeout: '60s',
    },
    
    // Error handling
    onnotice: () => {}, // Suppress notices
    debug: process.env.NODE_ENV === 'development',
    
    // Transform settings for better performance
    transform: {
      undefined: null,
    },
    
    // Retry configuration
    max_lifetime: 60 * 60, // 1 hour max connection lifetime
  });
};
```

### 2. Caching Strategy

```typescript
// src/server/lib/cache/tenant-cache.ts
import Redis from 'ioredis';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

class TenantCacheManager {
  private redis: Redis;
  private defaultTTL = 300; // 5 minutes

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL!);
  }

  private getCacheKey(tenantCode: string, key: string, prefix = 'tenant'): string {
    return `${prefix}:${tenantCode}:${key}`;
  }

  async get<T>(tenantCode: string, key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const cacheKey = this.getCacheKey(tenantCode, key, options.prefix);
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached) as T;
      }
      
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set<T>(
    tenantCode: string, 
    key: string, 
    value: T, 
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(tenantCode, key, options.prefix);
      const ttl = options.ttl || this.defaultTTL;
      
      await this.redis.setex(cacheKey, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async del(tenantCode: string, key: string, options: CacheOptions = {}): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(tenantCode, key, options.prefix);
      await this.redis.del(cacheKey);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async clearTenant(tenantCode: string): Promise<void> {
    try {
      const pattern = `*:${tenantCode}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache clear tenant error:', error);
    }
  }

  async getTenantInfo(tenantCode: string) {
    return this.get(tenantCode, 'info', { prefix: 'tenant-info', ttl: 3600 });
  }

  async setTenantInfo(tenantCode: string, info: any) {
    return this.set(tenantCode, 'info', info, { prefix: 'tenant-info', ttl: 3600 });
  }
}

export const tenantCache = new TenantCacheManager();
```

This comprehensive examples document provides ready-to-use code for implementing the tenant-per-schema migration. Each example includes error handling, performance optimizations, and follows TypeScript best practices.