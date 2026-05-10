import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSharedDb } from '../db/tenant-connection-manager';
import { moduleRegistry } from '../db/schema/shared';
import { eq } from 'drizzle-orm';
import { logger } from '../logger';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Process pending module registrations
 * This function is called during server startup to register any modules
 * that have pending registration data
 */
export async function processPendingModuleRegistrations(): Promise<void> {
  try {
    const projectRoot = path.resolve(__dirname, '../../../..');
    const tempDataPath = path.join(projectRoot, 'modules', 'temp_module_registry.json');

    // create modules directory if not exists
    const modulesDir = path.join(projectRoot, 'modules');
    if (!fs.existsSync(modulesDir)) {
      fs.mkdirSync(modulesDir);
    }
    
    // Check if there's pending registration data
    if (!fs.existsSync(tempDataPath)) {
      return; // No pending registrations
    }
    
    logger.info('Found pending module registration data');

    // Read the pending data
    const moduleData = JSON.parse(fs.readFileSync(tempDataPath, 'utf8'));

    logger.info({ moduleName: moduleData.moduleName }, 'Processing module registration');
    
    // Get shared database connection
    const sharedDb = await getSharedDb();
    
    // Check if module already exists in registry
    const existingModule = await sharedDb
      .select()
      .from(moduleRegistry)
      .where(eq(moduleRegistry.moduleId, moduleData.moduleId))
      .limit(1);
    
    if (existingModule.length > 0) {
      logger.info({ moduleId: moduleData.moduleId }, 'Module already registered in database');

      // Clean up temp file since module is already registered
      fs.unlinkSync(tempDataPath);
      return;
    }

    // Insert module into registry
    const [insertedModule] = await sharedDb
      .insert(moduleRegistry)
      .values(moduleData)
      .returning();

    logger.info(
      { moduleId: insertedModule.moduleId, moduleName: insertedModule.moduleName, version: insertedModule.version },
      'Module registered in database',
    );

    // Clean up temp file
    fs.unlinkSync(tempDataPath);
    logger.debug('Cleaned up temporary registration data');

  } catch (error) {
    logger.error({ err: error }, 'Failed to process pending module registrations');
    // Don't throw - we don't want to crash the server for this
  }
}

/**
 * Register a specific module by reading its module.json
 */
export async function registerModuleFromJson(moduleId: string): Promise<boolean> {
  try {
    const projectRoot = path.resolve(__dirname, '../../../..');
    const moduleJsonPath = path.join(projectRoot, 'src', 'modules', moduleId, 'module.json');
    
    if (!fs.existsSync(moduleJsonPath)) {
      throw new Error(`Module.json not found for module: ${moduleId}`);
    }
    
    const moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf8'));
    
    const moduleData = {
      moduleId: moduleJson.id || moduleId,
      moduleName: moduleJson.name || moduleId,
      description: moduleJson.description || '',
      version: moduleJson.version || '1.0.0',
      category: moduleJson.metadata?.category || 'Other',
      isActive: true,
      repositoryUrl: moduleJson.repository?.url || null,
      documentationUrl: moduleJson.author?.url || null,
    };
    
    // Get shared database connection
    const sharedDb = await getSharedDb();
    
    // Check if module already exists in registry
    const existingModule = await sharedDb
      .select()
      .from(moduleRegistry)
      .where(eq(moduleRegistry.moduleId, moduleData.moduleId))
      .limit(1);
    
    if (existingModule.length > 0) {
      logger.info({ moduleId }, 'Module already registered in database');
      return false;
    }

    // Insert module into registry
    await sharedDb
      .insert(moduleRegistry)
      .values(moduleData)
      .returning();

    logger.info({ moduleId }, 'Module registered in database');
    return true;

  } catch (error) {
    logger.error({ moduleId, err: error }, 'Failed to register module');
    return false;
  }
}

/**
 * Get all registered modules from the database
 */
export async function getRegisteredModules() {
  try {
    const sharedDb = await getSharedDb();
    
    const modules = await sharedDb
      .select()
      .from(moduleRegistry)
      .orderBy(moduleRegistry.createdAt);
    
    return modules;
  } catch (error) {
    logger.error({ err: error }, 'Failed to get registered modules');
    return [];
  }
}