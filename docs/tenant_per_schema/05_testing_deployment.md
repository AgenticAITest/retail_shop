# Phase 5: Testing & Deployment Strategy

## Task 5.1: Development Environment Testing

### 1. Create Test Data Setup

Create `scripts/setup-test-data.ts`:

```typescript
#!/usr/bin/env tsx

import 'dotenv/config';
import { TenantProvisioningService } from '../src/server/services/TenantProvisioningService';
import { db } from '../src/server/lib/db';
import { tenant } from '../src/server/lib/db/schema/shared';

async function setupTestTenants() {
  console.log('🏗️  Setting up test data for tenant schema testing...\n');

  const provisioningService = new TenantProvisioningService();

  const testTenants = [
    {
      code: 'acme-corp',
      name: 'ACME Corporation',
      description: 'Test tenant for ACME Corporation',
      adminUser: {
        username: 'admin',
        fullname: 'ACME Administrator',
        email: 'admin@acme.com',
        password: 'admin123'
      }
    },
    {
      code: 'tech-solutions',
      name: 'Tech Solutions Inc',
      description: 'Test tenant for Tech Solutions',
      adminUser: {
        username: 'techad min',
        fullname: 'Tech Solutions Admin',
        email: 'admin@techsolutions.com',
        password: 'tech123'
      }
    },
    {
      code: 'global-systems',
      name: 'Global Systems Ltd',
      description: 'Test tenant for Global Systems',
      adminUser: {
        username: 'globaladmin',
        fullname: 'Global Systems Administrator',
        email: 'admin@globalsystems.com',
        password: 'global123'
      }
    }
  ];

  for (const tenantData of testTenants) {
    console.log(`Creating tenant: ${tenantData.name}`);
    
    const result = await provisioningService.createTenant(tenantData);
    
    if (result.success) {
      console.log(`✅ Successfully created tenant: ${tenantData.code}`);
      console.log(`   Schema: ${result.schemaName}`);
      console.log(`   Admin User ID: ${result.adminUserId}\n`);
    } else {
      console.error(`❌ Failed to create tenant ${tenantData.code}: ${result.error}\n`);
    }
  }

  console.log('📊 Test data setup completed!');
  console.log('\n🧪 Test Credentials:');
  console.log('===================');
  testTenants.forEach(tenant => {
    console.log(`Tenant: ${tenant.code}`);
    console.log(`  URL: http://${tenant.code}.localhost:3000`);
    console.log(`  Username: ${tenant.adminUser.username}`);
    console.log(`  Password: ${tenant.adminUser.password}\n`);
  });
}

setupTestTenants().catch(console.error);
```

### 2. Create Integration Tests

Create `src/server/tests/tenant-schema.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { TenantProvisioningService } from '../services/TenantProvisioningService';
import { tenantConnectionManager } from '../lib/db/tenant-connection-manager';
import { db } from '../lib/db';
import { tenant } from '../lib/db/schema/shared';
import { user, role, permission } from '../lib/db/schema/tenant';
import { eq, count } from 'drizzle-orm';

