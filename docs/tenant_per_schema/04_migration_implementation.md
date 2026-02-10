# Phase 4: Migration Implementation & Data Transfer

## Task 4.1: Create Data Migration Scripts

### 1. Create Migration Utility Classes

Create `src/server/migrations/tenant-schema/MigrationManager.ts`:

```typescript
import postgres from 'postgres';
import { db } from '../../lib/db';
import { tenantConnectionManager } from '../../lib/db/tenant-connection-manager';
import { tenant } from '../../lib/db/schema/shared';
import { 
  user, role, permission, option, userRole, rolePermission 
} from '../../lib/db/schema/system'; // Old schema with tenant_id
import { eq, and } from 'drizzle-orm';
import { createTenantSchema } from '../../lib/db/migrations/create-tenant-schema';

interface MigrationStats {
  tenantsProcessed: number;
  usersTransferred: number;
  rolesTransferred: number;
  permissionsTransferred: number;
  optionsTransferred: number;
  userRolesTransferred: number;
  rolePermissionsTransferred: number;
  errors: string[];
  startTime: Date;
  endTime?: Date;
}

interface TenantMigrationResult {
  tenantCode: string;
  success: boolean;
  stats: {
    users: number;
    roles: number;
    permissions: number;
    options: number;
    userRoles: number;
    rolePermissions: number;
  };
  error?: string;
}

export class TenantSchemaMigrationManager {
  private stats: MigrationStats = {
    tenantsProcessed: 0,
    usersTransferred: 0,
    rolesTransferred: 0,
    permissionsTransferred: 0,
    optionsTransferred: 0,
    userRolesTransferred: 0,
    rolePermissionsTransferred: 0,
    errors: [],
    startTime: new Date()
  };

  async runFullMigration(): Promise<MigrationStats> {
    console.log('🚀 Starting tenant-per-schema migration...');
    
    try {
      // 1. Get all tenants from shared database
      const tenants = await db.select().from(tenant);
      console.log(`📋 Found ${tenants.length} tenants to migrate`);

      // 2. Migrate each tenant
      for (const tenantRecord of tenants) {
        console.log(`\n🏢 Migrating tenant: ${tenantRecord.name} (${tenantRecord.code})`);
        
        try {
          const result = await this.migrateTenant(tenantRecord);
          
          if (result.success) {
            this.stats.tenantsProcessed++;
            this.stats.usersTransferred += result.stats.users;
            this.stats.rolesTransferred += result.stats.roles;
            this.stats.permissionsTransferred += result.stats.permissions;
            this.stats.optionsTransferred += result.stats.options;
            this.stats.userRolesTransferred += result.stats.userRoles;
            this.stats.rolePermissionsTransferred += result.stats.rolePermissions;
            
            console.log(`✅ Successfully migrated tenant: ${tenantRecord.code}`);
          } else {
            this.stats.errors.push(`Tenant ${tenantRecord.code}: ${result.error}`);
            console.error(`❌ Failed to migrate tenant: ${tenantRecord.code} - ${result.error}`);
          }
        } catch (error) {
          const errorMsg = `Tenant ${tenantRecord.code}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          this.stats.errors.push(errorMsg);
          console.error(`❌ Migration error for tenant ${tenantRecord.code}:`, error);
        }
      }

      this.stats.endTime = new Date();
      
      // 3. Print final statistics
      this.printMigrationSummary();
      
      return this.stats;

    } catch (error) {
      console.error('💥 Fatal migration error:', error);
      this.stats.errors.push(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.stats.endTime = new Date();
      throw error;
    }
  }

  private async migrateTenant(tenantRecord: any): Promise<TenantMigrationResult> {
    const tenantCode = tenantRecord.code;
    const tenantId = tenantRecord.id;

    try {
      // 1. Create tenant schema
      await createTenantSchema(tenantCode);

      // 2. Get tenant database connection
      const connection = await tenantConnectionManager.getConnection(tenantCode);

      // 3. Migrate data tables
      const users = await this.migrateUsers(tenantId, connection.db);
      const roles = await this.migrateRoles(tenantId, connection.db);
      const permissions = await this.migratePermissions(tenantId, connection.db);
      const options = await this.migrateOptions(tenantId, connection.db);
      const userRoles = await this.migrateUserRoles(tenantId, connection.db);
      const rolePermissions = await this.migrateRolePermissions(tenantId, connection.db);

      // 4. Migrate module-specific data
      await this.migrateModuleData(tenantId, connection.db);

      return {
        tenantCode,
        success: true,
        stats: {
          users,
          roles,
          permissions,
          options,
          userRoles,
          rolePermissions
        }
      };

    } catch (error) {
      return {
        tenantCode,
        success: false,
        stats: { users: 0, roles: 0, permissions: 0, options: 0, userRoles: 0, rolePermissions: 0 },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async migrateUsers(tenantId: string, tenantDb: any): Promise<number> {
    // Get users for this tenant from old schema
    const usersData = await db
      .select({
        id: user.id,
        username: user.username,
        passwordHash: user.passwordHash,
        fullname: user.fullname,
        status: user.status,
        email: user.email,
        avatar: user.avatar,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      })
      .from(user)
      .where(eq(user.activeTenantId, tenantId));

    if (usersData.length === 0) return 0;

    // Insert into new tenant schema (without tenant_id)
    await tenantDb.insert(user).values(
      usersData.map(userData => ({
        id: userData.id,
        username: userData.username,
        passwordHash: userData.passwordHash,
        fullname: userData.fullname,
        status: userData.status,
        email: userData.email,
        avatar: userData.avatar,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt
      }))
    );

    return usersData.length;
  }

  private async migrateRoles(tenantId: string, tenantDb: any): Promise<number> {
    const rolesData = await db
      .select({
        id: role.id,
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt
      })
      .from(role)
      .where(eq(role.tenantId, tenantId));

    if (rolesData.length === 0) return 0;

    await tenantDb.insert(role).values(
      rolesData.map(roleData => ({
        id: roleData.id,
        code: roleData.code,
        name: roleData.name,
        description: roleData.description,
        isSystem: roleData.isSystem,
        createdAt: roleData.createdAt,
        updatedAt: roleData.updatedAt
      }))
    );

    return rolesData.length;
  }

  private async migratePermissions(tenantId: string, tenantDb: any): Promise<number> {
    const permissionsData = await db
      .select({
        id: permission.id,
        code: permission.code,
        name: permission.name,
        description: permission.description,
        createdAt: permission.createdAt,
        updatedAt: permission.updatedAt
      })
      .from(permission)
      .where(eq(permission.tenantId, tenantId));

    if (permissionsData.length === 0) return 0;

    await tenantDb.insert(permission).values(
      permissionsData.map(permissionData => ({
        id: permissionData.id,
        code: permissionData.code,
        name: permissionData.name,
        description: permissionData.description,
        createdAt: permissionData.createdAt,
        updatedAt: permissionData.updatedAt
      }))
    );

    return permissionsData.length;
  }

  private async migrateOptions(tenantId: string, tenantDb: any): Promise<number> {
    const optionsData = await db
      .select({
        id: option.id,
        code: option.code,
        name: option.name,
        value: option.value,
        createdAt: option.createdAt,
        updatedAt: option.updatedAt
      })
      .from(option)
      .where(eq(option.tenantId, tenantId));

    if (optionsData.length === 0) return 0;

    await tenantDb.insert(option).values(
      optionsData.map(optionData => ({
        id: optionData.id,
        code: optionData.code,
        name: optionData.name,
        value: optionData.value,
        createdAt: optionData.createdAt,
        updatedAt: optionData.updatedAt
      }))
    );

    return optionsData.length;
  }

  private async migrateUserRoles(tenantId: string, tenantDb: any): Promise<number> {
    const userRolesData = await db
      .select()
      .from(userRole)
      .where(eq(userRole.tenantId, tenantId));

    if (userRolesData.length === 0) return 0;

    await tenantDb.insert(userRole).values(
      userRolesData.map(userRoleData => ({
        userId: userRoleData.userId,
        roleId: userRoleData.roleId
      }))
    );

    return userRolesData.length;
  }

  private async migrateRolePermissions(tenantId: string, tenantDb: any): Promise<number> {
    const rolePermissionsData = await db
      .select()
      .from(rolePermission)
      .where(eq(rolePermission.tenantId, tenantId));

    if (rolePermissionsData.length === 0) return 0;

    await tenantDb.insert(rolePermission).values(
      rolePermissionsData.map(rolePermissionData => ({
        roleId: rolePermissionData.roleId,
        permissionId: rolePermissionData.permissionId
      }))
    );

    return rolePermissionsData.length;
  }

  private async migrateModuleData(tenantId: string, tenantDb: any): Promise<void> {
    // Migrate demo department data
    try {
      const departmentsData = await db.query.demoDepartment.findMany({
        where: (department, { eq }) => eq(department.tenantId, tenantId)
      });

      if (departmentsData.length > 0) {
        await tenantDb.insert(demoDepartment).values(
          departmentsData.map(dept => ({
            id: dept.id,
            code: dept.code,
            name: dept.name,
            description: dept.description,
            isActive: dept.isActive,
            createdAt: dept.createdAt,
            updatedAt: dept.updatedAt
          }))
        );
        console.log(`  📦 Migrated ${departmentsData.length} departments`);
      }
    } catch (error) {
      console.warn(`  ⚠️ Could not migrate department data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Migrate sample module data
    try {
      const sampleModuleData = await db.query.sampleModule.findMany({
        where: (sample, { eq }) => eq(sample.tenantId, tenantId)
      });

      if (sampleModuleData.length > 0) {
        await tenantDb.insert(sampleModule).values(
          sampleModuleData.map(sample => ({
            id: sample.id,
            name: sample.name,
            description: sample.description,
            isActive: sample.isActive,
            isPublic: sample.isPublic,
            createdAt: sample.createdAt,
            updatedAt: sample.updatedAt
          }))
        );
        console.log(`  📦 Migrated ${sampleModuleData.length} sample module records`);
      }
    } catch (error) {
      console.warn(`  ⚠️ Could not migrate sample module data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private printMigrationSummary(): void {
    const duration = this.stats.endTime 
      ? Math.round((this.stats.endTime.getTime() - this.stats.startTime.getTime()) / 1000)
      : 0;

    console.log('\n🎉 Migration Summary');
    console.log('==================');
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`🏢 Tenants processed: ${this.stats.tenantsProcessed}`);
    console.log(`👤 Users transferred: ${this.stats.usersTransferred}`);
    console.log(`🛡️  Roles transferred: ${this.stats.rolesTransferred}`);
    console.log(`🔐 Permissions transferred: ${this.stats.permissionsTransferred}`);
    console.log(`⚙️  Options transferred: ${this.stats.optionsTransferred}`);
    console.log(`🔗 User-Role associations: ${this.stats.userRolesTransferred}`);
    console.log(`🔗 Role-Permission associations: ${this.stats.rolePermissionsTransferred}`);
    
    if (this.stats.errors.length > 0) {
      console.log(`\n❌ Errors (${this.stats.errors.length}):`);
      this.stats.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    } else {
      console.log('\n✅ No errors encountered!');
    }
  }
}
```

### 2. Create Migration CLI Script

Create `scripts/migrate-to-tenant-schemas.ts`:

```typescript
#!/usr/bin/env tsx

import 'dotenv/config';
import { TenantSchemaMigrationManager } from '../src/server/migrations/tenant-schema/MigrationManager';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function confirmMigration(): Promise<boolean> {
  return new Promise((resolve) => {
    console.log('⚠️  IMPORTANT: Tenant Schema Migration');
    console.log('=====================================');
    console.log('This will migrate from column-based tenancy to schema-based tenancy.');
    console.log('');
    console.log('📋 What this migration does:');
    console.log('  • Creates separate database schema for each tenant');
    console.log('  • Transfers data from shared tables to tenant schemas');  
    console.log('  • Removes tenant_id columns from data structures');
    console.log('');
    console.log('⚠️  Prerequisites:');
    console.log('  • Database backup completed');
    console.log('  • Application stopped');
    console.log('  • No active user sessions');
    console.log('');
    console.log('💾 Recommended: Create database backup before proceeding!');
    console.log('');

    rl.question('Do you want to proceed with the migration? (yes/no): ', (answer) => {
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function main() {
  try {
    const shouldProceed = await confirmMigration();
    
    if (!shouldProceed) {
      console.log('❌ Migration cancelled by user');
      process.exit(0);
    }

    console.log('\n🚀 Starting migration process...');
    
    const migrationManager = new TenantSchemaMigrationManager();
    const stats = await migrationManager.runFullMigration();

    if (stats.errors.length === 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('\n📝 Next steps:');
      console.log('  1. Update application code to use new schema structure');
      console.log('  2. Update environment configurations');
      console.log('  3. Test application thoroughly');
      console.log('  4. Deploy new code');
      console.log('  5. Clean up old tenant_id columns (after validation)');
      
      process.exit(0);
    } else {
      console.log('\n⚠️  Migration completed with errors!');
      console.log('Please review the errors above and fix any issues.');
      console.log('You may need to run cleanup and retry for failed tenants.');
      
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    console.log('\n🔄 Rollback may be required. Check your database backup.');
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
```

### 3. Create Validation Script

Create `scripts/validate-migration.ts`:

```typescript
#!/usr/bin/env tsx

import 'dotenv/config';
import { db } from '../src/server/lib/db';
import { tenantConnectionManager } from '../src/server/lib/db/tenant-connection-manager';
import { tenant } from '../src/server/lib/db/schema/shared';
import { user, role, permission } from '../src/server/lib/db/schema/tenant';
import { user as oldUser, role as oldRole, permission as oldPermission } from '../src/server/lib/db/schema/system';
import { eq, count } from 'drizzle-orm';

interface ValidationResult {
  tenantCode: string;
  success: boolean;
  issues: string[];
  counts: {
    old: { users: number; roles: number; permissions: number };
    new: { users: number; roles: number; permissions: number };
  };
}

class MigrationValidator {
  async validateAllTenants(): Promise<ValidationResult[]> {
    console.log('🔍 Validating tenant schema migration...\n');

    const tenants = await db.select().from(tenant);
    const results: ValidationResult[] = [];

    for (const tenantRecord of tenants) {
      console.log(`Validating tenant: ${tenantRecord.name} (${tenantRecord.code})`);
      const result = await this.validateTenant(tenantRecord);
      results.push(result);
      
      if (result.success) {
        console.log(`✅ Validation passed\n`);
      } else {
        console.log(`❌ Validation failed:`);
        result.issues.forEach(issue => console.log(`  - ${issue}`));
        console.log('');
      }
    }

    return results;
  }

  private async validateTenant(tenantRecord: any): Promise<ValidationResult> {
    const tenantCode = tenantRecord.code;
    const tenantId = tenantRecord.id;

    try {
      // Get old counts (from shared tables with tenant_id)
      const [oldUserCount] = await db
        .select({ count: count() })
        .from(oldUser)
        .where(eq(oldUser.activeTenantId, tenantId));

      const [oldRoleCount] = await db
        .select({ count: count() })
        .from(oldRole)
        .where(eq(oldRole.tenantId, tenantId));

      const [oldPermissionCount] = await db
        .select({ count: count() })
        .from(oldPermission)
        .where(eq(oldPermission.tenantId, tenantId));

      // Get new counts (from tenant schema)
      const connection = await tenantConnectionManager.getConnection(tenantCode);

      const [newUserCount] = await connection.db
        .select({ count: count() })
        .from(user);

      const [newRoleCount] = await connection.db
        .select({ count: count() })
        .from(role);

      const [newPermissionCount] = await connection.db
        .select({ count: count() })
        .from(permission);

      // Compare counts and identify issues
      const issues: string[] = [];

      if (oldUserCount.count !== newUserCount.count) {
        issues.push(`User count mismatch: ${oldUserCount.count} → ${newUserCount.count}`);
      }

      if (oldRoleCount.count !== newRoleCount.count) {
        issues.push(`Role count mismatch: ${oldRoleCount.count} → ${newRoleCount.count}`);
      }

      if (oldPermissionCount.count !== newPermissionCount.count) {
        issues.push(`Permission count mismatch: ${oldPermissionCount.count} → ${newPermissionCount.count}`);
      }

      // Additional validation: Check for orphaned records
      await this.validateDataIntegrity(connection.db, issues);

      return {
        tenantCode,
        success: issues.length === 0,
        issues,
        counts: {
          old: {
            users: oldUserCount.count,
            roles: oldRoleCount.count,
            permissions: oldPermissionCount.count
          },
          new: {
            users: newUserCount.count,
            roles: newRoleCount.count,
            permissions: newPermissionCount.count
          }
        }
      };

    } catch (error) {
      return {
        tenantCode,
        success: false,
        issues: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        counts: {
          old: { users: 0, roles: 0, permissions: 0 },
          new: { users: 0, roles: 0, permissions: 0 }
        }
      };
    }
  }

  private async validateDataIntegrity(tenantDb: any, issues: string[]): Promise<void> {
    try {
      // Check for users without roles (if this is unexpected)
      const usersWithoutRoles = await tenantDb.query.user.findMany({
        with: {
          roles: true
        }
      });

      const orphanedUsers = usersWithoutRoles.filter(user => user.roles.length === 0);
      if (orphanedUsers.length > 0) {
        issues.push(`${orphanedUsers.length} users have no roles assigned`);
      }

      // Check for roles without permissions (might be OK for some roles)
      const rolesWithoutPermissions = await tenantDb.query.role.findMany({
        with: {
          permissions: true
        }
      });

      const emptyRoles = rolesWithoutPermissions.filter(role => role.permissions.length === 0);
      if (emptyRoles.length > 0) {
        issues.push(`${emptyRoles.length} roles have no permissions assigned`);
      }

    } catch (error) {
      issues.push(`Integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  printSummary(results: ValidationResult[]): void {
    const totalTenants = results.length;
    const successfulTenants = results.filter(r => r.success).length;
    const failedTenants = results.filter(r => !r.success);

    console.log('📊 Migration Validation Summary');
    console.log('===============================');
    console.log(`Total tenants: ${totalTenants}`);
    console.log(`Successful validations: ${successfulTenants}`);
    console.log(`Failed validations: ${failedTenants.length}`);

    if (failedTenants.length > 0) {
      console.log('\n❌ Tenants with issues:');
      failedTenants.forEach(tenant => {
        console.log(`  • ${tenant.tenantCode}: ${tenant.issues.join(', ')}`);
      });
    }

    const totalCounts = results.reduce(
      (acc, result) => ({
        oldUsers: acc.oldUsers + result.counts.old.users,
        newUsers: acc.newUsers + result.counts.new.users,
        oldRoles: acc.oldRoles + result.counts.old.roles,
        newRoles: acc.newRoles + result.counts.new.roles,
        oldPermissions: acc.oldPermissions + result.counts.old.permissions,
        newPermissions: acc.newPermissions + result.counts.new.permissions
      }),
      { oldUsers: 0, newUsers: 0, oldRoles: 0, newRoles: 0, oldPermissions: 0, newPermissions: 0 }
    );

    console.log('\n📈 Data Transfer Summary:');
    console.log(`Users: ${totalCounts.oldUsers} → ${totalCounts.newUsers}`);
    console.log(`Roles: ${totalCounts.oldRoles} → ${totalCounts.newRoles}`);
    console.log(`Permissions: ${totalCounts.oldPermissions} → ${totalCounts.newPermissions}`);
  }
}

async function main() {
  try {
    const validator = new MigrationValidator();
    const results = await validator.validateAllTenants();
    
    validator.printSummary(results);

    const hasFailures = results.some(r => !r.success);
    if (hasFailures) {
      console.log('\n⚠️  Some validations failed. Please review and fix issues before proceeding.');
      process.exit(1);
    } else {
      console.log('\n✅ All validations passed! Migration appears successful.');
      process.exit(0);
    }

  } catch (error) {
    console.error('💥 Validation failed:', error);
    process.exit(1);
  }
}

main();
```

## Task 4.2: Create Tenant Management Services

### 1. Create Tenant Provisioning Service

Create `src/server/services/TenantProvisioningService.ts`:

```typescript
import { db } from '../lib/db';
import { tenantConnectionManager } from '../lib/db/tenant-connection-manager';
import { tenant, moduleAuthorization, moduleRegistry } from '../lib/db/schema/shared';
import { user, role, permission, rolePermission, userRole } from '../lib/db/schema/tenant';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

interface CreateTenantData {
  code: string;
  name: string;
  description?: string;
  adminUser: {
    username: string;
    fullname: string;
    email?: string;
    password: string;
  };
}

interface TenantProvisioningResult {
  success: boolean;
  tenantId?: string;
  schemaName?: string;
  adminUserId?: string;
  message?: string;
  error?: string;
}

export class TenantProvisioningService {
  async createTenant(data: CreateTenantData): Promise<TenantProvisioningResult> {
    try {
      const { code, name, description, adminUser } = data;

      // 1. Validate tenant code
      if (!this.isValidTenantCode(code)) {
        return {
          success: false,
          error: 'Invalid tenant code. Use lowercase letters, numbers, and hyphens only.'
        };
      }

      // 2. Check if tenant already exists
      const existingTenant = await db
        .select()
        .from(tenant)
        .where(eq(tenant.code, code))
        .limit(1);

      if (existingTenant.length > 0) {
        return {
          success: false,
          error: `Tenant with code '${code}' already exists`
        };
      }

      const schemaName = `tenant_${code}`;

      // 3. Create tenant record in shared schema
      const newTenant = await db
        .insert(tenant)
        .values({
          id: crypto.randomUUID(),
          code: code,
          name: name,
          description: description || null,
          schemaName: schemaName,
          isActive: true
        })
        .returning();

      const tenantId = newTenant[0].id;

      // 4. Create tenant schema and tables
      await tenantConnectionManager.createTenantSchema(code);

      // 5. Set up default data for tenant
      const adminUserId = await this.setupDefaultTenantData(code, adminUser);

      // 6. Set up default module authorizations
      await this.setupDefaultModuleAuthorizations(tenantId);

      return {
        success: true,
        tenantId,
        schemaName,
        adminUserId,
        message: `Tenant '${name}' created successfully`
      };

    } catch (error) {
      console.error('Error creating tenant:', error);
      return {
        success: false,
        error: `Failed to create tenant: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async setupDefaultTenantData(tenantCode: string, adminUser: any): Promise<string> {
    const connection = await tenantConnectionManager.getConnection(tenantCode);

    // Create default permissions
    const defaultPermissions = [
      { code: 'system.user.view', name: 'View Users', description: 'View user list and details' },
      { code: 'system.user.create', name: 'Create Users', description: 'Create new user accounts' },
      { code: 'system.user.edit', name: 'Edit Users', description: 'Edit user information' },
      { code: 'system.user.delete', name: 'Delete Users', description: 'Delete user accounts' },
      { code: 'system.role.view', name: 'View Roles', description: 'View role list and details' },
      { code: 'system.role.create', name: 'Create Roles', description: 'Create new roles' },
      { code: 'system.role.edit', name: 'Edit Roles', description: 'Edit role information' },
      { code: 'system.role.delete', name: 'Delete Roles', description: 'Delete roles' },
      { code: 'system.permission.view', name: 'View Permissions', description: 'View permission list' },
      { code: 'dashboard.view', name: 'View Dashboard', description: 'Access to dashboard' },
    ];

    const createdPermissions = await connection.db
      .insert(permission)
      .values(
        defaultPermissions.map(perm => ({
          id: crypto.randomUUID(),
          code: perm.code,
          name: perm.name,
          description: perm.description
        }))
      )
      .returning();

    // Create default roles
    const adminRole = await connection.db
      .insert(role)
      .values({
        id: crypto.randomUUID(),
        code: 'ADMIN',
        name: 'Administrator',
        description: 'Full system administrator',
        isSystem: true
      })
      .returning();

    const userRole = await connection.db
      .insert(role)
      .values({
        id: crypto.randomUUID(),
        code: 'USER',
        name: 'User',
        description: 'Regular user with limited access',
        isSystem: false
      })
      .returning();

    // Assign all permissions to admin role
    const adminRolePermissions = createdPermissions.map(perm => ({
      roleId: adminRole[0].id,
      permissionId: perm.id
    }));

    await connection.db
      .insert(rolePermission)
      .values(adminRolePermissions);

    // Assign basic permissions to user role
    const basicPermissions = createdPermissions.filter(perm => 
      ['dashboard.view', 'system.user.view'].includes(perm.code)
    );

    const userRolePermissions = basicPermissions.map(perm => ({
      roleId: userRole[0].id,
      permissionId: perm.id
    }));

    await connection.db
      .insert(rolePermission)
      .values(userRolePermissions);

    // Create admin user
    const passwordHash = await bcrypt.hash(adminUser.password, 10);

    const createdUser = await connection.db
      .insert(user)
      .values({
        id: crypto.randomUUID(),
        username: adminUser.username,
        fullname: adminUser.fullname,
        email: adminUser.email || null,
        passwordHash,
        status: 'active'
      })
      .returning();

    // Assign admin role to admin user
    await connection.db
      .insert(userRole)
      .values({
        userId: createdUser[0].id,
        roleId: adminRole[0].id
      });

    return createdUser[0].id;
  }

  private async setupDefaultModuleAuthorizations(tenantId: string): Promise<void> {
    // Get all available modules
    const modules = await db.select().from(moduleRegistry);

    // Enable all non-restricted modules by default
    const moduleAuths = modules
      .filter(module => !module.isGlobal) // Only enable tenant-specific modules
      .map(module => ({
        id: crypto.randomUUID(),
        tenantId,
        moduleId: module.moduleId,
        isEnabled: true,
        configuration: null
      }));

    if (moduleAuths.length > 0) {
      await db
        .insert(moduleAuthorization)
        .values(moduleAuths);
    }
  }

  private isValidTenantCode(code: string): boolean {
    // Only lowercase letters, numbers, and hyphens
    // Must start with letter, 3-50 characters
    const regex = /^[a-z][a-z0-9-]{2,49}$/;
    return regex.test(code);
  }

  async deactivateTenant(tenantCode: string): Promise<boolean> {
    try {
      await db
        .update(tenant)
        .set({ isActive: false })
        .where(eq(tenant.code, tenantCode));

      return true;
    } catch (error) {
      console.error('Error deactivating tenant:', error);
      return false;
    }
  }

  async reactivateTenant(tenantCode: string): Promise<boolean> {
    try {
      await db
        .update(tenant)
        .set({ isActive: true })
        .where(eq(tenant.code, tenantCode));

      return true;
    } catch (error) {
      console.error('Error reactivating tenant:', error);
      return false;
    }
  }

  async deleteTenant(tenantCode: string): Promise<TenantProvisioningResult> {
    try {
      // WARNING: This is destructive - should only be used in dev/test
      const schemaName = `tenant_${tenantCode}`;
      
      // 1. Drop the tenant schema (this removes all data!)
      const client = postgres(process.env.DATABASE_URL!);
      await client`DROP SCHEMA IF EXISTS ${client(schemaName)} CASCADE`;
      await client.end();

      // 2. Remove tenant record from shared database
      await db
        .delete(tenant)
        .where(eq(tenant.code, tenantCode));

      // 3. Clean up module authorizations
      await db
        .delete(moduleAuthorization)
        .where(eq(moduleAuthorization.tenantId, tenantCode));

      return {
        success: true,
        message: `Tenant '${tenantCode}' and all its data have been permanently deleted`
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to delete tenant: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}
```

## Task 4.3: Create Migration Rollback Scripts

### 1. Create Rollback Manager

Create `src/server/migrations/tenant-schema/RollbackManager.ts`:

```typescript
import postgres from 'postgres';
import { db } from '../../lib/db';
import { tenant } from '../../lib/db/schema/shared';

interface RollbackResult {
  success: boolean;
  message?: string;
  error?: string;
}

export class TenantSchemaRollbackManager {
  async rollbackMigration(): Promise<RollbackResult> {
    try {
      console.log('🔄 Starting rollback of tenant schema migration...');

      // 1. Get all tenant schemas
      const tenants = await db.select().from(tenant);
      
      console.log(`📋 Found ${tenants.length} tenant schemas to remove`);

      // 2. Drop all tenant schemas
      const client = postgres(process.env.DATABASE_URL!);
      
      for (const tenantRecord of tenants) {
        const schemaName = tenantRecord.schemaName;
        
        try {
          await client`DROP SCHEMA IF EXISTS ${client(schemaName)} CASCADE`;
          console.log(`✅ Dropped schema: ${schemaName}`);
        } catch (error) {
          console.error(`❌ Failed to drop schema ${schemaName}:`, error);
        }
      }

      await client.end();

      console.log('🎉 Rollback completed successfully!');
      console.log('📝 Manual steps required:');
      console.log('  1. Restore database from backup (if needed)');
      console.log('  2. Restart application with old code');
      console.log('  3. Verify all functionality works');

      return {
        success: true,
        message: 'Tenant schema rollback completed successfully'
      };

    } catch (error) {
      return {
        success: false,
        error: `Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}
```

### 2. Create Rollback CLI Script

Create `scripts/rollback-tenant-schemas.ts`:

```typescript
#!/usr/bin/env tsx

import 'dotenv/config';
import { TenantSchemaRollbackManager } from '../src/server/migrations/tenant-schema/RollbackManager';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function confirmRollback(): Promise<boolean> {
  return new Promise((resolve) => {
    console.log('⚠️  DANGER: Tenant Schema Rollback');
    console.log('==================================');
    console.log('This will PERMANENTLY DELETE all tenant schemas and data!');
    console.log('');
    console.log('💥 What this rollback does:');
    console.log('  • Drops all tenant_* schemas and their data');
    console.log('  • You will need to restore from backup to recover data');
    console.log('  • Old application code must be deployed to work');
    console.log('');
    console.log('🛑 ONLY proceed if:');
    console.log('  • Migration failed and needs to be reverted');
    console.log('  • You have a complete database backup');
    console.log('  • You are prepared to restore from backup');
    console.log('');

    rl.question('Type "ROLLBACK" to confirm this destructive action: ', (answer) => {
      resolve(answer === 'ROLLBACK');
    });
  });
}

async function main() {
  try {
    const shouldProceed = await confirmRollback();
    
    if (!shouldProceed) {
      console.log('❌ Rollback cancelled');
      process.exit(0);
    }

    console.log('\n🔄 Starting rollback process...');
    
    const rollbackManager = new TenantSchemaRollbackManager();
    const result = await rollbackManager.rollbackMigration();

    if (result.success) {
      console.log('\n✅ Rollback completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Rollback failed:', result.error);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Rollback error:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
```

## Task 4.4: Update Package.json Scripts

Add migration scripts to `package.json`:

```json
{
  "scripts": {
    "db:migrate-tenant-schemas": "tsx scripts/migrate-to-tenant-schemas.ts",
    "db:validate-migration": "tsx scripts/validate-migration.ts", 
    "db:rollback-tenant-schemas": "tsx scripts/rollback-tenant-schemas.ts",
    "db:create-tenant": "tsx scripts/create-tenant.ts"
  }
}
```

## Next Steps

After completing Phase 4:

1. ✅ Test migration scripts in development environment
2. ✅ Validate data integrity after migration  
3. ✅ Test rollback procedures
4. ✅ Create tenant provisioning workflows
5. ➡️ Proceed to [Phase 5: Testing & Deployment](./05_testing_deployment.md)

## Checklist

- [ ] Migration manager implemented with full data transfer
- [ ] Validation scripts created for data integrity checking
- [ ] Rollback manager implemented for emergency reversion
- [ ] Tenant provisioning service created
- [ ] CLI scripts created for all operations
- [ ] Package.json scripts added for easy execution
- [ ] Module data migration handled
- [ ] Error handling and logging implemented
- [ ] Development environment testing completed
- [ ] Migration documentation updated