import { sql } from 'drizzle-orm';
import { transferSequence } from '@server/lib/db/schema/retail';

export async function generateTransferNumber(tenantDb: any): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [result] = await tenantDb
    .insert(transferSequence)
    .values({ yearMonth, lastSequence: 1 })
    .onConflictDoUpdate({
      target: transferSequence.yearMonth,
      set: { lastSequence: sql`${transferSequence.lastSequence} + 1` },
    })
    .returning({ seq: transferSequence.lastSequence });

  return `TRF-${yearMonth}-${String(result.seq).padStart(4, '0')}`;
}
