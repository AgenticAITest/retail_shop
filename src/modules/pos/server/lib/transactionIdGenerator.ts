import { sql } from 'drizzle-orm';

export async function generateTransactionId(tenantDb: any, locationCode: string): Promise<string> {
  const now = new Date();
  const dateKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

  // Atomic upsert using raw SQL for composite unique constraint
  const [result] = await tenantDb.execute(sql`
    INSERT INTO pos_sequences (location_code, date_key, last_sequence)
    VALUES (${locationCode}, ${dateKey}, 1)
    ON CONFLICT (location_code, date_key) DO UPDATE
    SET last_sequence = pos_sequences.last_sequence + 1,
        updated_at = NOW()
    RETURNING last_sequence
  `);

  const seq = result.last_sequence;
  return `${locationCode}-${dateKey}-${String(seq).padStart(4, '0')}`;
}
