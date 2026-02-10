-- Seed data for integration module
-- Generated on: 2025-11-12T18:44:38.645Z
-- Module: Integration

-- Set schema search path (this will be dynamically set per tenant)
-- SET search_path TO tenant_[tenant_code], public;

-- Insert module permissions into sys_permission table
-- These permissions are required for the module to function properly

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'integration.partner.view', 'Integration Partner View', 'View integration data', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'integration.partner.create', 'Integration Partner Create', 'Create new integration entries', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'integration.partner.edit', 'Integration Partner Edit', 'Edit existing integration entries', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'integration.partner.delete', 'Integration Partner Delete', 'Delete integration entries', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'integration.event.view', 'Integration Event View', 'View integration data', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'integration.event.create', 'Integration Event Create', 'Create new integration entries', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'integration.event.edit', 'Integration Event Edit', 'Edit existing integration entries', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'integration.event.delete', 'Integration Event Delete', 'Delete integration entries', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'integration.api-key.view', 'Integration Api-key View', 'View integration data', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'integration.api-key.create', 'Integration Api-key Create', 'Create new integration entries', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'integration.api-key.edit', 'Integration Api-key Edit', 'Edit existing integration entries', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'integration.api-key.delete', 'Integration Api-key Delete', 'Delete integration entries', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'integration.webhook.view', 'Integration Webhook View', 'View integration data', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'integration.webhook.create', 'Integration Webhook Create', 'Create new integration entries', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'integration.webhook.edit', 'Integration Webhook Edit', 'Edit existing integration entries', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_permission (id, code, name, description, "createdAt", "updatedAt") 
VALUES (gen_random_uuid(), 'integration.webhook.delete', 'Integration Webhook Delete', 'Delete integration entries', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- Sample data for integration
-- Uncomment and modify as needed

/*
INSERT INTO "integration" (name, description) VALUES 
  ('Sample Item 1', 'This is a sample item for testing'),
  ('Sample Item 2', 'Another sample item'),
  ('Sample Item 3', 'Third sample item for demonstration');
*/

-- End of integration seed data script
