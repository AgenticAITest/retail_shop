-- Purchase Order Module - Seed Data
-- Insert permissions for PO module

INSERT INTO sys_permission (id, code, name, description, created_at, updated_at) VALUES
  (gen_random_uuid(), 'retail.po.view', 'View Purchase Orders', 'Permission to view purchase orders', NOW(), NOW()),
  (gen_random_uuid(), 'retail.po.create', 'Create Purchase Orders', 'Permission to create purchase orders', NOW(), NOW()),
  (gen_random_uuid(), 'retail.po.edit', 'Edit Purchase Orders', 'Permission to edit purchase orders', NOW(), NOW()),
  (gen_random_uuid(), 'retail.po.delete', 'Delete Purchase Orders', 'Permission to cancel purchase orders', NOW(), NOW()),
  (gen_random_uuid(), 'retail.po.approve', 'Approve Purchase Orders', 'Permission to approve purchase orders', NOW(), NOW()),
  (gen_random_uuid(), 'retail.po.send', 'Send Purchase Orders', 'Permission to send purchase orders to suppliers', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;
