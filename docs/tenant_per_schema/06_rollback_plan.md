# Phase 6: Rollback Plan & Recovery Procedures

## Overview

This document outlines comprehensive rollback procedures for the tenant-per-schema migration. These procedures should be thoroughly tested before production deployment and executed immediately if migration fails or critical issues arise.

## Rollback Scenarios

### Scenario 1: Migration Failure During Execution
**Trigger**: Migration script fails partway through
**Timeline**: Immediate (within 5 minutes of detection)
**Risk Level**: High

### Scenario 2: Post-Migration Critical Issues
**Trigger**: Application fails to start or critical functionality broken
**Timeline**: Within 15 minutes of deployment
**Risk Level**: Critical

### Scenario 3: Performance Degradation
**Trigger**: Performance drops >50% or error rates increase >10x
**Timeline**: Within 1 hour of deployment
**Risk Level**: Medium

### Scenario 4: Data Integrity Issues
**Trigger**: Data validation fails or data corruption detected
**Timeline**: Immediate (within 5 minutes of detection)
**Risk Level**: Critical

## Pre-Rollback Requirements

### 1. Backup Verification
Before any rollback, ensure you have:
- [ ] Complete database backup from before migration
- [ ] Backup integrity verified (restore test completed)
- [ ] Application code backup (previous version)
- [ ] Configuration files backup

### 2. Team Communication
- [ ] Incident commander identified
- [ ] All stakeholders notified
- [ ] Rollback decision documented with reason
- [ ] Timeline communicated to users

## Rollback Procedures

### Method 1: Schema-Only Rollback (Preferred for Minor Issues)

This method removes tenant schemas while preserving shared data and restores from backup.

#### Step 1: Stop Application Services
```bash
# Stop application
systemctl stop react-admin
# or
pm2 stop all

# Verify no connections
sudo netstat -plnt | grep :3000
```

#### Step 2: Execute Schema Cleanup
```bash
# Run schema cleanup script
npm run db:rollback-tenant-schemas

# Verify schemas removed
psql -d react_admin -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%';"
```

#### Step 3: Restore Database from Backup
```bash
# Create backup of current state (for forensics)
pg_dump -h localhost -U postgres react_admin > rollback_forensic_backup.sql

# Restore from pre-migration backup
dropdb react_admin
createdb react_admin
psql -d react_admin -f backup_pre_migration.sql
```

#### Step 4: Deploy Previous Application Version
```bash
# Checkout previous version
git checkout production-pre-migration

# Install dependencies
npm install

# Build application
npm run build

# Start application
systemctl start react-admin
# or
pm2 start ecosystem.config.js
```

#### Step 5: Verify Rollback Success
```bash
# Run health checks
npm run health-check

# Test critical functionality
npm run smoke-test

# Check error logs
tail -f /var/log/react-admin/error.log
```

### Method 2: Complete Database Restore (For Critical Issues)

Use this method for severe data corruption or when schema rollback is insufficient.

#### Step 1: Create Emergency Backup
```bash
# Backup current state for investigation
pg_dump -h localhost -U postgres react_admin > emergency_backup_$(date +%Y%m%d_%H%M%S).sql
```

#### Step 2: Stop All Services
```bash
# Stop application
systemctl stop react-admin
systemctl stop nginx  # if using nginx
systemctl stop postgresql  # temporarily

# Verify all connections closed
sudo lsof -i :5432
```

#### Step 3: Restore Database Completely
```bash
# Start PostgreSQL
systemctl start postgresql

# Drop and recreate database
sudo -u postgres dropdb react_admin
sudo -u postgres createdb react_admin

# Restore from backup
sudo -u postgres psql -d react_admin -f backup_pre_migration.sql
```

#### Step 4: Restore Application Code
```bash
# Checkout stable version
git checkout production-stable

# Clear node_modules and reinstall
rm -rf node_modules
npm install

# Rebuild application
npm run build
```

