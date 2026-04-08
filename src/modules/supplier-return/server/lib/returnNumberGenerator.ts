import { sql } from 'drizzle-orm';
import { srSequence } from '@server/lib/db/schema/retail';

export async function generateReturnNumber(tenantDb: any): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [result] = await tenantDb
    .insert(srSequence)
    .values({ yearMonth, lastSequence: 1 })
    .onConflictDoUpdate({
      target: srSequence.yearMonth,
      set: { lastSequence: sql`${srSequence.lastSequence} + 1` },
    })
    .returning({ seq: srSequence.lastSequence });

  return `SR-${yearMonth}-${String(result.seq).padStart(4, '0')}`;
}
