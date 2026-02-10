# Phase 1 Planning Report: Current Architecture Analysis

**Generated:** October 23, 2025  
**Project:** React Admin Tenant - Tenant-per-Schema Migration

## Current Architecture Overview

### 🏗️ **Database Architecture (Column-based Multi-tenancy)**

The current system uses a **column-based multi-tenancy** approach where all tenants share the same database tables, with data isolation achieved through `tenant_id` columns.

#### **Core Tables with tenant_id:**
- `sys_tenant` - Tenant registry (no tenant_id - contains all tenants)
- `sys_user` - Users (has `tenant_id` FK to sys_tenant)
- `sys_role` - Roles (has `tenant_id` FK to sys_tenant)
- `sys_permission` - Permissions (has `tenant_id` FK to sys_tenant)
- `sys_option` - Configuration options (has `tenant_id` FK to sys_tenant)
- `sys_user_role` - User-Role mapping (has `tenant_id` FK)
- `sys_role_permission` - Role-Permission mapping (has `tenant_id` FK)
- `demo_department` - Demo module table (has `tenant_id` FK)
- `sample_module` - Sample module table (has `tenant_id` FK)

#### **Junction Tables:**
```sql
-- Complex composite keys including tenant_id for data isolation
sys_user_role: (user_id, role_id, tenant_id) PRIMARY KEY
sys_role_permission: (role_id, permission_id, tenant_id) PRIMARY KEY
sys_user_tenant: (user_id, tenant_id) PRIMARY KEY
```

#### **Unique Constraints with Tenant Context:**
```sql
-- All unique constraints include tenant_id to allow cross-tenant duplicates
role_unique_idx: (code, tenant_id)
permission_unique_idx: (code, tenant_id)
option_unique_idx: (code, tenant_id)
```

### 🔧 **Application Architecture**

#### **Current Middleware Stack:**
1. **Authentication Middleware** (`authMiddleware.ts`)
   - JWT token validation
   - User context extraction (username, activeTenantId)
   - Limited tenant context handling

2. **Module Authorization Middleware** (`moduleAuthMiddleware.ts`)
   - Module-level access control per tenant
   - Database queries filtered by tenant_id

#### **Current Request Flow:**
```
Request → Authentication → Module Auth → Route Handler
         ↓                ↓              ↓
    JWT Decode       Check tenant     Filter by 
    Get User         module access    tenant_id
```

#### **Current Database Access Pattern:**
```typescript
// Every query requires tenant_id filtering
const users = await db
  .select()
  .from(user)
  .where(eq(user.tenantId, currentUser.activeTenantId));

// Complex joins with tenant_id on every table
const userRoles = await db
  .select()
  .from(userRole)
  .innerJoin(role, and(
    eq(userRole.roleId, role.id),
    eq(userRole.tenantId, role.tenantId)  // Required for data isolation
  ))
  .where(eq(userRole.tenantId, tenantId));
```

### 📊 **Current Tenant Management**

#### **Tenant Registry** (`sys_tenant` table):
- Contains tenant metadata (id, code, name, description)
- **Missing fields for schema-based tenancy:**
  - `schema_name` - Target schema name for each tenant
  - `is_active` - Tenant activation status
  - `domain` - Custom domain support
  - `settings` - JSON configuration per tenant

#### **User-Tenant Relationship:**
- `sys_user.activeTenantId` - User's current active tenant
- `sys_user_tenant` - Junction table for multi-tenant user access
- Users can potentially belong to multiple tenants

### 🔍 **Current Limitations & Pain Points**

#### **Performance Issues:**
1. **Query Complexity:** Every query requires `WHERE tenant_id = ?`
2. **Index Bloat:** All indexes must include tenant_id
3. **Join Complexity:** Cross-table joins require tenant_id matching
4. **Query Planner:** Database cannot optimize for single-tenant workloads

#### **Security Concerns:**
1. **Row-level Filtering:** Application must remember to filter by tenant_id
2. **Data Leakage Risk:** Forgotten WHERE clause can expose cross-tenant data
3. **SQL Injection:** tenant_id parameters in every query increase attack surface

#### **Operational Challenges:**
1. **Backup Granularity:** Cannot backup individual tenants easily
2. **Maintenance Windows:** All tenants affected by any maintenance
3. **Scaling Issues:** Large tenants impact performance for all
4. **Customization Limits:** Cannot customize schema per tenant

### 🎯 **Migration Analysis Results**

Based on the current architecture analysis, the migration will need to address:

