#!/usr/bin/env node

/**
 * React Admin Module Generator
 * 
 * This script creates a new module with all the necessary files and structure
 * following the project's modular architecture pattern.
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

async function main() {
  console.log('\n🚀 React Admin Module Generator');
  console.log('================================\n');

  try {
    // Get module information from user
    const moduleId = (await askQuestion('Module ID (kebab-case, e.g., user-profile): ')).trim();
    const moduleName = (await askQuestion('Module Name (e.g., User Profile): ')).trim();
    const description = (await askQuestion('Module Description: ')).trim();
    const author = (await askQuestion('Author Name: ')).trim();
    const email = (await askQuestion('Author Email: ')).trim();
    const category = (await askQuestion('Category (e.g., Business, System, Demo): ')).trim();

    // Validate inputs
    if (!moduleId || !moduleName || !description) {
      console.error('❌ Module ID, Name, and Description are required!');
      process.exit(1);
    }

    // Ensure kebab-case for module ID
    const moduleIdKebab = toKebabCase(moduleId);
    const moduleIdCamel = toCamelCase(moduleIdKebab);
    const moduleIdPascal = toPascalCase(moduleIdKebab);

    console.log(`\n📋 Generating module "${moduleName}" (${moduleIdKebab})...`);

    // Create module structure
    await createModuleStructure(moduleIdKebab, {
      moduleId: moduleIdKebab,
      moduleIdCamel,
      moduleIdPascal,
      moduleName,
      description,
      author: author || 'Developer',
      email: email || 'developer@example.com',
      category: category || 'Business'
    });

    console.log('\n✅ Module created successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Register the module routes in src/client/route.ts');
    console.log('2. Register the sidebar menus in src/client/components/app-sidebar.tsx');
    console.log('3. Register the server routes in src/server/main.ts');
    console.log('4. Run database migration if needed');
    console.log('5. Update module authorization if required');
    console.log(`\nModule location: src/modules/${moduleIdKebab}`);

  } catch (error) {
    console.error('❌ Error creating module:', error.message);
    rl.close();
    process.exit(1);
  } finally {
    rl.close();
    process.exit(0);
  }
}

// Main function to create module structure
async function createModuleStructure(moduleId, config) {
  const projectRoot = path.dirname(__dirname);
  const moduleDir = path.join(projectRoot, 'src', 'modules', moduleId);

  // Create directories
  createDirectories(moduleDir);

  // Generate and write files
  await writeModuleJson(moduleDir, config);
  await writeReactFiles(moduleDir, config);
  await writeServerFiles(moduleDir, config);

  console.log(`✅ Created module structure for ${config.moduleName}`);
}

// Function to create directory structure
function createDirectories(moduleDir) {
  const dirs = [
    moduleDir,
    path.join(moduleDir, 'client', 'components'),
    path.join(moduleDir, 'client', 'pages'),
    path.join(moduleDir, 'client', 'menus'),
    path.join(moduleDir, 'client', 'routes'),
    path.join(moduleDir, 'server', 'routes'),
    path.join(moduleDir, 'server', 'lib', 'db', 'schemas'),
    path.join(moduleDir, 'docs')
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Function to generate module.json
async function writeModuleJson(moduleDir, config) {
  const moduleJson = {
    id: config.moduleId,
    name: config.moduleName,
    owner: config.author,
    description: config.description,
    version: "1.0.0",
    metadata: {
      category: config.category,
      tags: [config.moduleId, "crud", "module"],
      dependencies: {
        requires: ["authentication", "multi-tenant"],
        optional: []
      },
      permissions: [
        `${config.moduleId}.view`,
        `${config.moduleId}.create`,
        `${config.moduleId}.edit`,
        `${config.moduleId}.delete`
      ],
      routes: {
        api: `/api/modules/${config.moduleId}`,
        client: `/console/modules/${config.moduleId}`
      },
      database: {
        tables: [config.moduleIdCamel],
        relations: []
      },
      features: [
        "Create, Read, Update, Delete operations",
        "Server-side pagination",
        "Client-side search and filtering",
        "Form validation",
        "Multi-tenant support",
        "TypeScript support",
        "Modern UI with shadcn/ui components",
        "Responsive design"
      ]
    },
    author: {
      name: config.author,
      email: config.email,
      url: "https://github.com/your-org/your-module"
    },
    repository: {
      type: "git",
      url: "https://github.com/your-org/your-module.git",
      directory: `src/modules/${config.moduleId}`
    },
    license: "MIT",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const filePath = path.join(moduleDir, 'module.json');
  fs.writeFileSync(filePath, JSON.stringify(moduleJson, null, 2));
  console.log(`✅ Created module.json`);
}

// Function to generate React files
async function writeReactFiles(moduleDir, config) {
  // Create component template
  const componentTemplate = `import React from 'react';

interface ${config.moduleIdPascal}ComponentProps {
  // Add your props here
}

const ${config.moduleIdPascal}Component: React.FC<${config.moduleIdPascal}ComponentProps> = (props) => {
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold">${config.moduleName} Component</h2>
      <p className="text-muted-foreground">
        This is a reusable component for ${config.moduleName}.
      </p>
    </div>
  );
};

export default ${config.moduleIdPascal}Component;
`;

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

const ${config.moduleIdPascal}List: React.FC = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // TODO: Fetch data from API
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // TODO: Replace with actual API call
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
    <div className="space-y-6 px-2">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">${config.moduleName}</h1>
          <p className="text-muted-foreground">
            Manage your ${config.moduleName.toLowerCase()} records
          </p>
        </div>
        <Button asChild>
          <Link to="add">
            <Plus className="mr-2 h-4 w-4" />
            Add ${config.moduleName}
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
                placeholder="Search ${config.moduleName.toLowerCase()}..."
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
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    No ${config.moduleName.toLowerCase()} found. 
                    <Link to="add" className="text-primary hover:underline ml-1">
                      Create your first one
                    </Link>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.id}</TableCell>
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

export default withModuleAuthorization(${config.moduleIdPascal}List, {
  moduleId: '${config.moduleId}',
  moduleName: '${config.moduleName}'
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

const ${config.moduleIdCamel}Schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

type ${config.moduleIdPascal}FormData = z.infer<typeof ${config.moduleIdCamel}Schema>;

const ${config.moduleIdPascal}Add: React.FC = () => {
  const navigate = useNavigate();
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<${config.moduleIdPascal}FormData>({
    resolver: zodResolver(${config.moduleIdCamel}Schema),
  });

  const onSubmit = async (data: ${config.moduleIdPascal}FormData) => {
    try {
      // TODO: Replace with actual API call
      console.log('Submitting:', data);
      
      // Navigate back to list
      navigate('..');
    } catch (error) {
      console.error('Error creating ${config.moduleName.toLowerCase()}:', error);
    }
  };

  return (
    <div className="space-y-6 px-2">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('..')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add ${config.moduleName}</h1>
          <p className="text-muted-foreground">
            Create a new ${config.moduleName.toLowerCase()} record
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

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Enter description"
                rows={3}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
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

export default withModuleAuthorization(${config.moduleIdPascal}Add, {
  moduleId: '${config.moduleId}',
  moduleName: '${config.moduleName}'
});
`;

  // Create routes template
  const routesTemplate = `import { RouteObject } from 'react-router';
import ${config.moduleIdPascal}List from '../pages/${config.moduleIdPascal}List';
import ${config.moduleIdPascal}Add from '../pages/${config.moduleIdPascal}Add';
// TODO: Import other pages when created
// import ${config.moduleIdPascal}View from '../pages/${config.moduleIdPascal}View';
// import ${config.moduleIdPascal}Edit from '../pages/${config.moduleIdPascal}Edit';

export const ${config.moduleIdCamel}ReactRoutes = (basePath: string): RouteObject => {
  return {
    path: basePath,
    children: [
      { index: true, Component: ${config.moduleIdPascal}List },
      { path: 'add', Component: ${config.moduleIdPascal}Add },
      // TODO: Uncomment when pages are created
      // { path: ':id', Component: ${config.moduleIdPascal}View },
      // { path: ':id/edit', Component: ${config.moduleIdPascal}Edit },
    ]
  };
};
`;

  // Create menu template
const menuTemplate = `import { Puzzle } from 'lucide-react';

export const ${config.moduleIdCamel}SidebarMenus = {
    id: '${config.moduleId}',
    title: '${config.moduleName}',
    url: '/console/modules/${config.moduleId}',
    icon: Puzzle, // TODO: Change to appropriate icon
    roles: 'ADMIN', 
    permissions: ['${config.moduleId}.view'],
    items: [
      {
        id: "${config.moduleId}-list",
        title: "${config.moduleName} List",
        url: "/console/modules/${config.moduleId}",
        roles: "ADMIN",
        permissions: "${config.moduleId}.view",
      },
    ],
  };
`;

  // Write files
  const clientDir = path.join(moduleDir, 'client');
  
  fs.writeFileSync(
    path.join(clientDir, 'components', `${config.moduleIdPascal}Component.tsx`),
    componentTemplate
  );
  
  fs.writeFileSync(
    path.join(clientDir, 'pages', `${config.moduleIdPascal}List.tsx`),
    listPageTemplate
  );
  
  fs.writeFileSync(
    path.join(clientDir, 'pages', `${config.moduleIdPascal}Add.tsx`),
    addPageTemplate
  );
  
  fs.writeFileSync(
    path.join(clientDir, 'routes', `${config.moduleIdCamel}ReactRoutes.ts`),
    routesTemplate
  );
  
  fs.writeFileSync(
    path.join(clientDir, 'menus', 'sideBarMenus.ts'),
    menuTemplate
  );

  console.log(`✅ Created React components and pages`);
}

// Function to generate server files
async function writeServerFiles(moduleDir, config) {
  // Create database schema template
  const schemaTemplate = `import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const ${config.moduleIdCamel} = pgTable('${config.moduleId}', {
  id: uuid('id').default(sql\`gen_random_uuid()\`).primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').default(sql\`CURRENT_TIMESTAMP\`).notNull(),
  updatedAt: timestamp('updated_at').default(sql\`CURRENT_TIMESTAMP\`).notNull(),
});

export type ${config.moduleIdPascal} = typeof ${config.moduleIdCamel}.$inferSelect;
export type New${config.moduleIdPascal} = typeof ${config.moduleIdCamel}.$inferInsert;
`;

  // Create API routes template
  const routesTemplate = `import express from 'express';
import { ${config.moduleIdCamel} } from '../lib/db/schemas/${config.moduleIdCamel}';
import { authenticated, authorized, resolveTenantContext } from '@server/middleware/authMiddleware'; // Adjust import path as needed
import { eq, and, desc, count, ilike, sql } from 'drizzle-orm';
import { checkModuleAuthorization } from '@server/middleware/moduleAuthMiddleware';

const router = express.Router();
router.use(resolveTenantContext());
router.use(authenticated());
router.use(checkModuleAuthorization('${config.moduleId}'));

/**
 * @swagger
 * components:
 *   schemas:
 *     ${config.moduleIdPascal}:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/modules/${config.moduleId}/${config.moduleId}:
 *   get:
 *     summary: Get all ${config.moduleName} records
 *     tags: [${config.moduleName}]
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
 *         description: List of ${config.moduleName} records
 *       401:
 *         description: Unauthorized
 */
