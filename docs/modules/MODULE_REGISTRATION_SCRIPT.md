# Module Registration Script Documentation

## 🎯 Overview

The `register-module.js` script automates the 4-step manual module registration process, making it quick and error-free to integrate existing modules into the React Admin application.

## 🚀 Usage

```bash
# Interactive registration
npm run register-module

# Or run directly
node scripts/register-module.js
```

## 📋 What It Does

The script follows the exact same steps as the manual registration guide but automates them:

### **Step 1: Register Client Routes**
- **File**: `src/client/route.ts`
- **Action**: Adds module import and route registration
- **Example**:
```typescript
// Adds import
import { sampleModuleReactRoutes } from '../modules/sample-module/client/routes/sampleModuleReactRoutes';

// Adds route in console children
{
  path: "console",
  Component: ConsoleLayout,
  children: [
    // ... existing routes
    sampleModuleReactRoutes("modules/sample-module"), // ← Added automatically
  ],
}
```

### **Step 2: Register Server Routes**
- **File**: `src/server/main.ts`
- **Action**: Adds module import and API route registration
- **Example**:
```typescript
// Adds import
import sampleModuleRoutes from '../modules/sample-module/server/routes/sampleModuleRoutes';

// Adds route registration
app.use('/api/modules/sample-module', sampleModuleRoutes); // ← Added automatically
```

### **Step 3: Register Sidebar Menu**
- **File**: `src/client/components/app-sidebar.tsx`
- **Action**: Adds menu import and registration
- **Example**:
```typescript
// Adds import
import { sampleModuleSidebarMenus } from '@modules/sample-module/client/menus/sideBarMenus';

// Adds to menu items
const menuItems = [
  // ... existing items
  sampleModuleSidebarMenus, // ← Added automatically
];
```

### **Step 4: Update Schema Exports**
- **File**: `src/server/lib/db/schema/index.ts` (if exists)
- **Action**: Exports module schemas centrally
- **Example**:
```typescript
// Adds schema export
export * from '@modules/sample-module/server/lib/db/schemas/sampleModule'; // ← Added automatically
```

## 🛡️ Safety Features

### **Duplicate Detection**
- Checks if module is already registered before making changes
- Prevents duplicate imports and registrations
- Shows warnings for already-registered modules

### **File Validation**
- Verifies target files exist before attempting modifications
- Graceful handling of missing optional files
- Clear error messages for missing required files

### **Smart Pattern Matching**
- Uses robust regex patterns to find insertion points
- Maintains proper code formatting and indentation
- Preserves existing code structure

## 🔄 Registration Flow

```
1. 📋 List available modules
2. 👤 User selects module to register
3. 🔍 Validate module exists and has required files
4. 📝 Step 1: Register client routes
5. 🔌 Step 2: Register server routes  
6. 🎨 Step 3: Register sidebar menu
7. 📊 Step 4: Update schema exports
8. ✅ Success confirmation and next steps
```

## 📁 Example Registration

For a module named `inventory-management`:

### **Before Registration** (Manual Process Required):
```
❌ Module exists but not integrated
❌ Routes not accessible
❌ API endpoints not registered
❌ Menu not visible in sidebar
❌ Schemas not exported centrally
```

### **After Registration** (Fully Integrated):
```
✅ Client routes: /console/modules/inventory-management
✅ API endpoints: /api/modules/inventory-management/*  
✅ Sidebar menu visible and functional
✅ Schema exports available centrally
✅ TypeScript imports resolved
✅ Ready for development/production
```

## 🎪 Interactive Process

```bash
$ npm run register-module

🔧 React Admin Module Registration Script
==========================================

Available modules:
1. sample-module
2. inventory-management
3. user-profile

Select module number to register: 2

📦 Registering module: inventory-management
   Camel case: inventoryManagement
   Pascal case: InventoryManagement

🔄 Starting registration process...
✅ Step 1: Client routes registered
✅ Step 2: Server routes registered
✅ Step 3: Sidebar menu registered
✅ Step 4: Schema exports updated
✅ All registration steps completed

✅ Module registration completed successfully!

📝 Next steps:
1. Start the development server: npm run dev
2. Check that routes are accessible
3. Verify API endpoints work
4. Test the UI navigation
5. Run database migrations if needed
```

## ⚠️ Important Notes

1. **Run After Module Creation**: This script registers existing modules, use after `create-module`
2. **Backup Recommended**: Though safe, backup critical files before bulk registrations
3. **Manual Sidebar**: If sidebar auto-registration fails, manual addition may be needed
4. **File Structure**: Assumes standard module structure from `create-module` script
5. **TypeScript**: Restart TypeScript server after registration for import resolution

## 🔗 Integration with Other Scripts

### **Complete Workflow:**
```bash
# 1. Create new module
npm run create-module

# 2. Register the module  
npm run register-module

# 3. Add additional pages to module
npm run add-page

# 4. Start development
npm run dev
```

This script completes the module lifecycle automation, making module development seamless and error-free! 🎉