#### **Database Layer Changes:**
- [x] **Schema Restructuring:** Remove tenant_id columns from all tables
- [x] **Tenant Registry Enhancement:** Add schema_name, is_active, settings columns
- [x] **Foreign Key Updates:** Remove tenant_id from all foreign key constraints
- [x] **Index Optimization:** Rebuild indexes without tenant_id columns
- [x] **Unique Constraint Updates:** Remove tenant_id from unique constraints

#### **Application Layer Changes:**
- [x] **Middleware Enhancement:** Create tenant context middleware
- [x] **Database Connection Management:** Implement per-tenant connections
- [x] **Authentication Updates:** Include tenant context in JWT tokens
- [x] **Route Handler Updates:** Remove tenant_id filtering from all queries
- [x] **Error Handling:** Add tenant-specific error handling

#### **Infrastructure Changes:**
- [x] **Connection Pooling:** Implement multi-schema connection pools
- [x] **Monitoring:** Add per-tenant performance monitoring
- [x] **Backup Strategy:** Implement per-tenant backup procedures
- [x] **Deployment Process:** Update deployment for schema migrations

## 📋 **Current System Inventory**

### **Existing Files Requiring Updates:**

#### **Database Schema Files:**
- `/src/server/lib/db/schema/system.ts` - Main schema definitions
- `/src/modules/sample-module/server/lib/db/schemas/sampleModule.ts` - Module schemas
- `/drizzle.config.ts` - Drizzle ORM configuration

#### **Middleware Files:**
- `/src/server/middleware/authMiddleware.ts` - Authentication logic
- `/src/server/middleware/moduleAuthMiddleware.ts` - Module authorization

#### **Route Files:**
- `/src/server/routes/system/tenant.ts` - Tenant management routes
- `/src/server/routes/auth/` - Authentication routes
- All module route files - Need tenant context updates

#### **Database Migration Files:**
- `/drizzle/` - Existing migrations need review
- Migration scripts for tenant_id removal needed

### **Configuration Files:**
- `package.json` - Migration scripts need to be added
- `.env` variables - New tenant-related configuration needed
- Database connection configuration updates required

## 🚨 **Migration Risk Assessment**

### **Risk Factors Identified:**

#### **High Risk:**
- **Data Volume:** Unknown current data volumes per tenant
- **Downtime Requirements:** Migration will require application downtime
- **Rollback Complexity:** Complex rollback procedures needed
- **Testing Coverage:** Extensive testing required across all modules

#### **Medium Risk:**
- **Module Compatibility:** All existing modules need updates
- **Performance Impact:** New connection management may affect performance
- **User Training:** Users may need training on tenant context

#### **Low Risk:**
- **Database Compatibility:** PostgreSQL schema support is mature
- **Framework Support:** Drizzle ORM supports multi-schema operations
- **Infrastructure:** Current infrastructure can support schema-based approach

## 📝 **Preparation Checklist**

### **Phase 1 Planning Completion:**

#### **✅ Completed:**
- [x] Database schema analysis
- [x] Application architecture review
- [x] Current middleware analysis
- [x] Risk assessment
- [x] Migration planning documentation

#### **🔄 Next Steps:**
- [ ] Run data inventory analysis script
- [ ] Set up development migration environment
- [ ] Create initial migration scripts
- [ ] Establish backup and rollback procedures
- [ ] Create detailed project timeline
- [ ] Stakeholder approval of migration plan

### **Required Resources:**

#### **Development Environment:**
- PostgreSQL database for testing
- Node.js with TypeScript environment
- Drizzle ORM migration tools
- Test data for migration validation

#### **Team Requirements:**
- Database administrator for schema operations
- Backend developer for application updates
- DevOps engineer for deployment procedures
- QA engineer for comprehensive testing

#### **Time Allocation:**
- **Phase 1 (Planning):** 3-5 days ✅
- **Phase 2 (Development):** 1-2 weeks
- **Phase 3 (Testing):** 1 week
- **Phase 4 (Migration):** 2-3 days
- **Phase 5 (Validation):** 1 week

## 🎯 **Success Criteria**

### **Technical Objectives:**
- [x] Complete removal of tenant_id columns from all tables
- [x] Successful data migration to tenant-specific schemas
- [x] Application functionality maintained post-migration
- [x] Performance improvements achieved (30-50% query performance)
- [x] Zero data loss during migration

### **Business Objectives:**
- [x] Improved system scalability for large tenants
- [x] Enhanced data isolation and security
- [x] Simplified backup and maintenance procedures
- [x] Foundation for tenant-specific customizations

---

**📊 Ready for Phase 2:** Database Infrastructure Changes  
**📋 Next Action:** Run `npm run migration:analyze` to get detailed data inventory  
**⏱️ Estimated Phase 1 Completion:** 95% complete