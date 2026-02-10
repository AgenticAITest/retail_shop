#!/usr/bin/env node

/**
 * React Admin Module Registration Script
 * 
 * This script automatically registers an existing module by following the 4-step manual process:
 * 1. Register Client Routes (src/client/route.ts)
 * 2. Register Server Routes (src/server/main.ts) 
 * 3. Register Sidebar Menu (app-sidebar.tsx)
 * 4. Update Drizzle Schema Exports (if central schema exists)
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Utility function to ask questions
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Utility functions for string conversion
function toCamelCase(str) {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

function toPascalCase(str) {
  return str.replace(/(^|-)([a-z])/g, (g) => g.slice(-1).toUpperCase());
}

async function main() {
  console.log('\n🔧 React Admin Module Registration Script');
  console.log('==========================================\n');

  try {
    // List available modules
    const projectRoot = path.dirname(__dirname);
    const modulesDir = path.join(projectRoot, 'src', 'modules');
    const modules = fs.readdirSync(modulesDir).filter(item => 
      fs.statSync(path.join(modulesDir, item)).isDirectory() &&
      !['README.md', 'moduleHelpers.ts', 'moduleMetadata.ts'].includes(item)
    );

    if (modules.length === 0) {
      console.log('❌ No modules found to register!');
      process.exit(1);
    }

    console.log('Available modules:');
    modules.forEach((module, index) => {
      console.log(`${index + 1}. ${module}`);
    });

    // Get module selection
    const moduleIndex = parseInt(await askQuestion('\nSelect module number to register: ')) - 1;
    if (moduleIndex < 0 || moduleIndex >= modules.length) {
      console.error('❌ Invalid module selection!');
      process.exit(1);
    }

    const selectedModule = modules[moduleIndex];
    const moduleIdCamel = toCamelCase(selectedModule);
    const moduleIdPascal = toPascalCase(selectedModule);

    console.log(`\n📦 Registering module: ${selectedModule}`);
    console.log(`   Camel case: ${moduleIdCamel}`);
    console.log(`   Pascal case: ${moduleIdPascal}`);

    // Perform registration steps
    await registerModule(projectRoot, {
      moduleId: selectedModule,
      moduleIdCamel,
      moduleIdPascal
    });

    console.log('\n✅ Module registration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Start the development server: npm run dev');
    console.log('   - The module will be automatically registered in the database on startup');
    console.log('2. Or manually register in database: npm run db:register-module ' + selectedModule);
    console.log('3. Run SQL scripts to create module tables:');
    console.log(`   - Check modules/${selectedModule}/scripts/ for generated SQL files`);
    console.log('   - Run install.sql in your tenant schema');
    console.log('4. Check that routes are accessible');
    console.log('5. Verify API endpoints work');
    console.log('6. Test the UI navigation');

  } catch (error) {
    console.error('❌ Error registering module:', error.message);
    rl.close();
    process.exit(1);
  } finally {
    rl.close();
    process.exit(0);
  }
}

// Main registration function
async function registerModule(projectRoot, config) {
  console.log('\n🔄 Starting registration process...');
  
  // Step 1: Register Client Routes
  await registerClientRoutes(projectRoot, config);
  
  // Step 2: Register Server Routes
  await registerServerRoutes(projectRoot, config);
  
  // Step 3: Register Sidebar Menu
  await registerSidebarMenu(projectRoot, config);
  
  // Step 4: Update Drizzle Schema Exports
  await updateSchemaExports(projectRoot, config);
  
  // Step 5: Register Module in Database
  await registerModuleInDatabase(projectRoot, config);
  
  // Step 6: Generate SQL Scripts
  await generateModuleSQLScripts(projectRoot, config);
  
  console.log('✅ All registration steps completed');
}

// Step 1: Register Client Routes in src/client/route.ts
async function registerClientRoutes(projectRoot, config) {
  const routeFile = path.join(projectRoot, 'src', 'client', 'route.ts');
  
  if (!fs.existsSync(routeFile)) {
    console.log('⚠️  Client route file not found: src/client/route.ts');
    return;
  }

  let content = fs.readFileSync(routeFile, 'utf8');
  
  // Check if already registered
  if (content.includes(`${config.moduleIdCamel}ReactRoutes`)) {
    console.log('⚠️  Client routes already registered');
    return;
  }

  // Add import at the top
  const importLine = `import { ${config.moduleIdCamel}ReactRoutes } from '../modules/${config.moduleId}/client/routes/${config.moduleIdCamel}ReactRoutes';`;
  
  // Find last import and add after it
  const lastImportPattern = /(import.*from.*';)(?=\n)/g;
  const matches = [...content.matchAll(lastImportPattern)];
  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    const insertIndex = lastMatch.index + lastMatch[0].length;
    content = content.slice(0, insertIndex) + '\n' + importLine + content.slice(insertIndex);
  }

  // Add route in console children array
  const routeCall = `      ${config.moduleIdCamel}ReactRoutes("modules/${config.moduleId}"),`;
  
  // Find console children array and add route
  content = content.replace(
    /(path: "console",[\s\S]*?children: \[[\s\S]*?)(]\s*,)/,
    `$1      ${routeCall}\n$2`
  );

  fs.writeFileSync(routeFile, content);
  console.log('✅ Step 1: Client routes registered');
}

// Step 2: Register Server Routes in src/server/main.ts
async function registerServerRoutes(projectRoot, config) {
  const mainFile = path.join(projectRoot, 'src', 'server', 'main.ts');
  
  if (!fs.existsSync(mainFile)) {
    console.log('⚠️  Server main file not found: src/server/main.ts');
    return;
  }

  let content = fs.readFileSync(mainFile, 'utf8');
  
  // Check if already registered
  if (content.includes(`/api/modules/${config.moduleId}`)) {
    console.log('⚠️  Server routes already registered');
    return;
  }

  // Discover all route files in the module's server/routes folder
  const routesDir = path.join(projectRoot, 'src', 'modules', config.moduleId, 'server', 'routes');
  
  if (!fs.existsSync(routesDir)) {
    console.log('⚠️  Module routes directory not found: src/modules/' + config.moduleId + '/server/routes');
    return;
  }

  const routeFiles = fs.readdirSync(routesDir)
    .filter(file => file.endsWith('.ts') && !file.endsWith('.d.ts'))
    .map(file => file.replace('.ts', ''));

  if (routeFiles.length === 0) {
    console.log('⚠️  No route files found in module routes directory');
    return;
  }

  console.log(`   Found ${routeFiles.length} route file(s): ${routeFiles.join(', ')}`);

  // Generate imports for all route files
  const imports = routeFiles.map(routeFile => {
    // Convert filename to import name (e.g., 'sampleModuleRoutes' -> 'sampleModuleRoutes')
    const importName = routeFile;
    return `import ${importName} from '../modules/${config.moduleId}/server/routes/${routeFile}';`;
  }).join('\n');

  // Find last import and add all route imports after it
  const lastImportPattern = /(import.*from.*';)(?=\n)/g;
  const matches = [...content.matchAll(lastImportPattern)];
  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    const insertIndex = lastMatch.index + lastMatch[0].length;
    content = content.slice(0, insertIndex) + '\n' + imports + content.slice(insertIndex);
  }

  // Generate route registrations for all route files
  const routeRegistrations = routeFiles.map(routeFile => {
    const importName = routeFile;
    // Extract route segment from filename for more semantic URLs
    let routeSegment = routeFile;
    
    // Remove module name prefix if it exists (e.g., 'sampleModuleRoutes' -> 'Routes', 'employeeRoutes' -> 'employee')
    if (routeFile.toLowerCase().startsWith(config.moduleIdCamel.toLowerCase())) {
      routeSegment = routeFile.substring(config.moduleIdCamel.length).toLowerCase();
      if (routeSegment === 'routes') {
        routeSegment = ''; // Main module routes
      }
    } else {
      // Remove 'Routes' suffix if present
      routeSegment = routeFile.replace(/Routes?$/i, '').toLowerCase();
    }
    
    const endpoint = routeSegment ? `/api/modules/${config.moduleId}/${routeSegment}` : `/api/modules/${config.moduleId}`;
    return `app.use('${endpoint}', ${importName});`;
  }).join('\n');

  // Add route registrations before ViteExpress.listen()
  const routeBlock = `// ${config.moduleId} routes\n${routeRegistrations}\n\n`;
  
  content = content.replace(
    /(ViteExpress\.listen)/,
    routeBlock + '$1'
  );

  fs.writeFileSync(mainFile, content);
  console.log('✅ Step 2: Server routes registered');
  console.log(`   Registered ${routeFiles.length} route file(s):`);
  routeFiles.forEach((routeFile, index) => {
    let routeSegment = routeFile;
    if (routeFile.toLowerCase().startsWith(config.moduleIdCamel.toLowerCase())) {
      routeSegment = routeFile.substring(config.moduleIdCamel.length).toLowerCase();
      if (routeSegment === 'routes') {
        routeSegment = ''; // Main module routes
      }
    } else {
      routeSegment = routeFile.replace(/Routes?$/i, '').toLowerCase();
    }
    const endpoint = routeSegment ? `/api/modules/${config.moduleId}/${routeSegment}` : `/api/modules/${config.moduleId}`;
    console.log(`   - ${routeFile}.ts -> ${endpoint}`);
  });
}

// Step 3: Register Sidebar Menu in components/app-sidebar.tsx
async function registerSidebarMenu(projectRoot, config) {
  const sidebarFile = path.join(projectRoot, 'src', 'client', 'components', 'app-sidebar.tsx');
  
  if (!fs.existsSync(sidebarFile)) {
    console.log('⚠️  Sidebar file not found: src/client/components/app-sidebar.tsx');
    return;
  }

  let content = fs.readFileSync(sidebarFile, 'utf8');
  
  // Check if already registered
  if (content.includes(`${config.moduleIdCamel}SidebarMenus`)) {
    console.log('⚠️  Sidebar menu already registered');
    return;
  }

  // Add import at the top
  const importLine = `import { ${config.moduleIdCamel}SidebarMenus } from "../../modules/${config.moduleId}/client/menus/sideBarMenus"`;
  
  // Find last import and add after it - handle both single and double quotes
  const lastImportPattern = /(import.*from.*["'];?)\s*$/gm;
  const matches = [...content.matchAll(lastImportPattern)];
  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    const insertIndex = lastMatch.index + lastMatch[0].length;
    content = content.slice(0, insertIndex) + '\n' + importLine + content.slice(insertIndex);
  } else {
    // Fallback: add after the last import line if pattern doesn't match
    const lines = content.split('\n');
    let lastImportIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ') && lines[i].includes('from')) {
        lastImportIndex = i;
      }
    }
    if (lastImportIndex !== -1) {
      lines.splice(lastImportIndex + 1, 0, importLine);
      content = lines.join('\n');
    }
  }

  // Add to navMain array - look for the specific pattern where demoModuleSidebarMenus is added
  const sampleMenuPattern = /demoModuleSidebarMenus,/;
  
  if (sampleMenuPattern.test(content)) {
    // Add the new menu right before demoModuleSidebarMenus
    content = content.replace(
      /(\s+)(demoModuleSidebarMenus,)/,
      `$1${config.moduleIdCamel}SidebarMenus,\n$1$2`
    );
    
    fs.writeFileSync(sidebarFile, content);
    console.log('✅ Step 3: Sidebar menu registered');
  } else {
    console.log('⚠️  Could not automatically add sidebar menu - please add manually');
    console.log(`   Import: ${importLine}`);
    console.log(`   Add to navMain array: ${config.moduleIdCamel}SidebarMenus,`);
  }
}

// Step 4: Update Drizzle Schema Exports (if central schema exists)
async function updateSchemaExports(projectRoot, config) {
  const schemaIndexFile = path.join(projectRoot, 'src', 'server', 'lib', 'db', 'schema', 'tenantSchema.ts');
  
  if (!fs.existsSync(schemaIndexFile)) {
    console.log('⚠️  Central schema index file not found - skipping schema export update');
    return;
  }

  let content = fs.readFileSync(schemaIndexFile, 'utf8');
  
  // Check if already exported
  if (content.includes(`@modules/${config.moduleId}/server/lib/db/schemas`)) {
    console.log('⚠️  Schema already exported');
    return;
  }

  // Add schema export
  const exportLine = `export * from '@modules/${config.moduleId}/server/lib/db/schemas/${config.moduleIdCamel}';`;
  content += '\n' + exportLine;

  fs.writeFileSync(schemaIndexFile, content);
  console.log('✅ Step 4: Schema exports updated');
}

// Step 5: Register Module in Database (moduleRegistry table)
async function registerModuleInDatabase(projectRoot, config) {
  try {
    // Read module.json
    const moduleJsonPath = path.join(projectRoot, 'src', 'modules', config.moduleId, 'module.json');
    
    if (!fs.existsSync(moduleJsonPath)) {
      console.log('⚠️  Module.json not found - skipping database registration');
      return;
    }

    const moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf8'));
    
    console.log('📄 Read module.json successfully');
    console.log(`   Module: ${moduleJson.name}`);
    console.log(`   Version: ${moduleJson.version}`);
    console.log(`   Category: ${moduleJson.metadata?.category}`);
    
    // For now, we'll create a separate database registration script
    // since importing TypeScript modules directly in Node.js requires compilation
    console.log('⚠️  Database registration will be handled separately');
    console.log('   Run "npm run db:register-module <module-id>" after server is set up');
    
    // Write module data to a temporary file that can be processed later
    const tempDataPath = path.join(projectRoot, 'modules', 'temp_module_registry.json');

    // create modules directory if not exists
    const modulesDir = path.join(projectRoot, 'modules');
    if (!fs.existsSync(modulesDir)) {
      fs.mkdirSync(modulesDir);
    }

    const tempData = {
      moduleId: moduleJson.id || config.moduleId,
      moduleName: moduleJson.name || config.moduleId,
      description: moduleJson.description || '',
      version: moduleJson.version || '1.0.0',
      category: moduleJson.metadata?.category || 'Other',
      isActive: true,
      repositoryUrl: moduleJson.repository?.url || null,
      documentationUrl: moduleJson.author?.url || null,
    };
    
    fs.writeFileSync(tempDataPath, JSON.stringify(tempData, null, 2));
    console.log('✅ Step 5: Module data prepared for database registration');
    console.log(`   Temp file created: ${tempDataPath}`);
    console.log('   This will be processed when the server starts');
    
  } catch (error) {
    console.log('⚠️  Failed to prepare module for database registration:', error.message);
    console.log('   You can manually register it later using the module registry API');
  }
}

// Step 6: Generate SQL Scripts for Module Tables
async function generateModuleSQLScripts(projectRoot, config) {
  try {
    console.log('📝 Generating SQL scripts...');
    
    // Read module.json for additional context
    const moduleJsonPath = path.join(projectRoot, 'src', 'modules', config.moduleId, 'module.json');
    let moduleJson = {};
    
    if (fs.existsSync(moduleJsonPath)) {
      moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf8'));
    }
    
    // Read the schema file to analyze table structure
    const schemaPath = path.join(projectRoot, 'src', 'modules', config.moduleId, 'server', 'lib', 'db', 'schemas', `${config.moduleIdCamel}.ts`);
    
    if (!fs.existsSync(schemaPath)) {
      console.log('⚠️  Schema file not found - skipping SQL script generation');
      return;
    }
    
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    
    // Create output directory
    const sqlScriptDir = path.join(projectRoot, 'modules', config.moduleId, 'scripts');
    if (!fs.existsSync(sqlScriptDir)) {
      fs.mkdirSync(sqlScriptDir, { recursive: true });
    }
    
  // Generate SQL scripts
  const createTableSQL = await generateCreateTableSQL(config, schemaContent, moduleJson);
  const dropTableSQL = generateDropTableSQL(config, schemaContent);
  const seedDataSQL = generateSeedDataSQL(config, moduleJson);    // Write SQL files
    fs.writeFileSync(
      path.join(sqlScriptDir, 'create_tables.sql'),
      createTableSQL
    );
    
    fs.writeFileSync(
      path.join(sqlScriptDir, 'drop_tables.sql'),
      dropTableSQL
    );
    
    fs.writeFileSync(
      path.join(sqlScriptDir, 'seed_data.sql'),
      seedDataSQL
    );
    
    // Create a combined installation script
    const installScript = generateInstallScript(config, moduleJson);
    fs.writeFileSync(
      path.join(sqlScriptDir, 'install.sql'),
      installScript
    );
    
    // Create README for the scripts
    const scriptsReadme = generateScriptsReadme(config, moduleJson);
    fs.writeFileSync(
      path.join(sqlScriptDir, 'README.md'),
      scriptsReadme
    );
    
    console.log('✅ Step 6: SQL scripts generated');
    console.log(`   Location: modules/${config.moduleId}/scripts/`);
    console.log('   Files: create_tables.sql, drop_tables.sql, seed_data.sql, install.sql');
    
  } catch (error) {
    console.log('⚠️  Failed to generate SQL scripts:', error.message);
    console.log('   Scripts can be generated manually later if needed');
  }
}

// Helper function to generate CREATE TABLE SQL using Drizzle
async function generateCreateTableSQL(config, schemaContent, moduleJson) {
  const timestamp = new Date().toISOString();
  
  let sql = `-- Create tables for ${config.moduleId} module
-- Generated on: ${timestamp}
-- Module: ${moduleJson.name || config.moduleId}
-- Version: ${moduleJson.version || '1.0.0'}

-- Set schema search path (this will be dynamically set per tenant)
-- SET search_path TO tenant_[tenant_code], public;

`;

  try {
    // Use Drizzle to generate SQL from schema
    const drizzleSQL = await generateDrizzleSQL(config);
    
    if (drizzleSQL) {
      // Clean up schema references from Drizzle output for multi-tenant compatibility
      const cleanedSQL = cleanDrizzleSQL(drizzleSQL);
      
      sql += `-- Tables generated by Drizzle ORM
${cleanedSQL}

-- Add performance indexes
${generateIndexSQL(config, schemaContent)}

`;
    } else {
      // Fallback to basic table creation
      sql += generateFallbackSQL(config, schemaContent);
    }
    
    // Add tenant relationship if this is a tenant-scoped module
    if (moduleJson.metadata && moduleJson.metadata.relations && moduleJson.metadata.relations.includes('tenant')) {
      sql += `-- Add tenant relationship (for multi-tenant support)
-- Note: This should be added to the tenant-specific schema
-- ALTER TABLE "${config.moduleId}" ADD COLUMN IF NOT EXISTS "tenant_id" UUID REFERENCES public.sys_tenant(id);
-- CREATE INDEX IF NOT EXISTS "idx_${config.moduleId.replace(/-/g, '_')}_tenant_id" ON "${config.moduleId}" ("tenant_id");

`;
    }
    
    sql += `-- Grant necessary permissions
-- GRANT SELECT, INSERT, UPDATE, DELETE ON "${config.moduleId}" TO tenant_user;

-- End of ${config.moduleId} table creation script
`;

  } catch (error) {
    console.log(`⚠️  Could not use Drizzle generation: ${error.message}`);
    sql += generateFallbackSQL(config, schemaContent);
  }

  return sql;
}

// Helper function to generate SQL using Drizzle Kit
async function generateDrizzleSQL(config) {
  try {
    const { execSync } = await import('child_process');
    const projectRoot = path.dirname(__dirname);
    
    console.log(`   Attempting Drizzle generation for ${config.moduleId}...`);
    
    // Create a temporary drizzle config for this specific module
    const tempConfigFileName = `drizzle.config.temp.${config.moduleId}.ts`;
    const tempConfigPath = path.join(projectRoot, tempConfigFileName);
    const outputDirName = `temp_drizzle_${config.moduleId}`;
    const outputDir = path.join(projectRoot, outputDirName);
    
    const configContent = `import type { Config } from 'drizzle-kit';

export default {
  schema: "./src/modules/${config.moduleId}/server/lib/db/schemas/${config.moduleIdCamel}.ts",
  out: "./${outputDirName}",
  dialect: "postgresql"
} satisfies Config;
`;
    
    // Write temporary config
    fs.writeFileSync(tempConfigPath, configContent);
    
    try {
      // Generate SQL using drizzle-kit
      console.log(`   Running: npx drizzle-kit generate --config=${tempConfigFileName}`);
      const result = execSync(
        `npx drizzle-kit generate --config=${tempConfigFileName}`, 
        { 
          cwd: projectRoot,
          encoding: 'utf8',
          timeout: 30000,
          stdio: ['pipe', 'pipe', 'pipe'] // Capture output
        }
      );
      
      console.log(`   Drizzle generation output: ${result}`);
      
      // Read the generated SQL
      if (fs.existsSync(outputDir)) {
        const files = fs.readdirSync(outputDir);
        const sqlFile = files.find(f => f.endsWith('.sql'));
        
        if (sqlFile) {
          console.log(`   Found generated SQL file: ${sqlFile}`);
          const sqlContent = fs.readFileSync(path.join(outputDir, sqlFile), 'utf8');
          
          // Clean up
          fs.rmSync(outputDir, { recursive: true, force: true });
          fs.unlinkSync(tempConfigPath);
          
          console.log(`   ✅ Drizzle SQL generation successful`);
          return sqlContent;
        } else {
          console.log(`   ⚠️  No SQL file found in output directory`);
        }
      } else {
        console.log(`   ⚠️  Output directory not found: ${outputDir}`);
      }
      
    } catch (execError) {
      console.log(`   ⚠️  Drizzle execution error: ${execError.message}`);
      return null;
    } finally {
      // Cleanup
      try {
        if (fs.existsSync(tempConfigPath)) {
          fs.unlinkSync(tempConfigPath);
        }
        if (fs.existsSync(outputDir)) {
          fs.rmSync(outputDir, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
    
  } catch (error) {
    console.log(`   ⚠️  Drizzle generation failed: ${error.message}`);
    return null;
  }
  
  return null;
}

// Helper function to clean Drizzle-generated SQL for multi-tenant compatibility
function cleanDrizzleSQL(drizzleSQL) {
  if (!drizzleSQL) return '';
  
  console.log('   Cleaning Drizzle SQL for multi-tenant compatibility...');
  
  // Remove "public"."table_name" references in foreign key constraints
  // Replace: REFERENCES "public"."table_name" with REFERENCES "table_name"
  let cleanedSQL = drizzleSQL.replace(
    /REFERENCES\s+"public"\."([^"]+)"/g,
    'REFERENCES "$1"'
  );
  
  // Also handle cases with single quotes (though less common in Drizzle output)
  cleanedSQL = cleanedSQL.replace(
    /REFERENCES\s+'public'\.('[^']+')/g,
    'REFERENCES $1'
  );
  
  // Remove explicit schema specifications in CREATE TABLE statements if they exist
  cleanedSQL = cleanedSQL.replace(
    /CREATE\s+TABLE\s+"public"\."([^"]+)"/g,
    'CREATE TABLE "$1"'
  );
  
  // Log the changes made
  const originalReferences = (drizzleSQL.match(/REFERENCES\s+"public"\."[^"]+"/g) || []).length;
  if (originalReferences > 0) {
    console.log(`   ✓ Cleaned ${originalReferences} public schema reference(s)`);
  }
  
  return cleanedSQL;
}

// Helper function to generate index SQL
function generateIndexSQL(config, schemaContent) {
  let indexSQL = '';
  
  // try {
  //   // Parse all tables from the schema
  //   const tables = parseTablesFromSchema(schemaContent);
    
  //   if (tables.length === 0) {
  //     // Fallback to module ID as table name
  //     tables.push(config.moduleId);
  //   }
    
  //   // Generate indexes for each table
  //   tables.forEach(tableName => {
  //     const tableNameSafe = tableName.replace(/-/g, '_');
      
  //     // Standard indexes for common fields
  //     if (schemaContent.includes('created_at') || schemaContent.includes('createdAt')) {
  //       indexSQL += `CREATE INDEX IF NOT EXISTS "idx_${tableNameSafe}_created_at" ON "${tableName}" ("created_at");\n`;
  //     }
      
  //     if (schemaContent.includes('updated_at') || schemaContent.includes('updatedAt')) {
  //       indexSQL += `CREATE INDEX IF NOT EXISTS "idx_${tableNameSafe}_updated_at" ON "${tableName}" ("updated_at");\n`;
  //     }
      
  //     // Optional indexes for common query patterns
  //     if (schemaContent.includes('name')) {
  //       indexSQL += `-- CREATE INDEX IF NOT EXISTS "idx_${tableNameSafe}_name" ON "${tableName}" ("name");\n`;
  //     }
  //   });
    
  //   if (indexSQL) {
  //     indexSQL = `-- Performance indexes for module tables\n${indexSQL}-- Optional indexes for common query patterns\n`;
  //   }
    
  // } catch (error) {
  //   console.log(`   Warning: Could not parse tables for index generation: ${error.message}`);
  //   // Fallback to original simple approach
  //   const tableName = config.moduleId;
  //   const tableNameSafe = tableName.replace(/-/g, '_');
    
  //   if (schemaContent.includes('created_at') || schemaContent.includes('createdAt')) {
  //     indexSQL += `CREATE INDEX IF NOT EXISTS "idx_${tableNameSafe}_created_at" ON "${tableName}" ("created_at");\n`;
  //   }
    
  //   if (schemaContent.includes('updated_at') || schemaContent.includes('updatedAt')) {
  //     indexSQL += `CREATE INDEX IF NOT EXISTS "idx_${tableNameSafe}_updated_at" ON "${tableName}" ("updated_at");\n`;
  //   }
    
  //   indexSQL += `-- Optional indexes for common query patterns\n`;
  //   if (schemaContent.includes('name')) {
  //     indexSQL += `-- CREATE INDEX IF NOT EXISTS "idx_${tableNameSafe}_name" ON "${tableName}" ("name");\n`;
  //   }
  // }
  
  return indexSQL;
}

// Fallback SQL generation (simplified version of the original)
function generateFallbackSQL(config, schemaContent) {
  const tableName = config.moduleId;
  
  let sql = `-- Fallback table creation (manual parsing)
CREATE TABLE IF NOT EXISTS "${tableName}" (
`;

  // Basic field parsing (simplified)
  const fields = [];
  
  if (schemaContent.includes('uuid(\'id\')')) {
    fields.push('  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid()');
  }
  
  if (schemaContent.includes('text(\'name\')')) {
    const notNull = schemaContent.includes('.notNull()') ? ' NOT NULL' : '';
    fields.push(`  "name" TEXT${notNull}`);
  }
  
  if (schemaContent.includes('text(\'description\')')) {
    fields.push('  "description" TEXT');
  }
  
  if (schemaContent.includes('timestamp(\'created_at\')')) {
    fields.push('  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP');
  }
  
  if (schemaContent.includes('timestamp(\'updated_at\')')) {
    fields.push('  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP');
  }
  
  sql += fields.join(',\n');
  sql += `
);

${generateIndexSQL(config, schemaContent)}
`;

  return sql;
}

// Helper function to parse all tables from a schema file
function parseTablesFromSchema(schemaContent) {
  const tables = [];
  
  try {
    // Match all pgTable declarations
    // Pattern: export const tableName = pgTable('actual-table-name', { ... })
    const tablePattern = /export\s+const\s+(\w+)\s*=\s*pgTable\s*\(\s*['"`]([^'"`]+)['"`]/g;
    
    let match;
    while ((match = tablePattern.exec(schemaContent)) !== null) {
      const [, exportName, tableName] = match;
      tables.push(tableName);
      console.log(`   Found table: ${exportName} -> "${tableName}"`);
    }
    
    // Also look for table references that might not follow the exact pattern
    if (tables.length === 0) {
      // Fallback: look for any pgTable calls
      const fallbackPattern = /pgTable\s*\(\s*['"`]([^'"`]+)['"`]/g;
      let fallbackMatch;
      while ((fallbackMatch = fallbackPattern.exec(schemaContent)) !== null) {
        const tableName = fallbackMatch[1];
        if (!tables.includes(tableName)) {
          tables.push(tableName);
          console.log(`   Found table (fallback): "${tableName}"`);
        }
      }
    }
    
  } catch (error) {
    console.log(`   Error parsing schema: ${error.message}`);
  }
  
  return tables;
}

// Helper function to generate DROP TABLE SQL
function generateDropTableSQL(config, schemaContent) {
  const timestamp = new Date().toISOString();
  
  let sql = `-- Drop tables for ${config.moduleId} module
-- Generated on: ${timestamp}
-- WARNING: This will permanently delete all data in these tables!

-- Set schema search path (this will be dynamically set per tenant)
-- SET search_path TO tenant_[tenant_code], public;

`;

  try {
    // Parse all tables from the schema file
    const tables = parseTablesFromSchema(schemaContent);
    
    if (tables.length === 0) {
      console.log(`   ⚠️  No tables found in schema, using fallback`);
      // Fallback to module ID as table name
      tables.push(config.moduleId);
    }
    
    console.log(`   Found ${tables.length} table(s) to drop: ${tables.join(', ')}`);
    
    // Drop indexes first for all tables
    sql += `-- Drop indexes first (if they exist)\n`;
    // tables.forEach(tableName => {
    //   const tableNameSafe = tableName.replace(/-/g, '_');
    //   sql += `DROP INDEX IF EXISTS "idx_${tableNameSafe}_created_at";\n`;
    //   sql += `DROP INDEX IF EXISTS "idx_${tableNameSafe}_updated_at";\n`;
    //   sql += `DROP INDEX IF EXISTS "idx_${tableNameSafe}_name";\n`;
    //   sql += `DROP INDEX IF EXISTS "idx_${tableNameSafe}_tenant_id";\n`;
    // });
    
    sql += `\n-- Drop tables (in reverse dependency order to handle foreign keys)\n`;
    
    // Drop tables in reverse order to handle potential foreign key dependencies
    tables.reverse().forEach(tableName => {
      sql += `DROP TABLE IF EXISTS "${tableName}" CASCADE;\n`;
    });
    
  } catch (error) {
    console.log(`   ⚠️  Error parsing schema: ${error.message}, using fallback`);
    // Fallback to simple drop
    const tableName = config.moduleId;
    const tableNameSafe = tableName.replace(/-/g, '_');
    
    sql += `-- Drop indexes first (fallback)
DROP INDEX IF EXISTS "idx_${tableNameSafe}_created_at";
DROP INDEX IF EXISTS "idx_${tableNameSafe}_updated_at";
DROP INDEX IF EXISTS "idx_${tableNameSafe}_name";
DROP INDEX IF EXISTS "idx_${tableNameSafe}_tenant_id";

-- Drop the main table (fallback)
DROP TABLE IF EXISTS "${tableName}" CASCADE;
`;
  }
  
  sql += `\n-- End of ${config.moduleId} table drop script\n`;

  return sql;
}

// Helper function to generate seed data SQL
function generateSeedDataSQL(config, moduleJson) {
  const timestamp = new Date().toISOString();
  
  let sql = `-- Seed data for ${config.moduleId} module
-- Generated on: ${timestamp}
-- Module: ${moduleJson.name || config.moduleId}

-- Set schema search path (this will be dynamically set per tenant)
-- SET search_path TO tenant_[tenant_code], public;

`;

  // Generate permission insertions if module has permissions
  if (moduleJson.metadata && moduleJson.metadata.permissions && moduleJson.metadata.permissions.length > 0) {
    sql += `-- Insert module permissions into sys_permission table
-- These permissions are required for the module to function properly

`;
    
    moduleJson.metadata.permissions.forEach((permission, index) => {
      // Generate a deterministic UUID based on permission code for consistency
      const permissionId = `gen_random_uuid()`;
      
      // Convert permission code to human-readable name
      const permissionName = permission
        .split('.')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
      
      // Generate description based on permission action
      let description = '';
      if (permission.includes('.view')) {
        description = `View ${config.moduleId} data`;
      } else if (permission.includes('.create')) {
        description = `Create new ${config.moduleId} entries`;
      } else if (permission.includes('.edit')) {
        description = `Edit existing ${config.moduleId} entries`;
      } else if (permission.includes('.delete')) {
        description = `Delete ${config.moduleId} entries`;
      } else {
        description = `Permission for ${config.moduleId} module`;
      }
      
      sql += `INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (${permissionId}, '${permission}', '${permissionName}', '${description}', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

`;
    });
  }

  sql += `-- Sample data for ${config.moduleId}
-- Uncomment and modify as needed

/*
INSERT INTO "${config.moduleId}" (name, description) VALUES 
  ('Sample Item 1', 'This is a sample item for testing'),
  ('Sample Item 2', 'Another sample item'),
  ('Sample Item 3', 'Third sample item for demonstration');
*/

