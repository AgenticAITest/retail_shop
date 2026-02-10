# Demo Module - Database Scripts

This directory contains SQL scripts for the **Demo Module** module.

## Files

### `install.sql`
Complete installation script that runs all necessary setup steps.

**Usage:**
```bash
# Connect to your database and run:
psql -d your_database -f install.sql
```

### `create_tables.sql`
Creates all tables, indexes, and constraints for the module.

### `drop_tables.sql`
⚠️ **WARNING**: Drops all tables and data for the module. Use with caution!

### `seed_data.sql`
Sample data for testing and development (optional).

## Multi-Tenant Usage

These scripts are designed for multi-tenant deployment. Before running any script:

```sql
-- Set the search path to your tenant schema
SET search_path TO tenant_your_tenant_code, public;
```

## Installation Steps

1. **Prepare the database**:
   ```sql
   -- Connect to your database
   -- Set search path for target tenant
   SET search_path TO tenant_example, public;
   ```

2. **Install the module**:
   ```bash
   psql -d your_database -f install.sql
   ```

3. **Verify installation**:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_name = 'demo-module' 
   AND table_schema = 'tenant_example';
   ```

## Module Information

- **Module ID**: demo-module
- **Module Name**: Demo Module
- **Version**: 1.0.0
- **Category**: Demo
- **Generated**: 11/11/2025

## Permissions Required

The database user needs the following permissions:
- CREATE (for tables and indexes)
- SELECT, INSERT, UPDATE, DELETE (for data operations)
- REFERENCES (for foreign keys)

## Troubleshooting

### Common Issues

1. **Permission denied**: Ensure your database user has sufficient privileges
2. **Schema not found**: Verify the tenant schema exists and search_path is correct
3. **Table already exists**: Run `drop_tables.sql` first if reinstalling

### Verification Queries

```sql
-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'demo-module'
  AND table_schema = current_schema()
);

-- Check table structure
\d "demo-module"

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename = 'demo-module';
```

## Support

For issues or questions about this module, refer to:
- Module documentation: `../docs/README.md`
- Project repository: https://github.com/your-org/react-admin.git
- Author: Developer (developer@neo-fusion.com)
