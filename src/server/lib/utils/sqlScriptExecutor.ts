import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../logger';

/**
 * Utility for executing SQL scripts in tenant context
 */

/**
 * Execute SQL scripts for a module in tenant context
 */
export async function executeModuleScripts(
  tenantDb: any,
  moduleId: string,
  scripts: ('create_tables.sql' | 'seed_data.sql' | 'drop_tables.sql')[]
): Promise<void> {
  // Navigate from src/server/lib/utils/ to project root
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../');
  const scriptsDir = path.join(projectRoot, 'modules', moduleId, 'scripts');

  // Check if scripts directory exists
  if (!fs.existsSync(scriptsDir)) {
    throw new Error(`Scripts directory not found for module: ${moduleId}`);
  }

  for (const scriptName of scripts) {
    const scriptPath = path.join(scriptsDir, scriptName);
    
    // Check if script file exists
    if (!fs.existsSync(scriptPath)) {
      logger.warn({ scriptPath }, 'Script file not found');
      continue;
    }

    try {
      // Read the SQL script content
      const sqlContent = fs.readFileSync(scriptPath, 'utf8');
      
      // Skip if the file is empty or only contains comments
      const sqlStatements = parseSqlStatements(sqlContent);
      if (sqlStatements.length === 0) {
        logger.debug({ scriptName, moduleId }, 'No executable statements found in script');
        continue;
      }

      // Execute each SQL statement
      for (const statement of sqlStatements) {
        if (statement.trim()) {
          await tenantDb.execute(statement);
        }
      }

      logger.info({ scriptName, moduleId }, 'SQL script executed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ scriptName, moduleId, err: errorMessage }, 'Error executing SQL script');
      throw new Error(`Failed to execute ${scriptName}: ${errorMessage}`);
    }
  }
}

/**
 * Parse SQL content into individual statements
 * Handles comments and multi-line statements
 */
function parseSqlStatements(sqlContent: string): string[] {
  // Remove single line comments (lines starting with --)
  let cleanContent = sqlContent
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');

  // Remove multi-line comments (/* ... */)
  cleanContent = cleanContent.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Split by semicolon and clean up
  const statements = cleanContent
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt && stmt.length > 0)
    .filter(stmt => !stmt.match(/^\s*$/))
    .filter(stmt => !stmt.match(/^\*\/\s*$/)); // Remove trailing comment markers

  return statements;
}

/**
 * Execute SQL scripts when enabling a module
 */
export async function executeModuleEnableScripts(
  tenantDb: any,
  moduleId: string
): Promise<void> {
  logger.info({ moduleId }, 'Enabling module, executing SQL scripts');

  try {
    await executeModuleScripts(tenantDb, moduleId, ['create_tables.sql', 'seed_data.sql']);
    logger.info({ moduleId }, 'Module enabled successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ moduleId, err: errorMessage }, 'Failed to enable module');
    throw error;
  }
}

/**
 * Execute SQL scripts when disabling a module
 */
export async function executeModuleDisableScripts(
  tenantDb: any,
  moduleId: string
): Promise<void> {
  logger.info({ moduleId }, 'Disabling module, executing SQL scripts');

  try {
    await executeModuleScripts(tenantDb, moduleId, ['drop_tables.sql']);
    logger.info({ moduleId }, 'Module disabled successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ moduleId, err: errorMessage }, 'Failed to disable module');
    throw error;
  }
}