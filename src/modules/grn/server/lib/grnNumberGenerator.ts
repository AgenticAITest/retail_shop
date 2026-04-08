import { sql } from 'drizzle-orm';
import { grnSequence } from '@server/lib/db/schema/retail';

export async function generateGrnNumber(tenantDb: any): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [result] = await tenantDb
    .insert(grnSequence)
    .values({ yearMonth, lastSequence: 1 })
    .onConflictDoUpdate({
      target: grnSequence.yearMonth,
      set: { lastSequence: sql`${grnSequence.lastSequence} + 1` },
    })
    .returning({ seq: grnSequence.lastSequence });

  return `GRN-${yearMonth}-${String(result.seq).padStart(4, '0')}`;
}
