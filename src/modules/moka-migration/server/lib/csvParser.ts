import { parse as csvParse } from 'fast-csv';
import { Readable } from 'stream';

export interface MokaRawRow {
  name: string;
  category: string;
  type: string; // Regular | Variant | Modifier
  sku: string;
  barcode: string;
  price: number;
  cost: number;
  trackInventory: boolean;
  stock: number;
}

// MokaPOS exports in both Indonesian and English column headers
const COLUMN_MAP: Record<string, keyof MokaRawRow> = {
  // English headers
  'Name': 'name',
  'Category': 'category',
  'Type': 'type',
  'SKU': 'sku',
  'Barcode': 'barcode',
  'Price': 'price',
  'Cost': 'cost',
  'Track Inventory': 'trackInventory',
  'Stock': 'stock',
  // Indonesian headers
  'Nama': 'name',
  'Kategori': 'category',
  'Tipe': 'type',
  'Kode SKU': 'sku',
  'Kode Barcode': 'barcode',
  'Harga': 'price',
  'Modal': 'cost',
  'Lacak Inventaris': 'trackInventory',
  'Stok': 'stock',
};

function parseNumber(val: string): number {
  if (!val || val.trim() === '') return 0;
  return parseFloat(val.replace(/[^0-9.-]/g, '')) || 0;
}

function parseBoolean(val: string): boolean {
  return val?.toLowerCase() === 'true' || val?.toLowerCase() === 'yes' || val === '1';
}

export async function parseMokaItemsCsv(csvData: string): Promise<MokaRawRow[]> {
  return new Promise((resolve, reject) => {
    const rows: MokaRawRow[] = [];
    let headerMapping: Record<string, keyof MokaRawRow> | null = null;

    const stream = Readable.from([csvData]).pipe(
      csvParse({ headers: true, trim: true, ignoreEmpty: true })
    );

    stream.on('headers', (rawHeaders: string[]) => {
      headerMapping = {};
      for (const h of rawHeaders) {
        const mapped = COLUMN_MAP[h];
        if (mapped) headerMapping[h] = mapped;
      }
    });

    stream.on('data', (rawRow: Record<string, string>) => {
      if (!headerMapping) return;
      const row: Partial<MokaRawRow> = {};
      for (const [col, field] of Object.entries(headerMapping)) {
        const val = rawRow[col] ?? '';
        if (field === 'price' || field === 'cost' || field === 'stock') {
          (row as Record<string, unknown>)[field] = parseNumber(val);
        } else if (field === 'trackInventory') {
          row.trackInventory = parseBoolean(val);
        } else {
          (row as Record<string, unknown>)[field] = val;
        }
      }
      if (row.name) {
        rows.push(row as MokaRawRow);
      }
    });

    stream.on('end', () => resolve(rows));
    stream.on('error', reject);
  });
}
