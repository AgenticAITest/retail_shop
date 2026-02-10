-- Complete installation script for showcase-module module
-- Generated on: 2025-11-11T05:07:15.684Z
-- Module: Showcase Module
-- Version: 1.0.0

-- This script should be executed in the context of a tenant schema
-- Usage: 
--   1. Connect to your database
--   2. Set search_path to the appropriate tenant schema:
--      SET search_path TO tenant_[your_tenant_code], public;
--   3. Execute this script

\echo 'Installing showcase-module module...'

-- Create tables
\i create_tables.sql

-- Insert seed data (optional)
-- \i seed_data.sql

\echo 'showcase-module module installation completed successfully!'

-- Verification queries
-- SELECT COUNT(*) FROM "showcase-module";
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'showcase-module';

-- End of installation script
