import bcrypt from "bcryptjs";
import { createTenantSchema, getSharedDb, getTenantDb } from "./tenant-connection-manager";
import * as sharedSchema from '../../lib/db/schema/sharedSchema';
import * as tenantSchema from '../../lib/db/schema/tenantSchema';


async function seed() {
  try {

    console.log("Starting seeding process...");
    const sharedDb = await getSharedDb();
  
    // insert new tenant into shared schema
    const newTenantId = crypto.randomUUID();
    const systemTenantCode = "system";
    const systemTenantName = "System Tenant";
    const username = "sysadmin";
    const fullname = "System Administrator";
    const email = "sysadmin@system.local";
    const passwordHash = await bcrypt.hash("S3cr3T", 10);

    console.log("Inserting system tenant shared schema...");
    await sharedDb.insert(sharedSchema.tenant).values({
      id: newTenantId,
      code: systemTenantCode,
      name: systemTenantName
    });

    // create tenant-specific database schema
    console.log("Creating system tenant schema...");
    await createTenantSchema(systemTenantCode);

    const tenantDb = await getTenantDb(systemTenantCode, tenantSchema);

    await tenantDb.transaction(async (tx) => {

      // insert admin role for the new tenant
      console.log("Inserting system admin role...");
      const systemAdminRole = await tx.insert(tenantSchema.role).values({
        id: crypto.randomUUID(),
        code: 'SYSADMIN',
        name: 'System Administrator',
        isSystem: true,
        description: 'System Administrator role',
      }).returning().then((rows) => rows[0]);

      const newUsername = `${username}@${systemTenantCode}`;
      console.log("Inserting system admin user...");
      const newUser = await tx.insert(tenantSchema.user).values({ 
        id: crypto.randomUUID(), username : newUsername, passwordHash, fullname, email, status: 'active'
      }).returning().then((rows) => rows[0]);;


      console.log("Linking role to user...");
      await tx.insert(tenantSchema.userRole).values({ userId: newUser.id, roleId: systemAdminRole.id });

      console.log("Inserting permissions...");
      const permIds = await tx.insert(tenantSchema.permission).values([
        //  tenant permission
        { id: crypto.randomUUID(), code: "system.tenant.view", name: "View Tenant", description: "Permission to view tenant"},
        { id: crypto.randomUUID(), code: "system.tenant.create", name: "Create Tenant", description: "Permission to add tenant"},
        { id: crypto.randomUUID(), code: "system.tenant.edit", name: "Edit Tenant", description: "Permission to edit tenant"},
        { id: crypto.randomUUID(), code: "system.tenant.delete", name: "Delete Tenant", description: "Permission to delete tenant"},

        { id: crypto.randomUUID(), code: "system.user.view", name: "View User", description: "Permission to view user"},
        { id: crypto.randomUUID(), code: "system.user.create", name: "Create User", description: "Permission to add user"},
        { id: crypto.randomUUID(), code: "system.user.edit", name: "Edit User", description: "Permission to edit user"},
        { id: crypto.randomUUID(), code: "system.user.delete", name: "Delete User", description: "Permission to delete user"},
        { id: crypto.randomUUID(), code: "system.user.reset_password", name: "Reset Password", description: "Permission to reset password user"},

        { id: crypto.randomUUID(), code: "system.role.view", name: "View Role", description: "Permission to view role"},
        { id: crypto.randomUUID(), code: "system.role.create", name: "Create Role", description: "Permission to add role"},
        { id: crypto.randomUUID(), code: "system.role.edit", name: "Edit Role", description: "Permission to edit role"},
        { id: crypto.randomUUID(), code: "system.role.delete", name: "Delete Role", description: "Permission to delete role"},

        { id: crypto.randomUUID(), code: "system.permission.view", name: "View Permission", description: "Permission to view permission"},
        { id: crypto.randomUUID(), code: "system.permission.create", name: "Create Permission", description: "Permission to add permission"},
        { id: crypto.randomUUID(), code: "system.permission.edit", name: "Edit Permission", description: "Permission to edit permission"},
        { id: crypto.randomUUID(), code: "system.permission.delete", name: "Delete Permission", description: "Permission to delete permission"},  
    
        { id: crypto.randomUUID(), code: "system.option.view", name: "View Option", description: "Permission to view option"},
        { id: crypto.randomUUID(), code: "system.option.create", name: "Create Option", description: "Permission to add option"},
        { id: crypto.randomUUID(), code: "system.option.edit", name: "Edit Option", description: "Permission to edit option"},
        { id: crypto.randomUUID(), code: "system.option.delete", name: "Delete Option", description: "Permission to delete option"},

        { id: crypto.randomUUID(), code: "system.module.view", name: "View Modules", description: "Permission to view modules"},
        { id: crypto.randomUUID(), code: "system.module.manage", name: "Manage Modules", description: "Permission to manage modules"},

      ]).returning().then((rows) => rows.map(r => r.id));
    });

    console.log("Inserting demo module ...");
    await sharedDb.insert(sharedSchema.moduleRegistry).values({
      id: crypto.randomUUID(),
      moduleId: "demo-module",
      moduleName: "Demo Module",
      description: "A module for demonstration purposes",
      isActive: true,
      version: "1.0.0",
      category: "Demo",
      repositoryUrl: "https://git.neo-fusion.com/demo-module",
      documentationUrl: "https://git.neo-fusion.com/demo-module",
    });

    console.log("Inserting showcase module ...");
    await sharedDb.insert(sharedSchema.moduleRegistry).values({
      id: crypto.randomUUID(),
      moduleId: "showcase-module",
      moduleName: "Showcase Module",
      description: "A module to showcase various features",
      isActive: true,
      version: "1.0.0",
      category: "Showcase",
      repositoryUrl: "https://git.neo-fusion.com/showcase-module",
      documentationUrl: "https://git.neo-fusion.com/showcase-module",
    });

    console.log("Inserting integration module ...");
    await sharedDb.insert(sharedSchema.moduleRegistry).values({
      id: crypto.randomUUID(),
      moduleId: "integration",
      moduleName: "Integration Module",
      description: "Module for integrating with external systems via APIs and webhooks",
      isActive: true,
      version: "1.0.0",
      category: "Integration",
      repositoryUrl: "https://git.neo-fusion.com/integration-module",
      documentationUrl: "https://git.neo-fusion.com/integration-module",
    });


    console.log("System Tenant registered successfully");
  } catch (e) {
    console.error('Error during seeding:', e);
  }
}