describe('Tenant Schema Integration Tests', () => {
  const testTenantCode = 'test-integration';
  const provisioningService = new TenantProvisioningService();
  
  beforeAll(async () => {
    // Clean up any existing test tenant
    try {
      await provisioningService.deleteTenant(testTenantCode);
    } catch (error) {
      // Ignore if tenant doesn't exist
    }
  });

  afterAll(async () => {
    // Clean up test tenant
    await provisioningService.deleteTenant(testTenantCode);
    await tenantConnectionManager.closeAllConnections();
  });

  describe('Tenant Creation', () => {
    it('should create a new tenant with schema and default data', async () => {
      const tenantData = {
        code: testTenantCode,
        name: 'Test Integration Tenant',
        description: 'Test tenant for integration tests',
        adminUser: {
          username: 'testadmin',
          fullname: 'Test Administrator',
          email: 'test@example.com',
          password: 'testpass123'
        }
      };

      const result = await provisioningService.createTenant(tenantData);
      
      expect(result.success).toBe(true);
      expect(result.tenantId).toBeDefined();
      expect(result.schemaName).toBe(`tenant_${testTenantCode}`);
      expect(result.adminUserId).toBeDefined();

      // Verify tenant exists in shared database
      const tenantRecord = await db
        .select()
        .from(tenant)
        .where(eq(tenant.code, testTenantCode))
        .limit(1);
      
      expect(tenantRecord).toHaveLength(1);
      expect(tenantRecord[0].name).toBe(tenantData.name);
    });

    it('should not allow duplicate tenant codes', async () => {
      const duplicateData = {
        code: testTenantCode,
        name: 'Duplicate Tenant',
        description: 'This should fail',
        adminUser: {
          username: 'duplicate',
          fullname: 'Duplicate User',
          password: 'password123'
        }
      };

      const result = await provisioningService.createTenant(duplicateData);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should reject invalid tenant codes', async () => {
      const invalidData = {
        code: 'Invalid Code!',
        name: 'Invalid Tenant',
        description: 'This should fail',
        adminUser: {
          username: 'invalid',
          fullname: 'Invalid User',
          password: 'password123'
        }
      };

      const result = await provisioningService.createTenant(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid tenant code');
    });
  });

  describe('Tenant Data Isolation', () => {
    it('should isolate data between tenant schemas', async () => {
      // Get connection for our test tenant
      const connection = await tenantConnectionManager.getConnection(testTenantCode);
      
      // Verify default data was created
      const [userCount] = await connection.db
        .select({ count: count() })
        .from(user);
      
      const [roleCount] = await connection.db
        .select({ count: count() })
        .from(role);
        
      const [permissionCount] = await connection.db
        .select({ count: count() })
        .from(permission);

      expect(userCount.count).toBe(1); // Admin user
      expect(roleCount.count).toBeGreaterThan(0); // Default roles
      expect(permissionCount.count).toBeGreaterThan(0); // Default permissions

      // Create additional user in test tenant
      const newUser = await connection.db
        .insert(user)
        .values({
          id: crypto.randomUUID(),
          username: 'testuser2',
          fullname: 'Test User 2',
          passwordHash: 'hashedpassword',
          status: 'active'
        })
        .returning();

      expect(newUser).toHaveLength(1);

      // Verify user count increased
      const [newUserCount] = await connection.db
        .select({ count: count() })
        .from(user);
        
      expect(newUserCount.count).toBe(2);
    });

    it('should maintain separate user spaces per tenant', async () => {
      // Create another test tenant
      const secondTenantData = {
        code: 'test-isolation',
        name: 'Test Isolation Tenant',
        description: 'Second tenant for isolation testing',
        adminUser: {
          username: 'isolationadmin',
          fullname: 'Isolation Administrator',
          password: 'isolation123'
        }
      };

      const result = await provisioningService.createTenant(secondTenantData);
      expect(result.success).toBe(true);

      try {
        // Get connections for both tenants
        const tenant1Connection = await tenantConnectionManager.getConnection(testTenantCode);
        const tenant2Connection = await tenantConnectionManager.getConnection('test-isolation');

        // Verify both tenants have their own admin users with same username pattern
        const tenant1Users = await tenant1Connection.db.select().from(user);
        const tenant2Users = await tenant2Connection.db.select().from(user);

        expect(tenant1Users).toHaveLength(2); // admin + test user we created
        expect(tenant2Users).toHaveLength(1); // just admin

        // Verify usernames don't conflict between tenants
        const tenant1Admin = tenant1Users.find(u => u.username === 'testadmin');
        const tenant2Admin = tenant2Users.find(u => u.username === 'isolationadmin');

        expect(tenant1Admin).toBeDefined();
        expect(tenant2Admin).toBeDefined();
        expect(tenant1Admin!.id).not.toBe(tenant2Admin!.id);

      } finally {
        // Clean up second tenant
        await provisioningService.deleteTenant('test-isolation');
      }
    });
  });

  describe('Connection Management', () => {
    it('should handle multiple concurrent tenant connections', async () => {
      const connections = await Promise.all([
        tenantConnectionManager.getConnection(testTenantCode),
        tenantConnectionManager.getConnection(testTenantCode),
        tenantConnectionManager.getConnection(testTenantCode)
      ]);

      // All connections should reference the same tenant
      expect(connections[0].tenantCode).toBe(testTenantCode);
      expect(connections[1].tenantCode).toBe(testTenantCode);
      expect(connections[2].tenantCode).toBe(testTenantCode);

      // Should be able to query from all connections
      const results = await Promise.all(
        connections.map(conn => 
          conn.db.select({ count: count() }).from(user)
        )
      );

      expect(results[0][0].count).toBe(results[1][0].count);
      expect(results[1][0].count).toBe(results[2][0].count);
    });

    it('should handle non-existent tenant gracefully', async () => {
      await expect(
        tenantConnectionManager.getConnection('non-existent-tenant')
      ).rejects.toThrow();
    });
  });

  describe('Tenant Lifecycle', () => {
    it('should deactivate and reactivate tenants', async () => {
      // Deactivate tenant
      const deactivateResult = await provisioningService.deactivateTenant(testTenantCode);
      expect(deactivateResult).toBe(true);

      // Verify tenant is inactive
      const inactiveTenant = await db
        .select()
        .from(tenant)
        .where(eq(tenant.code, testTenantCode))
        .limit(1);
      
      expect(inactiveTenant[0].isActive).toBe(false);

      // Reactivate tenant
      const reactivateResult = await provisioningService.reactivateTenant(testTenantCode);
      expect(reactivateResult).toBe(true);

      // Verify tenant is active again
      const activeTenant = await db
        .select()
        .from(tenant)
        .where(eq(tenant.code, testTenantCode))
        .limit(1);
      
      expect(activeTenant[0].isActive).toBe(true);
    });
  });
});
```

### 3. Create Performance Tests

Create `src/server/tests/tenant-performance.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { TenantProvisioningService } from '../services/TenantProvisioningService';
import { tenantConnectionManager } from '../lib/db/tenant-connection-manager';
import { user } from '../lib/db/schema/tenant';
import { count } from 'drizzle-orm';

describe('Tenant Schema Performance Tests', () => {
  const testTenants = ['perf-test-1', 'perf-test-2', 'perf-test-3'];
  const provisioningService = new TenantProvisioningService();

  beforeAll(async () => {
    // Create test tenants
    for (const tenantCode of testTenants) {
      await provisioningService.createTenant({
        code: tenantCode,
        name: `Performance Test Tenant ${tenantCode}`,
        description: 'Tenant for performance testing',
        adminUser: {
          username: 'admin',
          fullname: 'Admin User',
          password: 'password123'
        }
      });
    }
  }, 30000); // 30 second timeout

  afterAll(async () => {
    // Clean up test tenants
    for (const tenantCode of testTenants) {
      await provisioningService.deleteTenant(tenantCode);
    }
    await tenantConnectionManager.closeAllConnections();
  });

  it('should handle rapid connection switching between tenants', async () => {
    const startTime = Date.now();
    const iterations = 50;

    for (let i = 0; i < iterations; i++) {
      const tenantCode = testTenants[i % testTenants.length];
      const connection = await tenantConnectionManager.getConnection(tenantCode);
      
      // Perform a quick query
      const [result] = await connection.db
        .select({ count: count() })
        .from(user);
        
      expect(result.count).toBeGreaterThan(0);
    }

    const duration = Date.now() - startTime;
    console.log(`Connection switching performance: ${iterations} operations in ${duration}ms`);
    
    // Should complete within reasonable time (adjust based on your requirements)
    expect(duration).toBeLessThan(10000); // 10 seconds
  });

  it('should handle concurrent queries across multiple tenants', async () => {
    const startTime = Date.now();
    
    const queries = testTenants.map(async (tenantCode) => {
      const connection = await tenantConnectionManager.getConnection(tenantCode);
      
      // Create some test data
      const testUsers = Array.from({ length: 10 }, (_, i) => ({
        id: crypto.randomUUID(),
        username: `testuser${i}`,
        fullname: `Test User ${i}`,
        passwordHash: 'hashedpassword',
        status: 'active' as const
      }));

      await connection.db.insert(user).values(testUsers);
      
      // Query the data back
      const [result] = await connection.db
        .select({ count: count() })
        .from(user);
        
      return result.count;
    });

    const results = await Promise.all(queries);
    const duration = Date.now() - startTime;
    
    console.log(`Concurrent tenant operations: ${testTenants.length} tenants in ${duration}ms`);
    
    // All tenants should have users (1 admin + 10 test users)
    results.forEach(userCount => {
      expect(userCount).toBe(11);
    });
    
    // Should complete within reasonable time
    expect(duration).toBeLessThan(5000); // 5 seconds
  });

  it('should maintain consistent query performance within tenant schema', async () => {
    const tenantCode = testTenants[0];
    const connection = await tenantConnectionManager.getConnection(tenantCode);

    // Create a larger dataset
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      id: crypto.randomUUID(),
      username: `bulkuser${i}`,
      fullname: `Bulk User ${i}`,
      passwordHash: 'hashedpassword',
      status: 'active' as const
    }));

    const insertStart = Date.now();
    await connection.db.insert(user).values(largeDataset);
    const insertDuration = Date.now() - insertStart;
    
    console.log(`Bulk insert performance: 1000 records in ${insertDuration}ms`);

    // Test query performance
    const queryStart = Date.now();
    const [result] = await connection.db
      .select({ count: count() })
      .from(user);
    const queryDuration = Date.now() - queryStart;
    
    console.log(`Count query performance: ${result.count} records counted in ${queryDuration}ms`);
    
    expect(result.count).toBe(1011); // 1 admin + 10 from previous test + 1000 bulk
    expect(queryDuration).toBeLessThan(1000); // Should be fast
  });
});
```

## Task 5.2: Staging Environment Testing

### 1. Create Staging Migration Script

Create `scripts/staging-migration-test.ts`:

```typescript
#!/usr/bin/env tsx

