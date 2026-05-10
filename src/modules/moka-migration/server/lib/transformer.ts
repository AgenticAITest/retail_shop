import { MokaRawRow } from './csvParser';

export interface MokaCategory {
  name: string;
}

export interface MokaVariant {
  attribute: string; // e.g. "Large" extracted from "Coffee - Large"
  sku: string;
  barcode: string;
  price: number;
  cost: number;
  stock: number;
}

export interface MokaProduct {
  name: string;
  categoryName: string;
  sku: string;
  barcode: string;
  price: number;
  cost: number;
  trackInventory: boolean;
  stock: number;
  variants: MokaVariant[];
  isVariantParent: boolean;
}

export interface TransformResult {
  categories: MokaCategory[];
  products: MokaProduct[];
  modifiersSkipped: number;
  warnings: string[];
}

export function transformMokaRows(rows: MokaRawRow[]): TransformResult {
  const warnings: string[] = [];
  let modifiersSkipped = 0;

  // Collect unique category names
  const categorySet = new Set<string>();
  for (const row of rows) {
    if (row.category?.trim()) categorySet.add(row.category.trim());
  }

  // Group variant rows by their parent product name
  // MokaPOS variant rows are named "{ProductName} - {VariantAttribute}"
  // Regular rows are standalone products
  const productMap = new Map<string, MokaProduct>();

  for (const row of rows) {
    const rowType = (row.type ?? '').toLowerCase();

    if (rowType === 'modifier') {
      modifiersSkipped++;
      continue;
    }

    if (rowType === 'variant') {
      // Split on last " - " to extract parent name and attribute
      const dashIdx = row.name.lastIndexOf(' - ');
      if (dashIdx === -1) {
        warnings.push(`Variant row "${row.name}" has no " - " separator — treated as standalone product`);
        addStandaloneProduct(productMap, row);
        continue;
      }

      const parentName = row.name.substring(0, dashIdx).trim();
      const attribute = row.name.substring(dashIdx + 3).trim();

      let parent = productMap.get(parentName);
      if (!parent) {
        // Create a placeholder parent using the first variant's category/price
        parent = {
          name: parentName,
          categoryName: row.category?.trim() ?? '',
          sku: '',
          barcode: '',
          price: row.price,
          cost: row.cost,
          trackInventory: row.trackInventory,
          stock: 0,
          variants: [],
          isVariantParent: true,
        };
        productMap.set(parentName, parent);
      }

      parent.variants.push({
        attribute,
        sku: row.sku ?? '',
        barcode: row.barcode ?? '',
        price: row.price,
        cost: row.cost,
        stock: row.stock,
      });
    } else {
      // Regular product
      addStandaloneProduct(productMap, row);
    }
  }

  const categories: MokaCategory[] = Array.from(categorySet).map((name) => ({ name }));
  const products = Array.from(productMap.values());

  return { categories, products, modifiersSkipped, warnings };
}

function addStandaloneProduct(map: Map<string, MokaProduct>, row: MokaRawRow) {
  const existing = map.get(row.name);
  if (existing && !existing.isVariantParent) {
    // Duplicate standalone name — keep first, warn
    return;
  }
  map.set(row.name, {
    name: row.name,
    categoryName: row.category?.trim() ?? '',
    sku: row.sku ?? '',
    barcode: row.barcode ?? '',
    price: row.price,
    cost: row.cost,
    trackInventory: row.trackInventory,
    stock: row.stock,
    variants: [],
    isVariantParent: false,
  });
}
