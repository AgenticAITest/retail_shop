-- Complete installation script for demo-module module
-- Generated on: 2025-11-11T03:02:12.864Z
-- Module: Demo Module
-- Version: 1.0.0

-- This script should be executed in the context of a tenant schema
-- Usage: 
--   1. Connect to your database
--   2. Set search_path to the appropriate tenant schema:
--      SET search_path TO tenant_[your_tenant_code], public;
--   3. Execute this script

\echo 'Installing demo-module module...'

-- Create tables
\i create_tables.sql

-- Insert permissions and seed data
\i seed_data.sql

\echo 'demo-module module installation completed successfully!'

-- Verification queries
-- SELECT COUNT(*) FROM "demo-module";
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'demo-module';

-- End of installation script
