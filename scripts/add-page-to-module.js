#!/usr/bin/env node

/**
 * React Admin Module Page Generator
 * 
 * This script adds a new page/entity to an existing module with all the necessary files:
 * - Frontend page components
 * - React routes
 * - Sidebar menu
 * - Server API routes
 * - Database schema
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

// Utility function to convert string to different cases
function toCamelCase(str) {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

function toPascalCase(str) {
  return str.replace(/(^|-)([a-z])/g, (g) => g.slice(-1).toUpperCase());
}

function toKebabCase(str) {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
}

function toSnakeCase(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

async function main() {
  console.log('\n📄 React Admin Module Page Generator');
  console.log('=====================================\n');

  try {
    // List available modules
    const projectRoot = path.dirname(__dirname);
    const modulesDir = path.join(projectRoot, 'src', 'modules');
    const modules = fs.readdirSync(modulesDir).filter(item => 
      fs.statSync(path.join(modulesDir, item)).isDirectory()
    );

    console.log('Available modules:');
    modules.forEach((module, index) => {
      console.log(`${index + 1}. ${module}`);
    });

    // Get module selection
    const moduleIndex = parseInt(await askQuestion('\nSelect module number: ')) - 1;
    if (moduleIndex < 0 || moduleIndex >= modules.length) {
      console.error('❌ Invalid module selection!');
      process.exit(1);
    }

    const selectedModule = modules[moduleIndex];
    console.log(`\n📦 Selected module: ${selectedModule}`);

    // Get page information from user
    const pageId = (await askQuestion('Page ID (kebab-case, e.g., user-profile): ')).trim();
    const pageName = (await askQuestion('Page Name (e.g., User Profile): ')).trim();
    const description = (await askQuestion('Page Description: ')).trim();

    // Validate inputs
    if (!pageId || !pageName || !description) {
      console.error('❌ Page ID, Name, and Description are required!');
      process.exit(1);
    }

    // Ensure kebab-case for page ID
    const pageIdKebab = toKebabCase(pageId);
    const pageIdCamel = toCamelCase(pageIdKebab);
    const pageIdPascal = toPascalCase(pageIdKebab);
    const pageIdSnake = toSnakeCase(pageIdKebab);

    console.log(`\n📋 Generating page "${pageName}" (${pageIdKebab}) for module "${selectedModule}"...`);

    // Create page components and routes
    await addPageToModule(selectedModule, {
      pageId: pageIdKebab,
      pageIdKebab,
      pageIdCamel,
      pageIdPascal,
      pageIdSnake,
      pageName,
      description,
      moduleId: selectedModule,
      moduleIdCamel: toCamelCase(selectedModule),
      moduleIdPascal: toPascalCase(selectedModule)
    });

    console.log('\n✅ Page added successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Update the module routes to include the new page');
    console.log('2. Update the sidebar menu to include the new page');
    console.log('3. Run database migration to create the new table');
    console.log('4. Test the new functionality');
    console.log(`\nPage location: src/modules/${selectedModule}/client/pages/${pageIdPascal}*`);

  } catch (error) {
    console.error('❌ Error adding page:', error.message);
    rl.close();
    process.exit(1);
  } finally {
    rl.close();
    process.exit(0);
  }
}

// Main function to add page to module
async function addPageToModule(moduleId, config) {
  const projectRoot = path.dirname(__dirname);
  const moduleDir = path.join(projectRoot, 'src', 'modules', moduleId);

  // Generate and write files
  await writePageComponents(moduleDir, config);
  await writeServerRoutes(moduleDir, config);
  await writeDbSchema(moduleDir, config);
  await updateModuleRoutes(moduleDir, config);
  await updateSidebarMenu(moduleDir, config);

  console.log(`✅ Added page ${config.pageName} to module ${moduleId}`);
}

// Function to generate page components
async function writePageComponents(moduleDir, config) {
  // Create List page template
  const listPageTemplate = `import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Button } from '@client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@client/components/ui/card';
import { Plus, Search, MoreHorizontal } from 'lucide-react';
import { Input } from '@client/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@client/components/ui/dropdown-menu';
import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import axios from 'axios';

const ${config.pageIdPascal}List: React.FC = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get('/api/modules/${config.moduleId}/${config.pageIdKebab}');
      setData(response.data.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">${config.pageName}</h1>
          <p className="text-muted-foreground">
            Manage your ${config.pageName.toLowerCase()} records
          </p>
        </div>
        <Button asChild>
          <Link to="add">
            <Plus className="mr-2 h-4 w-4" />
            Add ${config.pageName}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ${config.pageName.toLowerCase()}..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8">
                    No ${config.pageName.toLowerCase()} found. 
                    <Link to="add" className="text-primary hover:underline ml-1">
                      Create your first one
                    </Link>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{new Date(item.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={\`\${item.id}\`}>View</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={\`\${item.id}/edit\`}>Edit</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default withModuleAuthorization(${config.pageIdPascal}List, {
  moduleId: '${config.moduleId}',
  moduleName: '${config.pageName}'
});
`;

  // Create Add page template
  const addPageTemplate = `import React from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@client/components/ui/card';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Textarea } from '@client/components/ui/textarea';
import { ArrowLeft, Save } from 'lucide-react';
import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import axios from 'axios';

const ${config.pageIdCamel}Schema = z.object({
  name: z.string().min(1, 'Name is required'),
});

type ${config.pageIdPascal}FormData = z.infer<typeof ${config.pageIdCamel}Schema>;

const ${config.pageIdPascal}Add: React.FC = () => {
  const navigate = useNavigate();
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<${config.pageIdPascal}FormData>({
    resolver: zodResolver(${config.pageIdCamel}Schema),
  });

  const onSubmit = async (data: ${config.pageIdPascal}FormData) => {
    try {
      await axios.post('/api/modules/${config.moduleId}/${config.pageIdKebab}', data);
      navigate('..');
    } catch (error) {
      console.error('Error creating ${config.pageName.toLowerCase()}:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('..')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Add ${config.pageName}</h1>
          <p className="text-muted-foreground">
            Create a new ${config.pageName.toLowerCase()} record
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Enter name"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={isSubmitting}>
                <Save className="mr-2 h-4 w-4" />
                {isSubmitting ? 'Creating...' : 'Create'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate('..')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default withModuleAuthorization(${config.pageIdPascal}Add, {
  moduleId: '${config.moduleId}',
  moduleName: '${config.pageName}'
});
`;

  // Write page files
  const clientDir = path.join(moduleDir, 'client', 'pages');
  
  fs.writeFileSync(
    path.join(clientDir, `${config.pageIdPascal}List.tsx`),
    listPageTemplate
  );
  
  fs.writeFileSync(
    path.join(clientDir, `${config.pageIdPascal}Add.tsx`),
    addPageTemplate
  );

  console.log(`✅ Created page components`);
}

// Function to generate server routes
async function writeServerRoutes(moduleDir, config) {
  const serverRoutesDir = path.join(moduleDir, 'server', 'routes');
  
  // Check for existing route files in the module
  const existingRouteFiles = fs.readdirSync(serverRoutesDir).filter(file => file.endsWith('.ts'));
  
  // Check for existing schema file to determine import path
  const schemaDir = path.join(moduleDir, 'server', 'lib', 'db', 'schemas');
  const existingSchemaFiles = fs.readdirSync(schemaDir).filter(file => file.endsWith('.ts'));
  const schemaImportPath = existingSchemaFiles.length > 0 
    ? `../lib/db/schemas/${existingSchemaFiles[0].replace('.ts', '')}`
    : `../lib/db/schemas/${config.pageIdCamel}`;

  const newRouteContent = `
/**
 * @swagger
 * components:
 *   schemas:
 *     ${config.pageIdPascal}:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         tenantId:
 *           type: string
 *           format: uuid
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/modules/${config.moduleId}/${config.pageIdKebab}:
 *   get:
 *     summary: Get all ${config.pageName} records
 *     tags: [${config.pageName}]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of ${config.pageName} records
 *       401:
 *         description: Unauthorized
 */
