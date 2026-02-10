#!/usr/bin/env node

/**
 * React Admin Module Generator (Command Line Version)
 * 
 * Usage: node scripts/create-module-cli.js <module-id> <module-name> [description] [author] [email] [category]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Utility functions
function toCamelCase(str) {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

function toPascalCase(str) {
  return str.replace(/(^|-)([a-z])/g, (g) => g.slice(-1).toUpperCase());
}

function toKebabCase(str) {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
}

// Import the main createModuleStructure function
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

// Function to generate module.json - simplified version
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
      permissions: [
        `${config.moduleId}.view`,
        `${config.moduleId}.create`,
        `${config.moduleId}.edit`,
        `${config.moduleId}.delete`
      ]
    },
    author: {
      name: config.author,
      email: config.email
    },
    createdAt: new Date().toISOString()
  };

  const filePath = path.join(moduleDir, 'module.json');
  fs.writeFileSync(filePath, JSON.stringify(moduleJson, null, 2));
  console.log(`✅ Created module.json`);
}

// Simplified React files generation
async function writeReactFiles(moduleDir, config) {
  const listPageTemplate = `import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@client/components/ui/card';

const ${config.moduleIdPascal}List: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">${config.moduleName}</h1>
        <p className="text-muted-foreground">
          Manage your ${config.moduleName.toLowerCase()} records
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>${config.moduleName} List</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Module generated successfully! Start implementing your features here.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ${config.moduleIdPascal}List;
`;

  const routesTemplate = `import { RouteObject } from 'react-router';
import ${config.moduleIdPascal}List from '../pages/${config.moduleIdPascal}List';

export const ${config.moduleIdCamel}ReactRoutes = (basePath: string): RouteObject => {
  return {
    path: basePath,
    children: [
      { index: true, Component: ${config.moduleIdPascal}List },
    ]
  };
};
`;

  const clientDir = path.join(moduleDir, 'client');
  
  fs.writeFileSync(
    path.join(clientDir, 'pages', `${config.moduleIdPascal}List.tsx`),
    listPageTemplate
  );
  
  fs.writeFileSync(
    path.join(clientDir, 'routes', `${config.moduleIdCamel}ReactRoutes.ts`),
    routesTemplate
  );

  console.log(`✅ Created React components and pages`);
}

// Simplified server files generation
async function writeServerFiles(moduleDir, config) {
  const routesTemplate = `import express from 'express';

const router = express.Router();

// GET /api/modules/${config.moduleId}
router.get('/', async (req, res) => {
  res.json({
    success: true,
    message: '${config.moduleName} API is working!',
    data: []
  });
});

export default router;
`;

  const serverDir = path.join(moduleDir, 'server');
  
  fs.writeFileSync(
    path.join(serverDir, 'routes', `${config.moduleIdCamel}Routes.ts`),
    routesTemplate
  );

  console.log(`✅ Created server routes`);
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node scripts/create-module-cli.js <module-id> <module-name> [description] [author] [email] [category]');
    console.log('Example: node scripts/create-module-cli.js "user-profile" "User Profile" "User management module" "Developer" "dev@example.com" "System"');
    process.exit(1);
  }

  const [moduleId, moduleName, description = 'Generated module', author = 'Developer', email = 'developer@example.com', category = 'Business'] = args;

  // Ensure kebab-case for module ID
  const moduleIdKebab = toKebabCase(moduleId);
  const moduleIdCamel = toCamelCase(moduleIdKebab);
  const moduleIdPascal = toPascalCase(moduleIdKebab);

  console.log(`\n📋 Generating module "${moduleName}" (${moduleIdKebab})...`);

  const config = {
    moduleId: moduleIdKebab,
    moduleIdCamel,
    moduleIdPascal,
    moduleName,
    description,
    author,
    email,
    category
  };

  createModuleStructure(moduleIdKebab, config)
    .then(() => {
      console.log('\n✅ Module created successfully!');
      console.log('\n📝 Next steps:');
      console.log('1. Register the module routes in src/client/route.ts');
      console.log('2. Register the server routes in src/server/main.ts');
      console.log('3. See scripts/REGISTRATION_GUIDE.md for detailed instructions');
      console.log(`\nModule location: src/modules/${moduleIdKebab}`);
    })
    .catch(error => {
      console.error('❌ Error creating module:', error.message);
      process.exit(1);
    });
}

main();