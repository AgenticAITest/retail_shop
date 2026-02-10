-- Seed data for demo-module module
-- Generated on: 2025-11-11T03:02:12.863Z
-- Module: Demo Module

-- Set schema search path (this will be dynamically set per tenant)
-- SET search_path TO tenant_[tenant_code], public;

-- Insert module permissions into sys_permission table
-- These permissions are required for the module to function properly

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'demo-module.document.view', 'Demo-module Document View', 'View demo-module data', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'demo-module.document.create', 'Demo-module Document Create', 'Create new demo-module entries', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'demo-module.document.edit', 'Demo-module Document Edit', 'Edit existing demo-module entries', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'demo-module.document.delete', 'Demo-module Document Delete', 'Delete demo-module entries', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'demo-module.document.import', 'Demo-module Document Import', 'Permission for demo-module module', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'demo-module.document.export', 'Demo-module Document Export', 'Permission for demo-module module', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'demo-module.employee.view', 'Demo-module Employee View', 'View demo-module data', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'demo-module.employee.create', 'Demo-module Employee Create', 'Create new demo-module entries', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'demo-module.employee.edit', 'Demo-module Employee Edit', 'Edit existing demo-module entries', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'demo-module.employee.delete', 'Demo-module Employee Delete', 'Delete demo-module entries', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'demo-module.employee.import', 'Demo-module Employee Import', 'Permission for demo-module module', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'demo-module.employee.export', 'Demo-module Employee Export', 'Permission for demo-module module', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'demo-module.department.view', 'Demo-module Department View', 'View demo-module data', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'demo-module.department.create', 'Demo-module Department Create', 'Create new demo-module entries', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'demo-module.department.edit', 'Demo-module Department Edit', 'Edit existing demo-module entries', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'demo-module.department.delete', 'Demo-module Department Delete', 'Delete demo-module entries', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'demo-module.department.import', 'Demo-module Department Import', 'Permission for demo-module module', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'demo-module.department.export', 'Demo-module Department Export', 'Permission for demo-module module', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- Sample data for demo-module
-- Uncomment and modify as needed

/*
INSERT INTO "demo-module" (name, description) VALUES 
  ('Sample Item 1', 'This is a sample item for testing'),
  ('Sample Item 2', 'Another sample item'),
  ('Sample Item 3', 'Third sample item for demonstration');
*/

-- End of demo-module seed data script
