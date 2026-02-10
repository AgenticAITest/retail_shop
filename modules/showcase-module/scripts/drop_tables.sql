-- Drop tables for showcase-module module
-- Generated on: 2025-11-11T05:07:15.681Z
-- WARNING: This will permanently delete all data in these tables!

-- Set schema search path (this will be dynamically set per tenant)
-- SET search_path TO tenant_[tenant_code], public;

-- Drop indexes first (if they exist)

-- Drop tables (in reverse dependency order to handle foreign keys)
DROP TABLE IF EXISTS "showcase-module" CASCADE;

-- End of showcase-module table drop script
