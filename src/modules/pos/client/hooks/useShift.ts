import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import React from 'react';
import axios from 'axios';

interface ShiftData {
  id: string;
  status: string;
  openedAt: string;
  openingFloat: string;
  locationId: string;
  location?: { name: string; code: string };
  cashDrops?: any[];
}

interface ShiftSummary {
  totalSales: number;
  totalRevenue: string;
  totalVoided: string;
  totalCashPayments: string;
  totalCashDrops: number;
  expectedCash: number;
}

interface ShiftContextType {
  currentShift: ShiftData | null;
  summary: ShiftSummary | null;
  isShiftOpen: boolean;
  loading: boolean;
  openShift: (locationId: string, openingFloat: number) => Promise<boolean>;
  closeShift: (actualCash: number, varianceReason?: string, notes?: string) => Promise<boolean>;
  cashDrop: (amount: number, reason: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const ShiftContext = createContext<ShiftContextType | null>(null);

export function ShiftProvider({ children }: { children: ReactNode }) {
  const [currentShift, setCurrentShift] = useState<ShiftData | null>(null);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await axios.get('/api/modules/pos/shift/current');
      setCurrentShift(res.data.shift || null);
      setSummary(res.data.summary || null);
    } catch {
      setCurrentShift(null);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const openShift = useCallback(async (locationId: string, openingFloat: number) => {
    try {
      await axios.post('/api/modules/pos/shift/open', { locationId, openingFloat });
      await refresh();
      return true;
    } catch {
      return false;
    }
  }, [refresh]);

  const closeShift = useCallback(async (actualCash: number, varianceReason?: string, notes?: string) => {
    if (!currentShift) return false;
    try {
      await axios.post(`/api/modules/pos/shift/${currentShift.id}/close`, { actualCash, varianceReason, notes });
      await refresh();
      return true;
    } catch {
      return false;
    }
  }, [currentShift, refresh]);

  const cashDrop = useCallback(async (amount: number, reason: string) => {
    if (!currentShift) return false;
    try {
      await axios.post(`/api/modules/pos/shift/${currentShift.id}/cash-drop`, { amount, reason });
      await refresh();
      return true;
    } catch {
      return false;
    }
  }, [currentShift, refresh]);

  const ctx: ShiftContextType = {
    currentShift, summary, isShiftOpen: currentShift?.status === 'open', loading,
    openShift, closeShift, cashDrop, refresh,
  };

  return React.createElement(ShiftContext.Provider, { value: ctx }, children);
}

export function useShift(): ShiftContextType {
  const ctx = useContext(ShiftContext);
  if (!ctx) throw new Error('useShift must be used within ShiftProvider');
  return ctx;
}