router.get('/${config.pageIdKebab}', authorized('ADMIN','${config.moduleId}.${config.pageIdKebab}.view'), async (req, res) => {
  try {
    const tenantId = req.user!.activeTenantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;

    // Build where conditions
    const whereConditions = [eq(${config.pageIdCamel}.tenantId, tenantId)];
    
    if (search) {
      whereConditions.push(ilike(${config.pageIdCamel}.name, \`%\${search}%\`));
    }

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(${config.pageIdCamel})
      .where(and(...whereConditions));

    // Get paginated data
    const data = await db
      .select()
      .from(${config.pageIdCamel})
      .where(and(...whereConditions))
      .orderBy(desc(${config.pageIdCamel}.createdAt))
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(totalResult.count / limit);

    res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: totalResult.count,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching ${config.pageName.toLowerCase()}:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * @swagger
 * /api/modules/${config.moduleId}/${config.pageIdKebab}:
 *   post:
 *     summary: Create a new ${config.pageName}
 *     tags: [${config.pageName}]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: ${config.pageName} created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post('/${config.pageIdKebab}', authorized('ADMIN','${config.moduleId}.${config.pageIdKebab}.create'), async (req, res) => {
  try {
    const tenantId = req.user!.activeTenantId;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required',
      });
    }

    const [newRecord] = await db
      .insert(${config.pageIdCamel})
      .values({
        tenantId,
        name,
      })
      .returning();

    res.status(201).json({
      success: true,
      data: newRecord,
      message: '${config.pageName} created successfully',
    });
  } catch (error) {
    console.error('Error creating ${config.pageName.toLowerCase()}:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});
`;

  if (existingRouteFiles.length > 0) {
    // Use the first existing route file
    const existingRouteFile = path.join(serverRoutesDir, existingRouteFiles[0]);
    let existingContent = fs.readFileSync(existingRouteFile, 'utf8');
    
    // Check if the routes already exist
    if (existingContent.includes(`router.get('/${config.pageIdKebab}'`)) {
      console.log(`⚠️  Routes for ${config.pageIdKebab} already exist in ${existingRouteFiles[0]}`);
      return;
    }
    
    // Add schema import if not exists
    if (!existingContent.includes(`import { ${config.pageIdCamel} }`)) {
      const importLine = `import { ${config.pageIdCamel} } from '${schemaImportPath}';`;
      existingContent = existingContent.replace(
        /(import.*from.*schema.*';)/,
        `$1\n${importLine}`
      );
    }
    
    // Update drizzle-orm imports to include count and ilike if not present
    if (!existingContent.includes('count') || !existingContent.includes('ilike')) {
      existingContent = existingContent.replace(
        /import { ([^}]*) } from 'drizzle-orm';/,
        (match, imports) => {
          const importList = imports.split(',').map(imp => imp.trim());
          if (!importList.includes('count')) importList.push('count');
          if (!importList.includes('ilike')) importList.push('ilike');
          return `import { ${importList.join(', ')} } from 'drizzle-orm';`;
        }
      );
    }
    
    // Insert the new routes before the export statement
    existingContent = existingContent.replace(
      /export default router;$/,
      `${newRouteContent}\nexport default router;`
    );
    
    fs.writeFileSync(existingRouteFile, existingContent);
    console.log(`✅ Added routes to existing file: ${existingRouteFiles[0]}`);
  } else {
    // Create a new route file if none exists
    const routesTemplate = `import express from 'express';
import { db } from '@server/lib/db';
import { ${config.pageIdCamel} } from '${schemaImportPath}';
import { authenticated, authorized } from '@server/middleware/authMiddleware';
import { eq, and, desc, count, ilike } from 'drizzle-orm';
import { checkModuleAuthorization } from '@server/middleware/moduleAuthMiddleware';

const router = express.Router();
router.use(authenticated());
router.use(checkModuleAuthorization('${config.moduleId}'));
${newRouteContent}
export default router;
`;
    
    fs.writeFileSync(
      path.join(serverRoutesDir, `${config.pageIdCamel}Routes.ts`),
      routesTemplate
    );
    
    console.log(`✅ Created new server route file: ${config.pageIdCamel}Routes.ts`);
  }
}

// Function to generate database schema
async function writeDbSchema(moduleDir, config) {
  const schemaDir = path.join(moduleDir, 'server', 'lib', 'db', 'schemas');
  
  // Check if there's an existing schema file in the module
  const existingSchemaFiles = fs.readdirSync(schemaDir).filter(file => file.endsWith('.ts'));
  
  const newSchemaContent = `
export const ${config.pageIdCamel} = pgTable('${config.pageIdSnake}', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

// Relations
export const ${config.pageIdCamel}Relations = relations(${config.pageIdCamel}, ({ one }) => ({
  tenant: one(tenant, {
    fields: [${config.pageIdCamel}.tenantId],
    references: [tenant.id],
  }),
}));

// Types
export type ${config.pageIdPascal} = typeof ${config.pageIdCamel}.$inferSelect;
export type New${config.pageIdPascal} = typeof ${config.pageIdCamel}.$inferInsert;
`;

  if (existingSchemaFiles.length > 0) {
    // Use the first existing schema file
    const existingSchemaFile = path.join(schemaDir, existingSchemaFiles[0]);
    let existingContent = fs.readFileSync(existingSchemaFile, 'utf8');
    
    // Check if the schema already exists
    if (existingContent.includes(`export const ${config.pageIdCamel}`)) {
      console.log(`⚠️  Schema for ${config.pageIdCamel} already exists in ${existingSchemaFiles[0]}`);
      return;
    }
    
    // Append the new schema to the existing file
    existingContent += newSchemaContent;
    fs.writeFileSync(existingSchemaFile, existingContent);
    
    console.log(`✅ Added schema to existing file: ${existingSchemaFiles[0]}`);
  } else {
    // Create a new schema file if none exists
    const schemaTemplate = `import { relations } from 'drizzle-orm';
import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { tenant } from '@server/lib/db/schema/system';
${newSchemaContent}`;
    
    fs.writeFileSync(
      path.join(schemaDir, `${config.pageIdCamel}.ts`),
      schemaTemplate
    );
    
    console.log(`✅ Created new database schema file: ${config.pageIdCamel}.ts`);
  }
}

// Function to update module routes
async function updateModuleRoutes(moduleDir, config) {
  const routesFile = path.join(moduleDir, 'client', 'routes', `${config.moduleIdCamel}ReactRoutes.ts`);
  
  if (fs.existsSync(routesFile)) {
    let content = fs.readFileSync(routesFile, 'utf8');
    
    // Check if routes already exist
    if (content.includes(`'${config.pageIdKebab}'`)) {
      console.log(`⚠️  Routes for ${config.pageIdKebab} already exist in React routes`);
      return;
    }
    
    // Add imports at the top, after existing imports
    const importLines = `import ${config.pageIdPascal}List from '../pages/${config.pageIdPascal}List';
import ${config.pageIdPascal}Add from '../pages/${config.pageIdPascal}Add';`;
    
    if (!content.includes(`${config.pageIdPascal}List`)) {
      // Find the last import line and add after it
      const importPattern = /(import.*from.*';)(?=\n\nexport)/;
      if (importPattern.test(content)) {
        content = content.replace(importPattern, `$1\n${importLines}`);
      } else {
        // Fallback: add after the first import block
        content = content.replace(
          /(import.*';)(\n)/,
          `$1\n${importLines}$2`
        );
      }
    }
    
    // Add routes in the children array
    const routeEntries = `    { path: '${config.pageIdKebab}', Component: ${config.pageIdPascal}List },
    { path: '${config.pageIdKebab}/add', Component: ${config.pageIdPascal}Add },`;
    
    // Find the children array and add routes before the closing bracket
    // Look for the pattern: ] followed by } and potentially );
    content = content.replace(
      /(\s+)(]\s*}\s*\);?)$/m,
      `$1  ${routeEntries}\n$1$2`
    );
    
    fs.writeFileSync(routesFile, content);
    console.log(`✅ Updated module React routes`);
  } else {
    console.log(`⚠️  Module routes file not found: ${routesFile}`);
  }
}

// Function to update sidebar menu
async function updateSidebarMenu(moduleDir, config) {
  const menuFile = path.join(moduleDir, 'client', 'menus', 'sideBarMenus.ts');
  
  if (fs.existsSync(menuFile)) {
    let content = fs.readFileSync(menuFile, 'utf8');
    
    // Add new menu item
    const menuItem = `      {
        id: "${config.moduleId}-${config.pageIdKebab}",
        title: "${config.pageName}",
        url: "/console/modules/${config.moduleId}/${config.pageIdKebab}",
        roles: "ADMIN",
        permissions: "${config.moduleId}.${config.pageIdKebab}.view",
      },`;
    
    if (!content.includes(`"${config.moduleId}-${config.pageIdKebab}"`)) {
      content = content.replace(
        /(\s+)(],\s*};)$/,
        `$1  ${menuItem}\n$1$2`
      );
    }
    
    fs.writeFileSync(menuFile, content);
    console.log(`✅ Updated sidebar menu`);
  } else {
    console.log(`⚠️  Sidebar menu file not found: ${menuFile}`);
  }
}

// Check if this script is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { addPageToModule };