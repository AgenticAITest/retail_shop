-- Drop tables for demo-module module
-- Generated on: 2025-11-11T03:02:12.861Z
-- WARNING: This will permanently delete all data in these tables!

-- Set schema search path (this will be dynamically set per tenant)
-- SET search_path TO tenant_[tenant_code], public;

-- Drop indexes first (if they exist)

-- Drop tables (in reverse dependency order to handle foreign keys)
DROP TABLE IF EXISTS "demo_employee_skill" CASCADE;
DROP TABLE IF EXISTS "demo_employee_bio" CASCADE;
DROP TABLE IF EXISTS "demo_employee" CASCADE;
DROP TABLE IF EXISTS "demo_department" CASCADE;
DROP TABLE IF EXISTS "demo_document" CASCADE;

-- End of demo-module table drop script
