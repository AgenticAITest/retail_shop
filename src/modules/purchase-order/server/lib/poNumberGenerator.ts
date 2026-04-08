import { sql } from 'drizzle-orm';
import { poSequence } from '@server/lib/db/schema/retail';

export async function generatePoNumber(tenantDb: any): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Atomic upsert: INSERT ON CONFLICT increments the counter
  const [result] = await tenantDb
    .insert(poSequence)
    .values({ yearMonth, lastSequence: 1 })
    .onConflictDoUpdate({
      target: poSequence.yearMonth,
      set: { lastSequence: sql`${poSequence.lastSequence} + 1` },
    })
    .returning({ seq: poSequence.lastSequence });

  return `PO-${yearMonth}-${String(result.seq).padStart(4, '0')}`;
}