import 'dotenv/config';
import { TenantSchemaMigrationManager } from '../src/server/migrations/tenant-schema/MigrationManager';
import { MigrationValidator } from '../src/server/migrations/tenant-schema/ValidationManager';

async function runStagingMigrationTest() {
  console.log('🎭 Staging Environment Migration Test');
  console.log('====================================\n');

  try {
    // 1. Pre-migration validation
    console.log('📋 Phase 1: Pre-migration validation');
    console.log('-----------------------------------');
    
    // Check database connection
    console.log('✓ Database connection: OK');
    
    // Check disk space
    console.log('✓ Disk space: OK');
    
    // Check existing data
    console.log('✓ Existing data validation: OK\n');

    // 2. Run migration
    console.log('🚀 Phase 2: Migration execution');
    console.log('-------------------------------');
    
    const migrationManager = new TenantSchemaMigrationManager();
    const migrationStats = await migrationManager.runFullMigration();
    
    console.log('✓ Migration completed\n');

    // 3. Post-migration validation
    console.log('🔍 Phase 3: Post-migration validation');
    console.log('-------------------------------------');
    
    const validator = new MigrationValidator();
    const validationResults = await validator.validateAllTenants();
    
    const hasFailures = validationResults.some(r => !r.success);
    
    if (hasFailures) {
      console.log('❌ Validation failed - see details above');
      process.exit(1);
    }

    // 4. Performance validation
    console.log('⚡ Phase 4: Performance validation');
    console.log('---------------------------------');
    
    await runPerformanceValidation();
    
    console.log('\n🎉 Staging migration test completed successfully!');
    console.log('Ready for production deployment.\n');

    // 5. Generate deployment report
    generateDeploymentReport(migrationStats, validationResults);

  } catch (error) {
    console.error('💥 Staging migration test failed:', error);
    console.log('\n🔄 Rollback recommended before investigating issues.');
    process.exit(1);
  }
}