const RETAIL_MODULES = [
  { moduleId: 'location-management',  moduleName: 'Location Management',  category: 'Retail' },
  { moduleId: 'tax-configuration',    moduleName: 'Tax Configuration',     category: 'Retail' },
  { moduleId: 'product-catalog',      moduleName: 'Product Catalog',       category: 'Retail' },
  { moduleId: 'supplier-management',  moduleName: 'Supplier Management',   category: 'Retail' },
  { moduleId: 'approval-engine',      moduleName: 'Approval Engine',       category: 'Retail' },
  { moduleId: 'purchase-order',       moduleName: 'Purchase Order',        category: 'Retail' },
  { moduleId: 'grn',                  moduleName: 'Goods Receipt Note',    category: 'Retail' },
  { moduleId: 'supplier-return',      moduleName: 'Supplier Return',       category: 'Retail' },
  { moduleId: 'pos',                  moduleName: 'Point of Sale',         category: 'Retail' },
  { moduleId: 'transfer',             moduleName: 'Stock Transfer',        category: 'Retail' },
  { moduleId: 'inventory-management', moduleName: 'Inventory Management',  category: 'Retail' },
  { moduleId: 'report',               moduleName: 'Reports & Analytics',   category: 'Retail' },
  { moduleId: 'moka-migration',       moduleName: 'MokaPOS Migration',     category: 'Tools'  },
];

