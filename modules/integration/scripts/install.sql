-- Complete installation script for integration module
-- Generated on: 2025-11-12T18:44:38.646Z
-- Module: Integration
-- Version: 1.0.0

-- This script should be executed in the context of a tenant schema
-- Usage: 
--   1. Connect to your database
--   2. Set search_path to the appropriate tenant schema:
--      SET search_path TO tenant_[your_tenant_code], public;
--   3. Execute this script

\echo 'Installing integration module...'

-- Create tables
\i create_tables.sql

-- Insert permissions and seed data
\i seed_data.sql

\echo 'integration module installation completed successfully!'

-- Verification queries
-- SELECT COUNT(*) FROM "integration";
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'integration';

-- End of installation script