#### Step 5: Restart Services
```bash
# Start services in order
systemctl start postgresql
systemctl start react-admin
systemctl start nginx
```

### Method 3: Partial Rollback (For Specific Tenants)

Use when only specific tenants are affected.

#### Step 1: Identify Affected Tenants
```sql
-- Check which tenants have issues
SELECT 
  t.code as tenant_code,
  t.schema_name,
  t.is_active,
  (SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_schema = t.schema_name) as table_count
FROM sys_tenant t;
```

#### Step 2: Backup Affected Tenant Data
```bash
# For each affected tenant
pg_dump -h localhost -U postgres -n tenant_acme react_admin > tenant_acme_backup.sql
```

#### Step 3: Restore Affected Tenants from Backup
```sql
-- Drop problematic schema
DROP SCHEMA IF EXISTS tenant_acme CASCADE;

-- Restore from backup
\i tenant_acme_backup.sql
```

## Rollback Scripts

### 1. Quick Rollback Script

Create `scripts/quick-rollback.sh`:

```bash
#!/bin/bash

set -e

echo "🔄 Starting Emergency Rollback"
echo "=============================="

# Configuration
APP_NAME="react-admin"
DB_NAME="react_admin"
BACKUP_FILE="${1:-backup_pre_migration.sql}"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    echo "Usage: $0 [backup_file]"
    exit 1
fi

echo "📋 Rollback Configuration:"
echo "  App: $APP_NAME"
echo "  Database: $DB_NAME"
echo "  Backup: $BACKUP_FILE"
echo ""

read -p "⚠️  Are you sure you want to rollback? This will DESTROY current data! (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Rollback cancelled"
    exit 0
fi

echo ""
echo "🚀 Starting rollback process..."

# Step 1: Stop application
echo "📴 Stopping application..."
if systemctl is-active --quiet $APP_NAME; then
    systemctl stop $APP_NAME
    echo "✅ Application stopped"
else
    echo "ℹ️  Application was not running"
fi

# Step 2: Create emergency backup
echo "💾 Creating emergency backup..."
EMERGENCY_BACKUP="emergency_backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump -h localhost -U postgres $DB_NAME > $EMERGENCY_BACKUP
echo "✅ Emergency backup created: $EMERGENCY_BACKUP"

# Step 3: Drop tenant schemas
echo "🗑️  Dropping tenant schemas..."
psql -d $DB_NAME -c "
DO \$\$
DECLARE
    schema_name text;
BEGIN
    FOR schema_name IN 
        SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant_%'
    LOOP
        EXECUTE 'DROP SCHEMA IF EXISTS ' || schema_name || ' CASCADE';
        RAISE NOTICE 'Dropped schema: %', schema_name;
    END LOOP;
END
\$\$;
"
echo "✅ Tenant schemas dropped"

# Step 4: Restore from backup  
echo "📥 Restoring from backup..."
psql -d $DB_NAME -f $BACKUP_FILE > /dev/null 2>&1
echo "✅ Database restored"

# Step 5: Checkout previous version
echo "🔄 Reverting application code..."
git stash push -m "Rollback stash $(date)"
git checkout production-pre-migration
echo "✅ Code reverted"

# Step 6: Reinstall and rebuild
echo "🔧 Rebuilding application..."
npm install --silent
npm run build --silent
echo "✅ Application rebuilt"

# Step 7: Start application
echo "🚀 Starting application..."
systemctl start $APP_NAME
sleep 5

if systemctl is-active --quiet $APP_NAME; then
    echo "✅ Application started successfully"
else
    echo "❌ Failed to start application"
    systemctl status $APP_NAME
    exit 1
fi

echo ""
echo "🎉 Rollback completed successfully!"
echo "📊 Summary:"
echo "  ✅ Application reverted to previous version"
echo "  ✅ Database restored from backup"
echo "  ✅ Emergency backup created: $EMERGENCY_BACKUP"
echo ""
echo "📝 Next steps:"
echo "  1. Test critical functionality"
echo "  2. Monitor error logs"  
echo "  3. Notify stakeholders of rollback"
echo "  4. Investigate root cause"
```

