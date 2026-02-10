# Phase 1: Planning & Preparation

## Task 1.1: Database Schema Design

### Naming Convention for Tenant Schemas

Define a consistent naming pattern for tenant schemas:

```sql
-- Format: tenant_{tenant_code}
tenant_system  -- for SYSTEM tenant
tenant_public  -- for PUBLIC tenant  
tenant_acme    -- for ACME Corporation
tenant_xyz     -- for XYZ Company
```

### Rules for Naming:
- Always use `tenant_` prefix
- Use lowercase tenant codes
- Remove spaces and special characters
- Maximum length: 63 characters (PostgreSQL limit)
- Reserved names: `public`, `information_schema`, `pg_catalog`

## Task 1.2: Schema Separation Strategy

### Tables to Keep in Public Schema (Shared)
```typescript
// These remain in public schema for cross-tenant functionality
const sharedTables = [
  'sys_tenant',           // Tenant registry
  'module_registry',      // Global module catalog
  'module_authorization', // Tenant-specific module access
  'drizzle_migrations'    // Migration tracking
];
```

### Tables to Move to Tenant Schemas
```typescript
// These move to individual tenant schemas
const tenantTables = [
  'sys_user',
  'sys_role', 
  'sys_permission',
  'sys_option',
  'sys_user_role',
  'sys_role_permission',
  // All module-specific tables
  'demo_department',
  'sample_module',
  // Future module tables...
];
```

## Task 1.3: Migration Strategy Planning

### 1. Pre-Migration Assessment

Create a checklist to assess current state:

```typescript
interface PreMigrationAssessment {
  totalTenants: number;
  totalUsers: number;
  totalRoles: number;
  totalPermissions: number;
  moduleTablesCount: number;
  estimatedDowntime: string;
  backupSize: string;
  diskSpaceRequired: string;
}
```

### 2. Data Migration Approach

**Option A: Big Bang Migration (Recommended for small datasets)**
- Complete migration in one maintenance window
- Minimal complexity
- Shorter overall timeline

**Option B: Gradual Migration (For large datasets)**
- Migrate tenants one by one
- Dual-write during transition
- Longer timeline but less risky

### 3. Rollback Strategy

**Immediate Rollback Triggers:**
- Migration fails for any tenant
- Performance degradation > 50%
- Data integrity issues detected
- Critical functionality broken

**Rollback Process:**
1. Stop application
2. Restore database from backup
3. Restart application with old code
4. Investigate and fix issues
5. Plan retry with fixes

## Task 1.4: Environment Preparation

### 1. Development Environment Setup

```bash
# Create migration branch
git checkout -b feature/tenant-per-schema-migration

# Backup current database
pg_dump -h localhost -U postgres react_admin > backup_pre_migration.sql

# Create test database for migration testing
createdb react_admin_migration_test
```

### 2. Testing Environment Requirements

```yaml
environments:
  development:
    database: react_admin_dev
    tenant_count: 3
    test_data: minimal
    
  staging:
    database: react_admin_staging  
    tenant_count: 10
    test_data: production_sample
    
  production:
    database: react_admin_prod
    tenant_count: 50+
    test_data: full_production
```

### 3. Required Tools and Scripts

```bash
# Install additional dependencies
npm install --save-dev db-migrate postgresql-schema-builder

# Create migration utilities directory
mkdir -p src/server/migrations/tenant-schema
mkdir -p scripts/migration
```

## Task 1.5: Team Coordination

### 1. Stakeholder Communication

**Development Team:**
- Architecture changes overview
- Timeline and milestones  
- Testing responsibilities

**Operations Team:**
- Deployment procedure changes
- Monitoring requirements
- Backup strategy updates

**Business Team:**
- Expected downtime windows
- Feature freeze during migration
- Rollback scenarios and impact

### 2. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Data loss during migration | Low | Critical | Full backup + testing |
| Extended downtime | Medium | High | Staged rollout + monitoring |
| Performance degradation | Medium | Medium | Load testing + optimization |
| Schema conflicts | Low | Medium | Naming validation + cleanup |
| Application bugs | High | Medium | Comprehensive testing |

### 3. Success Criteria

**Technical Success:**
- ✅ All tenant data migrated successfully
- ✅ No data loss or corruption
- ✅ Performance maintained or improved
- ✅ All functionality working correctly
- ✅ Tests passing at 100%

**Business Success:**
- ✅ Downtime within acceptable window
- ✅ No user-facing issues
- ✅ Improved tenant isolation
- ✅ Enhanced security posture

## Task 1.6: Documentation Requirements

### 1. Technical Documentation
- Database schema changes
- API endpoint modifications  
- Configuration updates
- Deployment procedures

### 2. User Documentation
- Any UI changes (minimal expected)
- New admin features (if any)
- Troubleshooting guides

### 3. Runbook Creation
- Step-by-step migration procedures
- Rollback procedures
- Monitoring and alerting
- Incident response plans

## Next Steps

After completing Phase 1 planning:

1. ✅ Get stakeholder approval for migration plan
2. ✅ Schedule migration timeline with all teams
3. ✅ Set up development and testing environments
4. ✅ Create detailed backup and rollback procedures
5. ➡️ Proceed to [Phase 2: Database Infrastructure Changes](./02_database_changes.md)

## Checklist

- [ ] Tenant schema naming convention defined
- [ ] Table separation strategy documented
- [ ] Migration approach selected (Big Bang vs Gradual)
- [ ] Rollback strategy documented and tested
- [ ] Development environment prepared
- [ ] Team coordination completed  
- [ ] Risk assessment completed
- [ ] Success criteria defined
- [ ] Documentation plan created
- [ ] Stakeholder approval obtained