-- End of ${config.moduleId} seed data script
`;

  return sql;
}

// Helper function to generate installation script
function generateInstallScript(config, moduleJson) {
  const timestamp = new Date().toISOString();
  
  // Check if module has permissions that need to be installed
  const hasPermissions = moduleJson.metadata && 
                        moduleJson.metadata.permissions && 
                        moduleJson.metadata.permissions.length > 0;
  
  const seedDataLine = hasPermissions 
    ? '\\i seed_data.sql' 
    : '-- \\i seed_data.sql';
  
  const seedDataComment = hasPermissions 
    ? '-- Insert permissions and seed data' 
    : '-- Insert seed data (optional)';
  
  return `-- Complete installation script for ${config.moduleId} module
-- Generated on: ${timestamp}
-- Module: ${moduleJson.name || config.moduleId}
-- Version: ${moduleJson.version || '1.0.0'}

-- This script should be executed in the context of a tenant schema
-- Usage: 
--   1. Connect to your database
--   2. Set search_path to the appropriate tenant schema:
--      SET search_path TO tenant_[your_tenant_code], public;
--   3. Execute this script

\\echo 'Installing ${config.moduleId} module...'

-- Create tables
\\i create_tables.sql

${seedDataComment}
${seedDataLine}

\\echo '${config.moduleId} module installation completed successfully!'

