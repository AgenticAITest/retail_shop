import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@client/components/ui/tabs';
import { Grid3X3, List, Package, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useCart } from '../../hooks/useCart';
import { useOfflineProducts } from '../../hooks/useOfflineProducts';

interface PosProduct {
  id: string;
  skuCode: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  sellingPrice: string | number;
  taxApplicable: boolean;
  imageUrl: string | null;
  qtyOnHand: number | null;
}

interface PosCategory {
  id: string;
  name: string;
  parentId: string | null;
  level: number;
}

interface ProductGridProps {
  locationId: string | null;
  viewMode: 'grid' | 'list';
  onToggleView: () => void;
}

export default function ProductGrid({ locationId, viewMode, onToggleView }: ProductGridProps) {
  const { addItem } = useCart();
  const [categories, setCategories] = useState<PosCategory[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const searchRef = useRef<HTMLInputElement>(null);

  // Offline-aware product loading
  const { products, loading, source } = useOfflineProducts({
    search,
    categoryId: selectedCategory,
    locationId,
  });

  // Auto-focus search on mount
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Load categories
  useEffect(() => {
    axios.get('/api/modules/pos/transaction/categories')
      .then(res => setCategories(res.data.categories || []))
      .catch(() => {});
  }, []);

  function handleAddItem(p: PosProduct) {
    addItem({
      productId: p.id,
      variantId: null,
      skuCode: p.skuCode,
      productName: p.name,
      unitPrice: typeof p.sellingPrice === 'number' ? p.sellingPrice : parseFloat(p.sellingPrice),
      taxApplicable: p.taxApplicable,
      imageUrl: p.imageUrl,
    });
  }

  function formatPrice(price: string | number) {
    return Number(price).toLocaleString('id-ID');
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="flex items-center gap-2 p-3 border-b">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            type="text"
            placeholder="Search products or scan barcode..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-11"
            data-testid="pos-search"
          />
        </div>
        <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={onToggleView}>
          {viewMode === 'grid' ? <List size={18} /> : <Grid3X3 size={18} />}
        </Button>
      </div>

      {/* Category Tabs */}
      <div className="border-b px-3 py-2 overflow-x-auto">
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="h-9 flex-wrap">
            <TabsTrigger value="all" className="min-h-[36px] min-w-[44px] px-3">All</TabsTrigger>
            {categories.filter(c => c.level === 1).map(cat => (
              <TabsTrigger key={cat.id} value={cat.id} className="min-h-[36px] min-w-[44px] px-3">
                {cat.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Product Grid / List */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading && <div className="flex items-center justify-center py-10 text-muted-foreground">Loading products...</div>}

        {!loading && products.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Package size={40} className="mb-2 opacity-50" />
            <p>No products found</p>
          </div>
        )}

        {!loading && viewMode === 'grid' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {products.map(p => (
              <button
                key={p.id}
                onClick={() => handleAddItem(p)}
                className="flex flex-col items-center p-3 rounded-lg border bg-card hover:bg-accent hover:border-primary transition-colors cursor-pointer text-left min-h-[120px]"
                data-testid={`product-tile-${p.skuCode}`}
              >
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-14 h-14 object-cover rounded mb-2" />
                ) : (
                  <div className="w-14 h-14 rounded bg-muted flex items-center justify-center mb-2">
                    <Package size={24} className="text-muted-foreground" />
                  </div>
                )}
                <span className="text-xs font-medium text-center line-clamp-2 leading-tight">{p.name}</span>
                <span className="text-sm font-bold mt-auto pt-1">Rp {formatPrice(p.sellingPrice)}</span>
                {p.qtyOnHand !== null && p.qtyOnHand <= 0 && (
                  <span className="text-[10px] text-red-500 font-medium">Out of stock</span>
                )}
              </button>
            ))}
          </div>
        )}

        {!loading && viewMode === 'list' && (
          <div className="space-y-1">
            {products.map(p => (
              <button
                key={p.id}
                onClick={() => handleAddItem(p)}
                className="flex items-center gap-3 w-full p-2 rounded-lg border bg-card hover:bg-accent hover:border-primary transition-colors cursor-pointer text-left min-h-[48px]"
              >
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-10 h-10 object-cover rounded" />
                ) : (
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                    <Package size={18} className="text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.skuCode} {p.categoryName ? `· ${p.categoryName}` : ''}</p>
                </div>
                <span className="text-sm font-bold whitespace-nowrap">Rp {formatPrice(p.sellingPrice)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
