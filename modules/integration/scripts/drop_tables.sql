-- Drop tables for integration module
-- Generated on: 2025-11-12T18:44:38.643Z
-- WARNING: This will permanently delete all data in these tables!

-- Set schema search path (this will be dynamically set per tenant)
-- SET search_path TO tenant_[tenant_code], public;

-- Drop indexes first (if they exist)

-- Drop tables (in reverse dependency order to handle foreign keys)
DROP TABLE IF EXISTS "int_webhook" CASCADE;
DROP TABLE IF EXISTS "int_api_key" CASCADE;
DROP TABLE IF EXISTS "int_event" CASCADE;
DROP TABLE IF EXISTS "int_partner" CASCADE;

-- End of integration table drop script