async function seedTestTenant() {
  console.log("\n--- Seeding test tenant (tmj) ---");
  const sharedDb = await getSharedDb();

  // Register retail modules in shared registry (skip if already registered)
  console.log("Registering retail modules...");
  for (const mod of RETAIL_MODULES) {
    await sharedDb.insert(sharedSchema.moduleRegistry).values({
      id: crypto.randomUUID(),
      moduleId: mod.moduleId,
      moduleName: mod.moduleName,
      description: mod.moduleName,
      isActive: true,
      version: '1.0.0',
      category: mod.category,
    }).onConflictDoNothing();
  }

  const tmjId = crypto.randomUUID();
  const tmjCode = 'tmj';
  const tmjName = 'Toko Maju Jaya';
  const testPassword = await bcrypt.hash('S3cr3T', 10);

  console.log("Inserting tmj tenant...");
  await sharedDb.insert(sharedSchema.tenant).values({
    id: tmjId,
    code: tmjCode,
    name: tmjName,
    status: 'active',
  });

  console.log("Creating tmj tenant schema...");
  await createTenantSchema(tmjCode);

  const tenantDb = await getTenantDb(tmjCode, tenantSchema);

  await tenantDb.transaction(async (tx) => {
    // --- Roles ---
    console.log("Creating roles...");
    const adminRole = await tx.insert(tenantSchema.role).values({
      id: crypto.randomUUID(), code: 'ADMIN', name: 'Tenant Administrator',
      isSystem: true, description: 'Full access to all tenant features',
    }).returning().then(r => r[0]);

    const managerRole = await tx.insert(tenantSchema.role).values({
      id: crypto.randomUUID(), code: 'MANAGER', name: 'Store Manager',
      isSystem: true, description: 'POS + reports + approvals',
    }).returning().then(r => r[0]);

    const cashierRole = await tx.insert(tenantSchema.role).values({
      id: crypto.randomUUID(), code: 'CASHIER', name: 'Cashier',
      isSystem: true, description: 'POS sales only',
    }).returning().then(r => r[0]);

    // --- Permissions ---
    console.log("Creating permissions...");
    const allPerms = await tx.insert(tenantSchema.permission).values([
      { id: crypto.randomUUID(), code: 'system.user.view',            name: 'View Users',           description: 'View users' },
      { id: crypto.randomUUID(), code: 'system.user.create',          name: 'Create Users',         description: 'Create users' },
      { id: crypto.randomUUID(), code: 'system.user.edit',            name: 'Edit Users',           description: 'Edit users' },
      { id: crypto.randomUUID(), code: 'system.user.delete',          name: 'Delete Users',         description: 'Delete users' },
      { id: crypto.randomUUID(), code: 'system.user.reset_password',  name: 'Reset Password',       description: 'Reset user password' },
      { id: crypto.randomUUID(), code: 'system.role.view',            name: 'View Roles',           description: 'View roles' },
      { id: crypto.randomUUID(), code: 'system.role.create',          name: 'Create Roles',         description: 'Create roles' },
      { id: crypto.randomUUID(), code: 'system.role.edit',            name: 'Edit Roles',           description: 'Edit roles' },
      { id: crypto.randomUUID(), code: 'system.role.delete',          name: 'Delete Roles',         description: 'Delete roles' },
      { id: crypto.randomUUID(), code: 'system.permission.view',      name: 'View Permissions',     description: 'View permissions' },
      { id: crypto.randomUUID(), code: 'system.option.view',          name: 'View Options',         description: 'View options' },
      { id: crypto.randomUUID(), code: 'system.option.edit',          name: 'Edit Options',         description: 'Edit options' },
      { id: crypto.randomUUID(), code: 'system.module.view',          name: 'View Modules',         description: 'View modules' },
      { id: crypto.randomUUID(), code: 'retail.location.view',        name: 'View Locations',       description: 'View locations' },
      { id: crypto.randomUUID(), code: 'retail.location.create',      name: 'Create Location',      description: 'Create locations' },
      { id: crypto.randomUUID(), code: 'retail.location.edit',        name: 'Edit Location',        description: 'Edit locations' },
      { id: crypto.randomUUID(), code: 'retail.location.delete',      name: 'Delete Location',      description: 'Delete locations' },
      { id: crypto.randomUUID(), code: 'retail.product.view',         name: 'View Products',        description: 'View products' },
      { id: crypto.randomUUID(), code: 'retail.product.create',       name: 'Create Product',       description: 'Create products' },
      { id: crypto.randomUUID(), code: 'retail.product.edit',         name: 'Edit Product',         description: 'Edit products' },
      { id: crypto.randomUUID(), code: 'retail.product.delete',       name: 'Delete Product',       description: 'Delete products' },
      { id: crypto.randomUUID(), code: 'retail.product.import',       name: 'Import Products',      description: 'Import products' },
      { id: crypto.randomUUID(), code: 'retail.supplier.view',        name: 'View Suppliers',       description: 'View suppliers' },
      { id: crypto.randomUUID(), code: 'retail.supplier.create',      name: 'Create Supplier',      description: 'Create suppliers' },
      { id: crypto.randomUUID(), code: 'retail.supplier.edit',        name: 'Edit Supplier',        description: 'Edit suppliers' },
      { id: crypto.randomUUID(), code: 'retail.supplier.delete',      name: 'Delete Supplier',      description: 'Delete suppliers' },
      { id: crypto.randomUUID(), code: 'retail.po.view',              name: 'View POs',             description: 'View purchase orders' },
      { id: crypto.randomUUID(), code: 'retail.po.create',            name: 'Create PO',            description: 'Create purchase orders' },
      { id: crypto.randomUUID(), code: 'retail.po.edit',              name: 'Edit PO',              description: 'Edit purchase orders' },
      { id: crypto.randomUUID(), code: 'retail.po.approve',           name: 'Approve PO',           description: 'Approve purchase orders' },
      { id: crypto.randomUUID(), code: 'retail.grn.view',             name: 'View GRN',             description: 'View GRNs' },
      { id: crypto.randomUUID(), code: 'retail.grn.create',           name: 'Create GRN',           description: 'Create GRNs' },
      { id: crypto.randomUUID(), code: 'retail.grn.approve',          name: 'Approve GRN',          description: 'Approve GRNs' },
      { id: crypto.randomUUID(), code: 'retail.pos.sale',             name: 'Process Sale',         description: 'Process POS sales' },
      { id: crypto.randomUUID(), code: 'retail.pos.return',           name: 'Process Return',       description: 'Process POS returns' },
      { id: crypto.randomUUID(), code: 'retail.pos.void',             name: 'Void Transaction',     description: 'Void transactions' },
      { id: crypto.randomUUID(), code: 'retail.pos.discount',         name: 'Apply Discount',       description: 'Apply discounts' },
      { id: crypto.randomUUID(), code: 'retail.pos.shift',            name: 'Manage Shift',         description: 'Open/close shifts' },
      { id: crypto.randomUUID(), code: 'retail.pos.reprint',          name: 'Reprint Receipt',      description: 'Reprint receipts' },
      { id: crypto.randomUUID(), code: 'retail.transfer.view',        name: 'View Transfers',       description: 'View transfers' },
      { id: crypto.randomUUID(), code: 'retail.transfer.create',      name: 'Create Transfer',      description: 'Create transfers' },
      { id: crypto.randomUUID(), code: 'retail.transfer.approve',     name: 'Approve Transfer',     description: 'Approve transfers' },
      { id: crypto.randomUUID(), code: 'retail.transfer.dispatch',    name: 'Dispatch Transfer',    description: 'Dispatch transfers' },
      { id: crypto.randomUUID(), code: 'retail.transfer.receive',     name: 'Receive Transfer',     description: 'Receive transfers' },
      { id: crypto.randomUUID(), code: 'retail.inventory.view',       name: 'View Inventory',       description: 'View inventory' },
      { id: crypto.randomUUID(), code: 'retail.inventory.adjust',     name: 'Adjust Stock',         description: 'Adjust stock' },
      { id: crypto.randomUUID(), code: 'retail.inventory.count',      name: 'Stock Count',          description: 'Perform stock counts' },
      { id: crypto.randomUUID(), code: 'retail.report.view',          name: 'View Reports',         description: 'View reports' },
      { id: crypto.randomUUID(), code: 'retail.report.export',        name: 'Export Reports',       description: 'Export reports' },
      { id: crypto.randomUUID(), code: 'retail.tax.view',             name: 'View Tax Config',      description: 'View tax config' },
      { id: crypto.randomUUID(), code: 'retail.tax.edit',             name: 'Edit Tax Config',      description: 'Edit tax config' },
      { id: crypto.randomUUID(), code: 'retail.approval.view',        name: 'View Approvals',       description: 'View approvals' },
      { id: crypto.randomUUID(), code: 'retail.approval.manage',      name: 'Manage Approvals',     description: 'Manage approval rules' },
      { id: crypto.randomUUID(), code: 'retail.approval.action',      name: 'Action Approvals',     description: 'Approve/reject items' },
      { id: crypto.randomUUID(), code: 'moka-migration.migration.view',   name: 'View Migrations',  description: 'View migration history' },
      { id: crypto.randomUUID(), code: 'moka-migration.migration.import', name: 'Import Migration', description: 'Run moka import' },
      { id: crypto.randomUUID(), code: 'moka-migration.migration.delete', name: 'Delete Migration', description: 'Rollback migration' },
    ]).returning().then(r => r.map(p => ({ id: p.id, code: p.code })));

    const permByCode = Object.fromEntries(allPerms.map(p => [p.code, p.id]));

    // ADMIN gets everything
    for (const perm of allPerms) {
      await tx.insert(tenantSchema.rolePermission).values({ roleId: adminRole.id, permissionId: perm.id });
    }

    // MANAGER: POS, transfers, inventory view/count, reports, approvals, PO view/approve, GRN view/approve
    const managerPermCodes = [
      'system.user.view',
      'retail.pos.sale', 'retail.pos.return', 'retail.pos.void', 'retail.pos.discount', 'retail.pos.shift', 'retail.pos.reprint',
      'retail.transfer.view', 'retail.transfer.approve', 'retail.transfer.dispatch', 'retail.transfer.receive',
      'retail.inventory.view', 'retail.inventory.count',
      'retail.report.view', 'retail.report.export',
      'retail.approval.view', 'retail.approval.action',
      'retail.po.view', 'retail.po.approve',
      'retail.grn.view', 'retail.grn.approve',
      'retail.product.view', 'retail.location.view', 'retail.supplier.view',
    ];
    for (const code of managerPermCodes) {
      if (permByCode[code]) {
        await tx.insert(tenantSchema.rolePermission).values({ roleId: managerRole.id, permissionId: permByCode[code] });
      }
    }

    // CASHIER: POS only
    const cashierPermCodes = ['retail.pos.sale', 'retail.pos.return', 'retail.pos.shift', 'retail.pos.reprint', 'retail.product.view'];
    for (const code of cashierPermCodes) {
      if (permByCode[code]) {
        await tx.insert(tenantSchema.rolePermission).values({ roleId: cashierRole.id, permissionId: permByCode[code] });
      }
    }

    // --- Users ---
    console.log("Creating test users...");
    const adminUser = await tx.insert(tenantSchema.user).values({
      id: crypto.randomUUID(), username: `admin@${tmjCode}`, passwordHash: testPassword,
      fullname: 'Tenant Admin', email: 'admin@tmj.test', status: 'active',
    }).returning().then(r => r[0]);

    const managerUser = await tx.insert(tenantSchema.user).values({
      id: crypto.randomUUID(), username: `manager@${tmjCode}`, passwordHash: testPassword,
      fullname: 'Store Manager', email: 'manager@tmj.test', status: 'active',
    }).returning().then(r => r[0]);

    const cashierUser = await tx.insert(tenantSchema.user).values({
      id: crypto.randomUUID(), username: `cashier@${tmjCode}`, passwordHash: testPassword,
      fullname: 'Cashier', email: 'cashier@tmj.test', status: 'active',
    }).returning().then(r => r[0]);

    await tx.insert(tenantSchema.userRole).values([
      { userId: adminUser.id,   roleId: adminRole.id   },
      { userId: managerUser.id, roleId: managerRole.id },
      { userId: cashierUser.id, roleId: cashierRole.id },
    ]);

    // --- Module authorization ---
    console.log("Authorizing modules for tmj...");
    const now = new Date();
    await tx.insert(tenantSchema.moduleAuthorization).values(
      RETAIL_MODULES.map(mod => ({
        id: crypto.randomUUID(),
        moduleId: mod.moduleId,
        moduleName: mod.moduleName,
        isEnabled: true,
        enabledAt: now,
        enabledBy: `admin@${tmjCode}`,
      }))
    );
  });

  console.log("Test tenant (tmj) seeded successfully.");
  console.log("  Users: admin@tmj / manager@tmj / cashier@tmj  (password: S3cr3T)");
}

async function main() {
  await seed();
  await seedTestTenant();
  console.log("Seed completed");
  process.exit(0);
}

main();