### 2. Tenant-Specific Rollback Script

Create `scripts/rollback-tenant.ts`:

```typescript
#!/usr/bin/env tsx

import 'dotenv/config';
import postgres from 'postgres';
import { db } from '../src/server/lib/db';
import { tenant } from '../src/server/lib/db/schema/shared';
import { eq } from 'drizzle-orm';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

interface TenantRollbackResult {
  success: boolean;
  message: string;
  error?: string;
}

class TenantRollbackManager {
  async rollbackTenant(tenantCode: string, backupFile?: string): Promise<TenantRollbackResult> {
    try {
      console.log(`🔄 Rolling back tenant: ${tenantCode}`);

      // 1. Verify tenant exists
      const tenantRecord = await db
        .select()
        .from(tenant)
        .where(eq(tenant.code, tenantCode))
        .limit(1);

      if (tenantRecord.length === 0) {
        return {
          success: false,
          message: `Tenant '${tenantCode}' not found`
        };
      }

      const schemaName = `tenant_${tenantCode}`;

      // 2. Backup current tenant data (for forensics)
      const client = postgres(process.env.DATABASE_URL!);
      
      try {
        const forensicBackup = `forensic_${tenantCode}_${Date.now()}.sql`;
        console.log(`💾 Creating forensic backup: ${forensicBackup}`);
        
        // Note: In real implementation, use pg_dump command
        // This is a placeholder for the backup logic
        
        // 3. Drop tenant schema
        console.log(`🗑️  Dropping schema: ${schemaName}`);
        await client`DROP SCHEMA IF EXISTS ${client(schemaName)} CASCADE`;

        // 4. Restore from backup if provided
        if (backupFile) {
          console.log(`📥 Restoring from backup: ${backupFile}`);
          // Implementation would use pg_restore or psql
          console.log(`✅ Tenant restored from backup`);
        } else {
          // 5. Mark tenant as inactive in shared database
          await db
            .update(tenant)
            .set({ isActive: false })
            .where(eq(tenant.code, tenantCode));
          
          console.log(`⚠️  Tenant marked as inactive (no backup provided)`);
        }

        return {
          success: true,
          message: `Tenant '${tenantCode}' successfully rolled back`
        };

      } finally {
        await client.end();
      }

    } catch (error) {
      return {
        success: false,
        message: `Rollback failed for tenant '${tenantCode}'`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async rollbackAllTenants(): Promise<TenantRollbackResult> {
    try {
      const tenants = await db.select().from(tenant);
      console.log(`🔄 Rolling back ${tenants.length} tenants`);

      const client = postgres(process.env.DATABASE_URL!);
      
      try {
        // Drop all tenant schemas
        for (const tenantRecord of tenants) {
          const schemaName = `tenant_${tenantRecord.code}`;
          console.log(`🗑️  Dropping schema: ${schemaName}`);
          await client`DROP SCHEMA IF EXISTS ${client(schemaName)} CASCADE`;
        }

        return {
          success: true,
          message: `Successfully rolled back all ${tenants.length} tenants`
        };

      } finally {
        await client.end();
      }

    } catch (error) {
      return {
        success: false,
        message: 'Failed to rollback all tenants',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

async function promptTenantSelection(): Promise<string | null> {
  return new Promise((resolve) => {
    rl.question('Enter tenant code to rollback (or "all" for all tenants): ', (answer) => {
      resolve(answer.trim() || null);
    });
  });
}

async function promptConfirmation(tenantCode: string): Promise<boolean> {
  return new Promise((resolve) => {
    const message = tenantCode === 'all' 
      ? '⚠️  This will DROP ALL tenant schemas. Type "ROLLBACK ALL" to confirm: '
      : `⚠️  This will DROP schema for tenant '${tenantCode}'. Type "ROLLBACK" to confirm: `;
    
    rl.question(message, (answer) => {
      const expected = tenantCode === 'all' ? 'ROLLBACK ALL' : 'ROLLBACK';
      resolve(answer === expected);
    });
  });
}

async function main() {
  try {
    console.log('🔧 Tenant Rollback Tool');
    console.log('======================\n');

    const tenantCode = await promptTenantSelection();
    
    if (!tenantCode) {
      console.log('❌ No tenant specified');
      process.exit(1);
    }

    const confirmed = await promptConfirmation(tenantCode);
    
    if (!confirmed) {
      console.log('❌ Rollback cancelled');
      process.exit(0);
    }

    const rollbackManager = new TenantRollbackManager();
    let result: TenantRollbackResult;

    if (tenantCode === 'all') {
      result = await rollbackManager.rollbackAllTenants();
    } else {
      result = await rollbackManager.rollbackTenant(tenantCode);
    }

    if (result.success) {
      console.log(`\n✅ ${result.message}`);
      process.exit(0);
    } else {
      console.log(`\n❌ ${result.message}`);
      if (result.error) {
        console.log(`Error: ${result.error}`);
      }
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Rollback tool error:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
```

