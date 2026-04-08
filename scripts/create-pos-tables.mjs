import postgres from 'postgres';
import { readFileSync } from 'fs';

const sql = postgres('postgresql://sdlc_user:sdlc_password@localhost:5432/retail_multitenant');

const CREATE_TABLES_SQL = readFileSync(new URL('../../modules/pos/scripts/create_tables.sql', import.meta.url), 'utf-8');

const schemas = await sql`SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'`;
console.log('Found tenant schemas:', schemas.map(r => r.schema_name));

for (const row of schemas) {
  const schema = row.schema_name;
  console.log(`\nCreating POS tables in ${schema}...`);
  try {
    await sql.unsafe(`SET search_path TO "${schema}"`);
    await sql.unsafe(CREATE_TABLES_SQL);
    console.log(`  OK - tables created in ${schema}`);
  } catch (err) {
    console.error(`  ERROR in ${schema}:`, err.message);
  }
}

// Register module
try {
  await sql.unsafe('SET search_path TO public');
  const existing = await sql`SELECT id FROM sys_module_registry WHERE "moduleId" = 'pos'`;
  if (existing.length === 0) {
    await sql`INSERT INTO sys_module_registry ("moduleId", "moduleName", version, description, category, "isActive") VALUES ('pos', 'Point of Sale', '1.0.0', 'POS sales interface with barcode scanning, cart management, and checkout', 'Retail', true)`;
    console.log('\nModule registered in sys_module_registry');
  } else {
    console.log('\nModule already registered');
  }
} catch (err) {
  console.error('Error registering module:', err.message);
}

await sql.end();
console.log('\nDone!');
