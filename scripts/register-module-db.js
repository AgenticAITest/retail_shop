#!/usr/bin/env node

/**
 * Module Database Registration Script
 * 
 * This script registers a module in the database (moduleRegistry table)
 * using the module.json information and shared database connection.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function registerModuleInDatabase(moduleId) {
  try {
    const projectRoot = path.dirname(__dirname);
    
    // Check if temp file exists (created by register-module.js)
    const tempDataPath = path.join(projectRoot, 'modules', 'temp_module_registry.json');

    // create modules directory if not exists
    const modulesDir = path.join(projectRoot, 'modules');
    if (!fs.existsSync(modulesDir)) {
      fs.mkdirSync(modulesDir);
    }

    let moduleData = null;
    
    if (fs.existsSync(tempDataPath)) {
      console.log('📄 Found temp module registration data');
      moduleData = JSON.parse(fs.readFileSync(tempDataPath, 'utf8'));
      
      // Clean up temp file
      fs.unlinkSync(tempDataPath);
    } else if (moduleId) {
      // Read from module.json directly
      const moduleJsonPath = path.join(projectRoot, 'src', 'modules', moduleId, 'module.json');
      
      if (!fs.existsSync(moduleJsonPath)) {
        throw new Error(`Module.json not found for module: ${moduleId}`);
      }
      
      const moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf8'));
      
      moduleData = {
        moduleId: moduleJson.id || moduleId,
        moduleName: moduleJson.name || moduleId,
        description: moduleJson.description || '',
        version: moduleJson.version || '1.0.0',
        category: moduleJson.metadata?.category || 'Other',
        isActive: true,
        repositoryUrl: moduleJson.repository?.url || null,
        documentationUrl: moduleJson.author?.url || null,
      };
    } else {
      throw new Error('No module ID provided and no temp data found');
    }
    
    console.log('🔄 Connecting to database...');
    
    // Import database utilities (this will work when server is compiled/running)
    const { getSharedDb } = await import('../src/server/lib/db/tenant-connection-manager.js');
    const { moduleRegistry } = await import('../src/server/lib/db/schema/shared.js');
    const { eq } = await import('drizzle-orm');
    
    // Get shared database connection
    const sharedDb = await getSharedDb();
    
    console.log('✅ Database connected');
    
    // Check if module already exists in registry
    const existingModule = await sharedDb
      .select()
      .from(moduleRegistry)
      .where(eq(moduleRegistry.moduleId, moduleData.moduleId))
      .limit(1);
    
    if (existingModule.length > 0) {
      console.log('⚠️  Module already registered in database');
      console.log(`   Module: ${existingModule[0].moduleName}`);
      console.log(`   Version: ${existingModule[0].version}`);
      return;
    }
    
    console.log('📝 Inserting module into registry...');
    
    // Insert module into registry
    const [insertedModule] = await sharedDb
      .insert(moduleRegistry)
      .values(moduleData)
      .returning();
    
    console.log('✅ Module successfully registered in database!');
    console.log(`   Module ID: ${insertedModule.moduleId}`);
    console.log(`   Module Name: ${insertedModule.moduleName}`);
    console.log(`   Version: ${insertedModule.version}`);
    console.log(`   Category: ${insertedModule.category}`);
    console.log(`   Active: ${insertedModule.isActive}`);
    
  } catch (error) {
    console.error('❌ Failed to register module in database:', error.message);
    
    if (error.message.includes('Cannot resolve module')) {
      console.log('\n💡 Tip: Make sure the server is built first:');
      console.log('   1. Run: npm run build');
      console.log('   2. Or start the server: npm run dev');
      console.log('   3. Then try this command again');
    }
    
    process.exit(1);
  }
}

// Main execution
async function main() {
  const moduleId = process.argv[2];
  
  if (!moduleId && !fs.existsSync(path.join(path.dirname(__dirname), 'modules', 'temp_module_registry.json'))) {
    console.log('Usage: node register-module-db.js <module-id>');
    console.log('   or run after register-module.js to process temp data');
    process.exit(1);
  }
  
  console.log('\n🔧 Module Database Registration');
  console.log('===============================\n');
  
  await registerModuleInDatabase(moduleId);
}

// Check if this script is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { registerModuleInDatabase };