router.get('/${config.moduleId}', authorized('ADMIN','${config.moduleId}.view'), async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;

    // Build where conditions
    const whereConditions = [sql\`1 = 1\`]; // Dummy condition for easier appending
    
    if (search) {
      whereConditions.push(ilike(${config.moduleIdCamel}.name, \`%\$\{search\}%\`));
    }

    // Get total count
    const [totalResult] = await req.tenantDb!
      .select({ count: count() })
      .from(${config.moduleIdCamel})
      .where(and(...whereConditions));

    // Get paginated data
    const data = await req.tenantDb!
      .select()
      .from(${config.moduleIdCamel})
      .where(and(...whereConditions))
      .orderBy(desc(${config.moduleIdCamel}.createdAt))
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
    console.error('Error fetching ${config.moduleName.toLowerCase()}:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * @swagger
 * /api/modules/${config.moduleId}/${config.moduleId}:
 *   post:
 *     summary: Create a new ${config.moduleName}
 *     tags: [${config.moduleName}]
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
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: ${config.moduleName} created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post('/${config.moduleId}', authorized('ADMIN','${config.moduleId}.create'), async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required',
      });
    }

    const [newRecord] = await req.tenantDb!
      .insert(${config.moduleIdCamel})
      .values({
        name,
        description,
      })
      .returning();

    res.status(201).json({
      success: true,
      data: newRecord,
      message: '${config.moduleName} created successfully',
    });
  } catch (error) {
    console.error('Error creating ${config.moduleName.toLowerCase()}:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * @swagger
 * /api/modules/${config.moduleId}/${config.moduleId}/{id}:
 *   get:
 *     summary: Get a ${config.moduleName} by ID
 *     tags: [${config.moduleName}]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: ${config.moduleName} found
 *       404:
 *         description: ${config.moduleName} not found
 *       401:
 *         description: Unauthorized
 */
router.get('/${config.moduleId}/:id', authorized('ADMIN','${config.moduleId}.view'), async (req, res) => {
  try {
    const { id } = req.params;

    const [record] = await req.tenantDb!
      .select()
      .from(${config.moduleIdCamel})
      .where(and(
        eq(${config.moduleIdCamel}.id, id)
      ));

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '${config.moduleName} not found',
      });
    }

    res.json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error('Error fetching ${config.moduleName.toLowerCase()}:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;
`;

  // Create README template
  const readmeTemplate = `# ${config.moduleName} Module

${config.description}

## Overview

This module provides CRUD operations for ${config.moduleName} management with the following features:

- Create, Read, Update, Delete operations
- Multi-tenant support
- Server-side pagination
- Search and filtering
- Form validation
- TypeScript support
- Modern UI components

## Structure

\`\`\`
${config.moduleId}/
├── module.json                     # Module metadata
├── client/                         # React frontend
│   ├── components/                 # Reusable components
│   ├── pages/                      # Page components
│   │   ├── ${config.moduleIdPascal}List.tsx       # List view
│   │   ├── ${config.moduleIdPascal}Add.tsx        # Create form
│   │   ├── ${config.moduleIdPascal}View.tsx       # Detail view (TODO)
│   │   └── ${config.moduleIdPascal}Edit.tsx       # Edit form (TODO)
│   ├── menus/                      # Sidebar menu config
│   └── routes/                     # React routes
└── server/                         # Express backend
    ├── routes/                     # API endpoints
    └── lib/db/schemas/             # Database schema
\`\`\`

## API Endpoints

- \`GET /api/modules/${config.moduleId}/${config.moduleId}\` - List all records
- \`POST /api/modules/${config.moduleId}/${config.moduleId}\` - Create new record
- \`GET /api/modules/${config.moduleId}/${config.moduleId}/:id\` - Get record by ID
- \`PUT /api/modules/${config.moduleId}/${config.moduleId}/:id\` - Update record (TODO)
- \`DELETE /api/modules/${config.moduleId}/${config.moduleId}/:id\` - Delete record (TODO)

## Database Schema

The module uses the following database table:

\`\`\`sql
CREATE TABLE ${config.moduleIdCamel} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

## Permissions

The module defines the following permissions:

- \`${config.moduleId}.view\` - View records
- \`${config.moduleId}.create\` - Create new records  
- \`${config.moduleId}.edit\` - Edit existing records
- \`${config.moduleId}.delete\` - Delete records

## TODO

- [ ] Implement Edit page and functionality
- [ ] Implement View page  
- [ ] Implement Delete functionality
- [ ] Add PUT and DELETE API endpoints
- [ ] Add form validation schemas
- [ ] Add error handling
- [ ] Add loading states
- [ ] Add confirmation dialogs
- [ ] Add bulk operations
- [ ] Add export functionality
- [ ] Add import functionality
- [ ] Add advanced filtering
- [ ] Add sorting options
- [ ] Write unit tests
- [ ] Write integration tests

## Getting Started

1. Make sure the module is registered in \`src/client/route.ts\`
2. Make sure the server routes are registered in \`src/server/main.ts\`
3. Run database migrations to create the table
4. Configure module authorization if required
5. Start implementing the TODO items above

## Created

- **Date**: ${new Date().toLocaleDateString()}
- **Author**: ${config.author}
- **Version**: 1.0.0
`;

  // Write server files
  const serverDir = path.join(moduleDir, 'server');
  
  fs.writeFileSync(
    path.join(serverDir, 'lib', 'db', 'schemas', `${config.moduleIdCamel}.ts`),
    schemaTemplate
  );
  
  fs.writeFileSync(
    path.join(serverDir, 'routes', `${config.moduleIdCamel}Routes.ts`),
    routesTemplate
  );
  
  fs.writeFileSync(
    path.join(moduleDir, 'docs', 'README.md'),
    readmeTemplate
  );

  console.log(`✅ Created server routes and database schema`);
}

// Check if this script is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { createModuleStructure };