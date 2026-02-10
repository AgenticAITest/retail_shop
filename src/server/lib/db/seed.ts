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

async function main() {
  await seed();
  console.log("Seed completed");
  process.exit(0);
}

main();