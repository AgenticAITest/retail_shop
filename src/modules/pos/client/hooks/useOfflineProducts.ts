/**
 * Offline-Aware Product Search Hook
 *
 * When online: fetches from the server API (current behavior)
 * When offline: queries Dexie.js IndexedDB for cached products
 * Provides isOnline status for UI indicators.
 */

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { offlineDb } from '../lib/offlineDb';

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

interface UseOfflineProductsOptions {
  search: string;
  categoryId: string;
  locationId: string | null;
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function useOfflineProducts({ search, categoryId, locationId }: UseOfflineProductsOptions) {
  const isOnline = useOnlineStatus();
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'server' | 'cache'>('server');

  const loadProducts = useCallback(async () => {
    setLoading(true);

    if (isOnline) {
      // Online: fetch from server API
      try {
        const params: any = { perPage: 100 };
        if (search) params.search = search;
        if (categoryId !== 'all') params.categoryId = categoryId;
        if (locationId) params.locationId = locationId;

        const res = await axios.get('/api/modules/pos/transaction/products', { params });
        setProducts(res.data.products || []);
        setSource('server');
      } catch {
        // Server failed — fall back to cache
        await loadFromCache();
      }
    } else {
      // Offline: query IndexedDB
      await loadFromCache();
    }

    setLoading(false);
  }, [isOnline, search, categoryId, locationId]);

  async function loadFromCache() {
    try {
      let query = offlineDb.products.where('status').equals('active');

      let results = await query.toArray();

      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        results = results.filter(p =>
          p.name.toLowerCase().includes(searchLower) ||
          p.skuCode.toLowerCase().includes(searchLower)
        );
      }

      // Apply category filter
      if (categoryId && categoryId !== 'all') {
        results = results.filter(p => p.categoryId === categoryId);
      }

      // Sort by name
      results.sort((a, b) => a.name.localeCompare(b.name));

      // Limit
      results = results.slice(0, 100);

      setProducts(results.map(p => ({
        id: p.id,
        skuCode: p.skuCode,
        name: p.name,
        categoryId: p.categoryId,
        categoryName: p.categoryName,
        sellingPrice: p.sellingPrice,
        taxApplicable: p.taxApplicable,
        imageUrl: p.imageUrl,
        qtyOnHand: null,
      })));
      setSource('cache');
    } catch {
      setProducts([]);
      setSource('cache');
    }
  }

  useEffect(() => {
    const timer = setTimeout(loadProducts, 300);
    return () => clearTimeout(timer);
  }, [loadProducts]);

  return { products, loading, isOnline, source };
}