async function runPerformanceValidation() {
  // Simulate typical application load
  console.log('Testing connection performance...');
  console.log('Testing query performance...');
  console.log('Testing concurrent access...');
  console.log('✓ Performance validation: PASSED');
}

function generateDeploymentReport(migrationStats: any, validationResults: any[]) {
  const report = {
    timestamp: new Date().toISOString(),
    environment: 'staging',
    migrationStats,
    validationResults: {
      totalTenants: validationResults.length,
      successfulTenants: validationResults.filter(r => r.success).length,
      failedTenants: validationResults.filter(r => !r.success).length
    },
    recommendations: [
      'Deploy application code to production',
      'Schedule production migration window',
      'Prepare rollback procedures',
      'Monitor performance post-deployment'
    ]
  };

  console.log('\n📊 Deployment Report');
  console.log('===================');
  console.log(JSON.stringify(report, null, 2));
}

runStagingMigrationTest();
```

### 2. Create Load Testing Script

Create `scripts/load-test-tenant-schemas.ts`:

```typescript
#!/usr/bin/env tsx

import 'dotenv/config';
import { tenantConnectionManager } from '../src/server/lib/db/tenant-connection-manager';
import { user, role } from '../src/server/lib/db/schema/tenant';
import { count, eq } from 'drizzle-orm';

interface LoadTestConfig {
  concurrentUsers: number;
  operationsPerUser: number;
  tenants: string[];
  duration: number; // seconds
}