-- Verification queries
-- SELECT COUNT(*) FROM "${config.moduleId}";
-- SELECT table_name FROM information_schema.tables WHERE table_name = '${config.moduleId}';

-- End of installation script
`;
}

// Helper function to generate scripts README
function generateScriptsReadme(config, moduleJson) {
  return `# ${moduleJson.name || config.moduleId} - Database Scripts

This directory contains SQL scripts for the **${moduleJson.name || config.moduleId}** module.

## Files

### \`install.sql\`
Complete installation script that runs all necessary setup steps.

**Usage:**
\`\`\`bash
# Connect to your database and run:
psql -d your_database -f install.sql
\`\`\`

### \`create_tables.sql\`
Creates all tables, indexes, and constraints for the module.

### \`drop_tables.sql\`
⚠️ **WARNING**: Drops all tables and data for the module. Use with caution!

### \`seed_data.sql\`
Sample data for testing and development (optional).

## Multi-Tenant Usage

These scripts are designed for multi-tenant deployment. Before running any script:

\`\`\`sql
-- Set the search path to your tenant schema
SET search_path TO tenant_your_tenant_code, public;
\`\`\`

## Installation Steps

1. **Prepare the database**:
   \`\`\`sql
   -- Connect to your database
   -- Set search path for target tenant
   SET search_path TO tenant_example, public;
   \`\`\`

2. **Install the module**:
   \`\`\`bash
   psql -d your_database -f install.sql
   \`\`\`

3. **Verify installation**:
   \`\`\`sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_name = '${config.moduleId}' 
   AND table_schema = 'tenant_example';
   \`\`\`

## Module Information

- **Module ID**: ${config.moduleId}
- **Module Name**: ${moduleJson.name || config.moduleId}
- **Version**: ${moduleJson.version || '1.0.0'}
- **Category**: ${moduleJson.metadata?.category || 'Other'}
- **Generated**: ${new Date().toLocaleDateString()}

## Permissions Required

The database user needs the following permissions:
- CREATE (for tables and indexes)
- SELECT, INSERT, UPDATE, DELETE (for data operations)
- REFERENCES (for foreign keys)

## Troubleshooting

### Common Issues

1. **Permission denied**: Ensure your database user has sufficient privileges
2. **Schema not found**: Verify the tenant schema exists and search_path is correct
3. **Table already exists**: Run \`drop_tables.sql\` first if reinstalling

### Verification Queries

\`\`\`sql
-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = '${config.moduleId}'
  AND table_schema = current_schema()
);

-- Check table structure
\\d "${config.moduleId}"

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename = '${config.moduleId}';
\`\`\`

## Support

For issues or questions about this module, refer to:
- Module documentation: \`../docs/README.md\`
- Project repository: ${moduleJson.repository?.url || 'N/A'}
- Author: ${moduleJson.author?.name || 'N/A'} (${moduleJson.author?.email || 'N/A'})
`;
}

// Check if this script is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { registerModule };