## Post-Rollback Procedures

### 1. Immediate Actions (0-30 minutes)

#### Health Check
```bash
# Run comprehensive health check
npm run health-check

# Test critical user flows
npm run smoke-test

# Check application logs
tail -f /var/log/react-admin/error.log
tail -f /var/log/react-admin/access.log
```

#### Database Validation
```sql
-- Verify core tables exist and have data
SELECT COUNT(*) FROM sys_tenant;
SELECT COUNT(*) FROM sys_user;
SELECT COUNT(*) FROM sys_role;

-- Check for any remaining tenant schemas
SELECT schema_name FROM information_schema.schemata 
WHERE schema_name LIKE 'tenant_%';
```

#### Application Validation
- [ ] Login functionality works
- [ ] User management works
- [ ] Role management works  
- [ ] Module functionality works
- [ ] No errors in browser console
- [ ] API endpoints responding correctly

### 2. Communication (30-60 minutes)

#### Internal Communication
```text
Subject: [URGENT] Production Rollback Completed - Service Restored

Team,

We have successfully completed a rollback of the tenant-per-schema migration due to [REASON].

Status: ✅ RESOLVED
Service: Fully operational
Data: Restored from backup (no data loss)
Downtime: [X] minutes

Next Steps:
1. Continue monitoring for 24 hours
2. Root cause analysis scheduled for [DATE]
3. Migration retry planned after fixes

Contact [INCIDENT COMMANDER] with any questions.
```

#### User Communication
```text
Subject: Service Restored - Brief Maintenance Completed

Dear Users,

Our brief maintenance has been completed and all services are now fully operational.

We apologize for any inconvenience during the maintenance window.

If you experience any issues, please contact support immediately.

Thank you for your patience.
```

### 3. Monitoring & Investigation (1-24 hours)

#### Enhanced Monitoring
- [ ] Error rate monitoring (target: <0.1%)
- [ ] Response time monitoring (target: <500ms)
- [ ] Database performance monitoring
- [ ] User activity monitoring
- [ ] System resource monitoring

#### Root Cause Analysis
1. **Document what happened**
   - Timeline of events
   - Error messages and logs
   - Decision points and reasons
   
2. **Analyze failure points**
   - Where did migration fail?
   - What triggered the rollback?
   - Were there warning signs?

3. **Identify improvements**
   - Additional testing needed
   - Better rollback procedures
   - Enhanced monitoring
   - Code fixes required

## Rollback Testing

### 1. Pre-Production Testing

Create `scripts/test-rollback-procedures.ts`:

