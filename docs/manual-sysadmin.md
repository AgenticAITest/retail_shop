# System Administrator User Manual
## Multi-Shop Retail Management System

**Audience:** SYSADMIN role — the person who manages the platform itself, creates tenants, and controls which features each tenant can use.

---

## Table of Contents

1. [Overview & Your Role](#1-overview--your-role)
2. [Logging In](#2-logging-in)
3. [Dashboard](#3-dashboard)
4. [Tenant Management](#4-tenant-management)
5. [Module Registry](#5-module-registry)
6. [Module Authorization per Tenant](#6-module-authorization-per-tenant)
7. [User Management](#7-user-management)
8. [Roles & Permissions](#8-roles--permissions)
9. [System Options](#9-system-options)
10. [Tenant Onboarding Checklist](#10-tenant-onboarding-checklist)
11. [Common Tasks Reference](#11-common-tasks-reference)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Overview & Your Role

As a **SYSADMIN**, you operate at the platform level — above any individual tenant. You do not manage day-to-day retail operations. Instead, you:

- Create and manage **tenants** (separate businesses or shop groups)
- Control which **modules** each tenant has access to
- Manage **system-level users** and permissions
- Configure global **roles** and **permissions** that all tenants inherit
- Monitor overall platform health

> **What you do NOT do:** You do not create products, process POS sales, or manage supplier orders. Those tasks belong to each tenant's own ADMIN user.

### Tenant Isolation

Each tenant is completely isolated from others. They have their own:
- Database schema (`tenant_{code}`)
- Users, roles, and permissions
- Products, inventory, orders
- Financial data

You can see tenant names and configurations, but you cannot see their transaction data.

---

## 2. Logging In

1. Open the application in your browser: `http://your-domain.com` (or `http://localhost:5000` in development)
2. You will be redirected to the **Login** page
3. Enter your credentials:
   - **Username:** `sysadmin` (default)
   - **Password:** `password` (change this immediately in production)
4. Click **Login**

> **Security:** Change the default SYSADMIN password immediately after first login. Go to **System → User → sysadmin → Reset Password**.

### Logging Out

Click your username/avatar in the bottom-left sidebar, then click **Log out**.

---

## 3. Dashboard

After login, you land on the **Console Dashboard**. As SYSADMIN you have full visibility across all system sections.

The sidebar on the left contains all navigation. Key sections for you:
- **System** — your primary workspace
- Any retail modules visible in the sidebar belong to your own SYSADMIN account and demonstrate system functionality

---

## 4. Tenant Management

Tenants are the businesses that use this platform. Each tenant is a separate retail group (e.g., "Toko Maju Jaya" with 3 shop locations).

### 4.1 Viewing All Tenants

**Navigation:** System → Tenant

The Tenant List shows:
| Column | Description |
|--------|-------------|
| Name | Business name |
| Code | Short unique identifier (e.g., `tmj`). Used in the database schema name. |
| Status | Active / Inactive |
| Created | Date tenant was created |

You can **search** by name or code, and **sort** by any column.

### 4.2 Creating a New Tenant

**Navigation:** System → Tenant → **+ Add Tenant**

Fill in:

| Field | Required | Notes |
|-------|----------|-------|
| **Name** | Yes | Full business name (e.g., "Toko Maju Jaya") |
| **Code** | Yes | Short code, lowercase letters and numbers only, no spaces (e.g., `tmj`). This becomes the database schema name — **cannot be changed later**. |
| **Status** | Yes | Set to **Active** to allow login |

Click **Save**. The system will:
1. Create the tenant record in the database
2. Create the isolated database schema (`tenant_tmj`)
3. Set up default roles (ADMIN, MANAGER, CASHIER)
4. Set up default permissions for all registered modules

> **Important:** Creating a tenant does NOT create any users or authorize any modules. You must do those steps separately (see Sections 6 and 7).

### 4.3 Editing a Tenant

**Navigation:** System → Tenant → click tenant name → **Edit**

You can change:
- Tenant name
- Status (Active/Inactive)

> **You cannot change the tenant code** after creation — it is the database schema identifier.

### 4.4 Deactivating a Tenant

To suspend a tenant (e.g., for non-payment), edit the tenant and set **Status → Inactive**.

Inactive tenants cannot log in. Their data is preserved and can be reactivated at any time by setting Status back to Active.

### 4.5 Deleting a Tenant

> **Warning:** Deleting a tenant permanently removes their database schema and ALL data. This is irreversible. Only do this if you are certain the data is no longer needed.

From the tenant view, click the **Delete** button and confirm.

---

## 5. Module Registry

The Module Registry is the master list of all modules available on the platform. Think of it as an app store — modules listed here can be authorized to specific tenants.

**Navigation:** System → Module Registry

> **Access:** Only SYSADMIN can manage the Module Registry.

### 5.1 Viewing Registered Modules

The Module Registry list shows all installed modules with their:
- Module ID (e.g., `product-catalog`)
- Display name
- Version
- Category
- Status (Active/Inactive)

### 5.2 Adding a New Module to the Registry

When a developer creates a new module, you register it here so it can be authorized to tenants.

**Navigation:** System → Module Registry → **+ Add Module**

Fill in the module metadata (module ID, name, description, version). The developer provides these values.

### 5.3 Editing Module Metadata

Click on any module → **Edit** to update the display name, description, or status.

> Setting a module to **Inactive** in the registry will disable it for ALL tenants, even those who have it authorized. Use this to globally disable a broken module.

---

## 6. Module Authorization per Tenant

Module Authorization controls which modules a tenant can use. Each module must be **authorized** before a tenant's users can access it.

**Navigation:** System → Modules (under the System menu)

### 6.1 Authorizing Modules for a Tenant

1. Navigate to **System → Modules**
2. Select the target tenant from the tenant selector (top of page)
3. You will see all registered modules with their authorization status
4. Toggle the switch next to each module to **authorize** or **revoke** it
5. Changes take effect immediately — no restart required

### 6.2 Which Modules to Authorize

For a typical retail tenant, authorize all of these:

| Module | Purpose | Required For |
|--------|---------|-------------|
| `location-management` | Manage shop locations | All other modules |
| `tax-configuration` | PPN/VAT setup | POS, Reports |
| `product-catalog` | Products, categories, barcodes | POS, Procurement, Inventory |
| `approval-engine` | Approval workflows | PO, Transfers, Returns |
| `supplier-management` | Supplier master data | Purchase Orders |
| `purchase-order` | Buy goods from suppliers | Procurement flow |
| `grn` | Receive goods | Procurement flow |
| `supplier-return` | Return defective goods | Procurement flow |
| `pos` | Point of Sale terminal | Daily sales |
| `transfer` | Move stock between shops | Multi-location |
| `inventory-management` | Stock counts, adjustments | Inventory control |
| `report` | Analytics and reporting | Management oversight |
| `moka-migration` | Import from MokaPOS | Initial data load only |

### 6.3 Revoking a Module

Toggle the switch off for any module to revoke tenant access. Their data is preserved — they simply cannot access that module's screens until re-authorized.

---

## 7. User Management

System-level user management allows you to create users for the SYSADMIN context. **Tenant users** (ADMIN, MANAGER, CASHIER) are created by each tenant's own ADMIN, not by you.

**Navigation:** System → User

### 7.1 Creating a System User

**Navigation:** System → User → **+ Add User**

| Field | Required | Notes |
|-------|----------|-------|
| **Full Name** | Yes | Display name |
| **Username** | Yes | Login identifier, lowercase, no spaces |
| **Email** | No | For notifications |
| **Password** | Yes | Minimum 8 characters |
| **Status** | Yes | Active / Inactive |

After creating the user, assign them a **Role** (see Section 8).

### 7.2 Resetting a User's Password

**Navigation:** System → User → click username → **Reset Password**

Enter and confirm the new password. The user will use this new password on their next login.

### 7.3 Deactivating a User

Edit the user and set **Status → Inactive**. The user cannot log in while inactive. Reactivate by setting Status back to Active.

---

## 8. Roles & Permissions

The system has four built-in roles. As SYSADMIN, you can view and manage all roles and their associated permissions.

**Navigation:** System → Role

### 8.1 Built-in Roles

| Role | Who Uses It | What They Can Do |
|------|-------------|-----------------|
| **SYSADMIN** | Platform administrators | Everything — all screens, all tenants, no restrictions |
| **ADMIN** | Shop owners / Tenant managers | All retail modules within their tenant |
| **MANAGER** | Store managers | View most things, create orders, run reports |
| **CASHIER** | Cash register operators | POS sales terminal only |

> **SYSADMIN bypasses all permission checks.** You will never be denied access to any screen.

### 8.2 Viewing Role Permissions

**Navigation:** System → Role → click a role name

You will see a complete list of permissions assigned to that role, organized by module.

### 8.3 Creating a Custom Role

**Navigation:** System → Role → **+ Add Role**

1. Enter a **Role Code** (e.g., `SUPERVISOR`) — uppercase, no spaces
2. Enter a **Display Name**
3. Save, then click on the role to add permissions

### 8.4 Assigning Permissions to a Role

1. Open the role
2. Click **Edit Permissions** or **Add Permission**
3. Select the permission(s) to add from the available list
4. Save

### 8.5 Importing Role Permissions

**Navigation:** System → Role → **Import**

Bulk-import permission assignments from a CSV file. Useful for setting up new tenants with pre-defined role configurations.

---

## 9. System Options

System Options are key-value configuration settings that control platform behavior.

**Navigation:** System → Option

### 9.1 Viewing Options

The Option List shows all configured options with their keys, values, and descriptions.

### 9.2 Adding a New Option

**Navigation:** System → Option → **+ Add Option**

| Field | Notes |
|-------|-------|
| **Key** | Unique identifier, e.g., `max_csv_rows` |
| **Value** | The setting value |
| **Description** | Human-readable explanation |

### 9.3 Editing an Option

Click on any option → **Edit** → modify value → **Save**.

---

## 10. Tenant Onboarding Checklist

Follow these steps in order when setting up a new tenant:

### Step 1: Create the Tenant
1. Go to **System → Tenant → + Add Tenant**
2. Enter business name and a unique code
3. Set status to **Active**
4. Save

### Step 2: Authorize Modules
1. Go to **System → Modules**
2. Select the new tenant
3. Enable all relevant modules (see Section 6.2 for the standard list)

### Step 3: Create the Tenant Admin User
> The tenant admin creates their own users, but you may need to create the initial ADMIN user.

1. Ask the tenant what username/password they want for their admin account
2. Go to the application's **Register** page (`/auth/register`) — or have them do it themselves
   - Alternatively, if you have direct DB access, insert the user into `tenant_{code}.sys_user`
3. Assign the **ADMIN** role to that user

### Step 4: Hand Off to Tenant Admin

Provide the tenant admin with:
- The application URL
- Their admin username and password
- The `X-Tenant-Code` header value (their tenant code) if they're using a non-subdomain setup
- The **Tenant Admin Manual** (see separate document)

### Step 5: Tenant Admin Completes Setup

The tenant admin will:
1. Log in and set up locations
2. Configure tax settings
3. Add products and categories
4. Add suppliers
5. Set up approval rules
6. Create staff users (managers, cashiers)
7. Run initial inventory (or import from MokaPOS)

---

## 11. Common Tasks Reference

### How do I find out which modules a tenant has enabled?
Go to **System → Modules**, select the tenant in the dropdown.

### How do I see all tenants at once?
Go to **System → Tenant**. All tenants are listed with their status.

### How do I disable a module globally (emergency)?
Go to **System → Module Registry**, find the module, click **Edit**, set status to **Inactive**.

### How do I reset a tenant admin's forgotten password?
If the tenant admin cannot reset their own password:
1. Go to **System → User**
2. Find the user (you may need to switch tenant context)
3. Click **Reset Password**

### How do I check if the system is healthy?
The API health endpoint is: `GET /api/health`

It returns:
```json
{
  "status": "healthy",
  "services": {
    "database": "up",
    "redis": "up"
  },
  "tenantConnections": { ... }
}
```

You can also check the logs. The system uses structured JSON logging — look for `"level":"error"` entries.

---

## 12. Troubleshooting

### A tenant says they cannot log in

1. Check tenant status: **System → Tenant** — is it Active?
2. Check the user status: **System → User** — is the user Active?
3. Confirm they are using the correct tenant code (if using the `X-Tenant-Code` header approach)
4. Ask them to try resetting their password

### A tenant says a module is not visible

1. Go to **System → Modules**, select their tenant
2. Confirm the module is **authorized** (toggle is ON)
3. Ask the tenant's ADMIN to check that the user's **role** has the relevant permission

### A module was accidentally deauthorized for a tenant

Re-authorize it from **System → Modules**. Their data is safe — module deauthorization only hides the UI.

### A new module is not showing in the Module Authorization list

The module must first be added to the **Module Registry** (System → Module Registry → + Add). Have the developer provide the module metadata.

### The system is slow or unresponsive

Check the health endpoint. Look for Redis or database connection issues in the logs. Contact your DevOps team with the log output.

---

*Last updated: May 2026 | System version: 1.0.0*