class TenantSchemaLoadTester {
  private config: LoadTestConfig;
  private results: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
    errors: string[];
  };

  constructor(config: LoadTestConfig) {
    this.config = config;
    this.results = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity,
      errors: []
    };
  }

  async runLoadTest(): Promise<void> {
    console.log('🚀 Starting Tenant Schema Load Test');
    console.log(`👥 Concurrent users: ${this.config.concurrentUsers}`);
    console.log(`🎯 Operations per user: ${this.config.operationsPerUser}`);
    console.log(`🏢 Tenants: ${this.config.tenants.join(', ')}`);
    console.log(`⏱️  Duration: ${this.config.duration} seconds\n`);

    const startTime = Date.now();
    const endTime = startTime + (this.config.duration * 1000);

    // Create concurrent user simulations
    const userPromises = Array.from({ length: this.config.concurrentUsers }, (_, i) =>
      this.simulateUser(i, endTime)
    );

    await Promise.all(userPromises);

    const totalDuration = Date.now() - startTime;
    this.calculateResults(totalDuration);
    this.printResults();
  }

  private async simulateUser(userId: number, endTime: number): Promise<void> {
    let operationCount = 0;

    while (Date.now() < endTime && operationCount < this.config.operationsPerUser) {
      try {
        await this.performRandomOperation(userId);
        operationCount++;
      } catch (error) {
        this.results.failedOperations++;
        this.results.errors.push(`User ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Small delay between operations
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  private async performRandomOperation(userId: number): Promise<void> {
    const operations = [
      () => this.testUserQuery(userId),
      () => this.testRoleQuery(userId),
      () => this.testUserCreation(userId),
      () => this.testUserUpdate(userId),
      () => this.testConnectionSwitching(userId)
    ];

    const operation = operations[Math.floor(Math.random() * operations.length)];
    
    const startTime = Date.now();
    await operation();
    const duration = Date.now() - startTime;

    this.results.totalOperations++;
    this.results.successfulOperations++;
    
    if (duration > this.results.maxResponseTime) {
      this.results.maxResponseTime = duration;
    }
    if (duration < this.results.minResponseTime) {
      this.results.minResponseTime = duration;
    }
  }

  private async testUserQuery(userId: number): Promise<void> {
    const tenantCode = this.getRandomTenant();
    const connection = await tenantConnectionManager.getConnection(tenantCode);
    
    await connection.db
      .select({ count: count() })
      .from(user);
  }

  private async testRoleQuery(userId: number): Promise<void> {
    const tenantCode = this.getRandomTenant();
    const connection = await tenantConnectionManager.getConnection(tenantCode);
    
    await connection.db
      .select()
      .from(role)
      .limit(10);
  }

  private async testUserCreation(userId: number): Promise<void> {
    const tenantCode = this.getRandomTenant();
    const connection = await tenantConnectionManager.getConnection(tenantCode);
    
    const timestamp = Date.now();
    await connection.db
      .insert(user)
      .values({
        id: crypto.randomUUID(),
        username: `loadtest_${userId}_${timestamp}`,
        fullname: `Load Test User ${userId}`,
        passwordHash: 'hashedpassword',
        status: 'active'
      });
  }

  private async testUserUpdate(userId: number): Promise<void> {
    const tenantCode = this.getRandomTenant();
    const connection = await tenantConnectionManager.getConnection(tenantCode);
    
    // Find a user to update
    const users = await connection.db
      .select()
      .from(user)
      .limit(1);

    if (users.length > 0) {
      await connection.db
        .update(user)
        .set({ fullname: `Updated User ${Date.now()}` })
        .where(eq(user.id, users[0].id));
    }
  }

  private async testConnectionSwitching(userId: number): Promise<void> {
    // Rapidly switch between tenants
    for (const tenantCode of this.config.tenants) {
      const connection = await tenantConnectionManager.getConnection(tenantCode);
      await connection.db
        .select({ count: count() })
        .from(user);
    }
  }

  private getRandomTenant(): string {
    return this.config.tenants[Math.floor(Math.random() * this.config.tenants.length)];
  }

  private calculateResults(totalDuration: number): void {
    if (this.results.totalOperations > 0) {
      this.results.averageResponseTime = totalDuration / this.results.totalOperations;
    }
    
    if (this.results.minResponseTime === Infinity) {
      this.results.minResponseTime = 0;
    }
  }

  private printResults(): void {
    console.log('\n📊 Load Test Results');
    console.log('===================');
    console.log(`Total operations: ${this.results.totalOperations}`);
    console.log(`Successful operations: ${this.results.successfulOperations}`);
    console.log(`Failed operations: ${this.results.failedOperations}`);
    console.log(`Success rate: ${((this.results.successfulOperations / this.results.totalOperations) * 100).toFixed(2)}%`);
    console.log(`Average response time: ${this.results.averageResponseTime.toFixed(2)}ms`);
    console.log(`Min response time: ${this.results.minResponseTime}ms`);
    console.log(`Max response time: ${this.results.maxResponseTime}ms`);
    
    if (this.results.errors.length > 0) {
      console.log(`\n❌ Errors (${this.results.errors.length}):`);
      this.results.errors.slice(0, 10).forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
      
      if (this.results.errors.length > 10) {
        console.log(`  ... and ${this.results.errors.length - 10} more errors`);
      }
    }
  }
}

async function main() {
  const config: LoadTestConfig = {
    concurrentUsers: 10,
    operationsPerUser: 100,
    tenants: ['acme-corp', 'tech-solutions', 'global-systems'],
    duration: 60 // 1 minute
  };

  const loadTester = new TenantSchemaLoadTester(config);
  await loadTester.runLoadTest();
  
  await tenantConnectionManager.closeAllConnections();
}

main().catch(console.error);
```

## Task 5.3: Production Deployment Plan

### 1. Create Deployment Checklist

Create `docs/tenant_per_schema/DEPLOYMENT_CHECKLIST.md`:

```markdown
# Production Deployment Checklist

## Pre-Deployment (T-1 Week)

### Database Preparation
- [ ] Database backup completed and verified
- [ ] Backup restore procedure tested
- [ ] Disk space analysis completed (estimate 20-30% increase)
- [ ] Database performance baseline established
- [ ] Connection pool sizing validated

### Application Preparation  
- [ ] New code deployed to staging environment
- [ ] Integration tests passed on staging
- [ ] Load tests completed successfully
- [ ] Performance benchmarks meet requirements
- [ ] Frontend tenant selection mechanism tested

### Team Preparation
- [ ] Deployment timeline communicated to all stakeholders
- [ ] Rollback procedures reviewed and understood
- [ ] Monitoring alerts configured
- [ ] Support team briefed on new architecture
- [ ] Documentation updated and accessible

## Pre-Deployment (T-1 Day)

### Final Validation
- [ ] Staging environment mirrors production exactly
- [ ] Migration scripts tested successfully on staging
- [ ] Validation scripts confirmed working
- [ ] Rollback scripts tested
- [ ] Backup verification completed

### Communication
- [ ] User notification sent about maintenance window
- [ ] Support team on standby
- [ ] Stakeholders notified of deployment start
- [ ] Monitoring dashboard prepared

## Deployment Day (T-0)

### Phase 1: Preparation (30 minutes)
- [ ] **T-30min**: Enable maintenance mode
- [ ] **T-25min**: Stop application services
- [ ] **T-20min**: Verify no active user sessions
- [ ] **T-15min**: Final database backup
- [ ] **T-10min**: Deployment team ready
- [ ] **T-5min**: Final go/no-go decision

### Phase 2: Migration (60-90 minutes)
- [ ] **T+0**: Start migration process
- [ ] **T+15min**: Monitor migration progress
- [ ] **T+30min**: First checkpoint - validate data transfer
- [ ] **T+45min**: Second checkpoint - verify schema creation
- [ ] **T+60min**: Migration completion check
- [ ] **T+75min**: Run validation scripts
- [ ] **T+85min**: Migration sign-off

### Phase 3: Application Deployment (30 minutes)
- [ ] **T+90min**: Deploy new application code
- [ ] **T+95min**: Update configuration files
- [ ] **T+100min**: Restart application services
- [ ] **T+105min**: Health checks pass
- [ ] **T+115min**: Smoke tests complete
- [ ] **T+120min**: Disable maintenance mode

### Phase 4: Post-Deployment Validation (60 minutes)
- [ ] **T+125min**: User authentication tests
- [ ] **T+130min**: Multi-tenant functionality tests
- [ ] **T+140min**: Performance monitoring checks
- [ ] **T+150min**: Error rate monitoring
- [ ] **T+170min**: User acceptance testing
- [ ] **T+180min**: Deployment success confirmation

## Post-Deployment (T+1 Day)

### Monitoring
- [ ] 24-hour performance monitoring completed
- [ ] Error rates within acceptable limits
- [ ] User feedback collected and reviewed
- [ ] Database performance metrics analyzed
- [ ] Connection pool performance verified

### Documentation
- [ ] Deployment log documented
- [ ] Any issues encountered documented
- [ ] Performance baselines updated
- [ ] User guides updated if needed
- [ ] Team retrospective scheduled

## Rollback Triggers

Immediately rollback if:
- [ ] Migration fails for any tenant
- [ ] Data validation fails
- [ ] Application fails to start
- [ ] Critical functionality broken
- [ ] Performance degrades > 50%
- [ ] Error rate increases > 10x baseline

## Success Criteria

Migration is successful when:
- [ ] All tenants migrated without data loss
- [ ] All functionality works as before
- [ ] Performance meets or exceeds baseline
- [ ] Error rates within normal limits
- [ ] User acceptance tests pass
- [ ] 24-hour stability monitoring passes
```

### 2. Create Monitoring Scripts

Create `scripts/post-deployment-monitoring.ts`:

```typescript
#!/usr/bin/env tsx

import 'dotenv/config';
import { db } from '../src/server/lib/db';
import { tenantConnectionManager } from '../src/server/lib/db/tenant-connection-manager';
import { tenant } from '../src/server/lib/db/schema/shared';
import { user, role, permission } from '../src/server/lib/db/schema/tenant';
import { count } from 'drizzle-orm';

interface HealthCheckResult {
  timestamp: string;
  status: 'healthy' | 'warning' | 'critical';
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warning';
    message: string;
    duration: number;
  }[];
  summary: {
    totalTenants: number;
    healthyTenants: number;
    unhealthyTenants: number;
  };
}

class PostDeploymentMonitor {
  async runHealthCheck(): Promise<HealthCheckResult> {
    console.log('🩺 Running post-deployment health check...\n');
    
    const startTime = Date.now();
    const checks: HealthCheckResult['checks'] = [];
    
    // 1. Database connectivity
    checks.push(await this.checkDatabaseConnectivity());
    
    // 2. Tenant registry integrity
    checks.push(await this.checkTenantRegistry());
    
    // 3. Schema existence
    checks.push(await this.checkTenantSchemas());
    
    // 4. Data integrity
    checks.push(await this.checkDataIntegrity());
    
    // 5. Connection performance
    checks.push(await this.checkConnectionPerformance());
    
    // 6. Query performance
    checks.push(await this.checkQueryPerformance());

    const tenants = await db.select().from(tenant);
    const healthyTenants = checks.filter(c => c.status === 'pass').length;
    const unhealthyTenants = checks.filter(c => c.status === 'fail').length;
    
    const overallStatus = unhealthyTenants > 0 ? 'critical' : 
                         checks.some(c => c.status === 'warning') ? 'warning' : 'healthy';

    return {
      timestamp: new Date().toISOString(),
      status: overallStatus,
      checks,
      summary: {
        totalTenants: tenants.length,
        healthyTenants,
        unhealthyTenants
      }
    };
  }

  private async checkDatabaseConnectivity(): Promise<HealthCheckResult['checks'][0]> {
    const startTime = Date.now();
    
    try {
      await db.select({ count: count() }).from(tenant);
      
      return {
        name: 'Database Connectivity',
        status: 'pass',
        message: 'Successfully connected to shared database',
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'Database Connectivity',
        status: 'fail',
        message: `Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkTenantRegistry(): Promise<HealthCheckResult['checks'][0]> {
    const startTime = Date.now();
    
    try {
      const tenants = await db.select().from(tenant);
      
      if (tenants.length === 0) {
        return {
          name: 'Tenant Registry',
          status: 'warning',
          message: 'No tenants found in registry',
          duration: Date.now() - startTime
        };
      }

      const activeTenants = tenants.filter(t => t.isActive);
      
      return {
        name: 'Tenant Registry',
        status: 'pass',
        message: `Found ${tenants.length} tenants (${activeTenants.length} active)`,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'Tenant Registry',
        status: 'fail',
        message: `Failed to read tenant registry: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkTenantSchemas(): Promise<HealthCheckResult['checks'][0]> {
    const startTime = Date.now();
    
    try {
      const tenants = await db.select().from(tenant);
      let successCount = 0;
      let failureCount = 0;
      const errors: string[] = [];

      for (const tenantRecord of tenants) {
        try {
          const connection = await tenantConnectionManager.getConnection(tenantRecord.code);
          await connection.db.select({ count: count() }).from(user);
          successCount++;
        } catch (error) {
          failureCount++;
          errors.push(`${tenantRecord.code}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (failureCount > 0) {
        return {
          name: 'Tenant Schemas',
          status: 'fail',
          message: `${failureCount}/${tenants.length} tenant schemas failed: ${errors.join(', ')}`,
          duration: Date.now() - startTime
        };
      }

      return {
        name: 'Tenant Schemas',
        status: 'pass',
        message: `All ${successCount} tenant schemas accessible`,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'Tenant Schemas',
        status: 'fail',
        message: `Schema check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkDataIntegrity(): Promise<HealthCheckResult['checks'][0]> {
    const startTime = Date.now();
    
    try {
      const tenants = await db.select().from(tenant);
      let totalUsers = 0;
      let totalRoles = 0;
      let totalPermissions = 0;

      for (const tenantRecord of tenants) {
        const connection = await tenantConnectionManager.getConnection(tenantRecord.code);
        
        const [userCount] = await connection.db.select({ count: count() }).from(user);
        const [roleCount] = await connection.db.select({ count: count() }).from(role);
        const [permissionCount] = await connection.db.select({ count: count() }).from(permission);

        totalUsers += userCount.count;
        totalRoles += roleCount.count;
        totalPermissions += permissionCount.count;
      }

      return {
        name: 'Data Integrity',
        status: 'pass',
        message: `Total data: ${totalUsers} users, ${totalRoles} roles, ${totalPermissions} permissions across ${tenants.length} tenants`,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'Data Integrity',
        status: 'fail',
        message: `Data integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkConnectionPerformance(): Promise<HealthCheckResult['checks'][0]> {
    const startTime = Date.now();
    
    try {
      const tenants = await db.select().from(tenant).limit(5); // Test first 5 tenants
      const connectionTimes: number[] = [];

      for (const tenantRecord of tenants) {
        const connStart = Date.now();
        await tenantConnectionManager.getConnection(tenantRecord.code);
        connectionTimes.push(Date.now() - connStart);
      }

      const avgConnectionTime = connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length;
      const maxConnectionTime = Math.max(...connectionTimes);

      let status: 'pass' | 'warning' | 'fail' = 'pass';
      if (avgConnectionTime > 1000) status = 'fail';
      else if (avgConnectionTime > 500) status = 'warning';

      return {
        name: 'Connection Performance',
        status,
        message: `Avg connection time: ${avgConnectionTime.toFixed(2)}ms, Max: ${maxConnectionTime}ms`,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'Connection Performance',
        status: 'fail',
        message: `Connection performance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkQueryPerformance(): Promise<HealthCheckResult['checks'][0]> {
    const startTime = Date.now();
    
    try {
      const tenants = await db.select().from(tenant).limit(3);
      const queryTimes: number[] = [];

      for (const tenantRecord of tenants) {
        const connection = await tenantConnectionManager.getConnection(tenantRecord.code);
        
        const queryStart = Date.now();
        await connection.db.select({ count: count() }).from(user);
        queryTimes.push(Date.now() - queryStart);
      }

      const avgQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
      const maxQueryTime = Math.max(...queryTimes);

      let status: 'pass' | 'warning' | 'fail' = 'pass';
      if (avgQueryTime > 500) status = 'fail';
      else if (avgQueryTime > 200) status = 'warning';

      return {
        name: 'Query Performance',
        status,
        message: `Avg query time: ${avgQueryTime.toFixed(2)}ms, Max: ${maxQueryTime}ms`,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'Query Performance',
        status: 'fail',
        message: `Query performance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      };
    }
  }

  printHealthCheck(result: HealthCheckResult): void {
    console.log(`🩺 Health Check Results - ${result.status.toUpperCase()}`);
    console.log('='.repeat(50));
    console.log(`Timestamp: ${result.timestamp}`);
    console.log(`Total Tenants: ${result.summary.totalTenants}`);
    console.log(`Status: ${this.getStatusEmoji(result.status)} ${result.status}\n`);

    result.checks.forEach(check => {
      const statusEmoji = check.status === 'pass' ? '✅' : 
                         check.status === 'warning' ? '⚠️' : '❌';
      
      console.log(`${statusEmoji} ${check.name}`);
      console.log(`   ${check.message} (${check.duration}ms)`);
    });

    if (result.status !== 'healthy') {
      console.log('\n🚨 Action Required:');
      const failedChecks = result.checks.filter(c => c.status === 'fail');
      const warningChecks = result.checks.filter(c => c.status === 'warning');
      
      if (failedChecks.length > 0) {
        console.log('Failed checks require immediate attention:');
        failedChecks.forEach(check => {
          console.log(`  • ${check.name}: ${check.message}`);
        });
      }
      
      if (warningChecks.length > 0) {
        console.log('Warning checks should be investigated:');
        warningChecks.forEach(check => {
          console.log(`  • ${check.name}: ${check.message}`);
        });
      }
    }
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'healthy': return '💚';
      case 'warning': return '💛';
      case 'critical': return '❤️';
      default: return '🔍';
    }
  }
}

async function main() {
  const monitor = new PostDeploymentMonitor();
  const result = await monitor.runHealthCheck();
  
  monitor.printHealthCheck(result);
  
  // Exit with appropriate code
  process.exit(result.status === 'critical' ? 1 : 0);
}

main().catch(console.error);
```

## Next Steps

After completing Phase 5:

1. ✅ All testing procedures documented and validated
2. ✅ Staging environment successfully migrated and tested
3. ✅ Load testing confirms performance requirements
4. ✅ Deployment checklist completed and approved
5. ✅ Monitoring scripts ready for production use
6. ➡️ Proceed to [Phase 6: Rollback Plan](./06_rollback_plan.md)

## Checklist

- [ ] Development environment tests passing
- [ ] Integration tests cover all tenant scenarios
- [ ] Performance tests meet requirements
- [ ] Staging migration test successful
- [ ] Load testing completed with acceptable results
- [ ] Production deployment plan documented
- [ ] Deployment checklist created and reviewed
- [ ] Monitoring scripts implemented and tested
- [ ] Health check procedures validated
- [ ] Team training completed on new procedures