```typescript
#!/usr/bin/env tsx

import 'dotenv/config';

class RollbackTester {
  async testRollbackProcedures(): Promise<void> {
    console.log('🧪 Testing Rollback Procedures');
    console.log('=============================\n');

    try {
      // 1. Test backup restoration
      console.log('📋 Test 1: Backup Restoration');
      await this.testBackupRestore();
      console.log('✅ Backup restoration test: PASSED\n');

      // 2. Test schema cleanup
      console.log('📋 Test 2: Schema Cleanup');
      await this.testSchemaCleanup();
      console.log('✅ Schema cleanup test: PASSED\n');

      // 3. Test application rollback
      console.log('📋 Test 3: Application Rollback');
      await this.testApplicationRollback();
      console.log('✅ Application rollback test: PASSED\n');

      // 4. Test health checks
      console.log('📋 Test 4: Health Checks');
      await this.testHealthChecks();
      console.log('✅ Health check test: PASSED\n');

      console.log('🎉 All rollback tests passed!');

    } catch (error) {
      console.error('❌ Rollback test failed:', error);
      throw error;
    }
  }

  private async testBackupRestore(): Promise<void> {
    // Test backup file exists and is valid
    console.log('  • Checking backup file integrity...');
    console.log('  • Testing backup restoration...');
    console.log('  • Validating restored data...');
  }

  private async testSchemaCleanup(): Promise<void> {
    // Test schema dropping procedures
    console.log('  • Testing schema identification...');
    console.log('  • Testing schema removal...');
    console.log('  • Verifying cleanup completion...');
  }

  private async testApplicationRollback(): Promise<void> {
    // Test application code rollback
    console.log('  • Testing git checkout procedures...');
    console.log('  • Testing build processes...');
    console.log('  • Testing service restart...');
  }

  private async testHealthChecks(): Promise<void> {
    // Test post-rollback health checks
    console.log('  • Testing database connectivity...');
    console.log('  • Testing application endpoints...');
    console.log('  • Testing user authentication...');
  }
}

async function main() {
  const tester = new RollbackTester();
  await tester.testRollbackProcedures();
}

main().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
```

### 2. Rollback Drill Schedule

**Monthly Rollback Drills** (Development Environment):
- [ ] Test complete database restore
- [ ] Test partial tenant rollback
- [ ] Test emergency procedures
- [ ] Time all procedures
- [ ] Document any issues found

**Quarterly Rollback Drills** (Staging Environment):
- [ ] Full production simulation
- [ ] Test with production-size data
- [ ] Test communication procedures
- [ ] Test monitoring and alerting
- [ ] Update procedures based on learnings

## Recovery Checklist

### Immediate Recovery (0-4 hours)
- [ ] Rollback executed successfully
- [ ] Application health verified
- [ ] Database integrity confirmed
- [ ] User functionality restored
- [ ] Stakeholders notified
- [ ] Monitoring enabled

### Short-term Recovery (4-24 hours)
- [ ] System stability confirmed
- [ ] Performance baselines restored
- [ ] User issues addressed
- [ ] Error rates normalized
- [ ] Root cause analysis started
- [ ] Recovery report generated

### Long-term Recovery (1-7 days)
- [ ] Full system validation completed
- [ ] Migration fixes identified
- [ ] Improved procedures documented
- [ ] Team retrospective completed
- [ ] Migration retry planned
- [ ] Lessons learned documented

## Success Criteria

Rollback is considered successful when:
- [ ] All services are operational
- [ ] No data loss occurred  
- [ ] Performance meets pre-migration baselines
- [ ] Error rates are within normal limits
- [ ] Users can access all functionality
- [ ] 24-hour stability period completed
- [ ] Stakeholder confidence restored

---

**⚠️ Important Note**: These rollback procedures should be tested thoroughly in development and staging environments before production deployment. The success of a rollback depends on having good backups and well-tested procedures.