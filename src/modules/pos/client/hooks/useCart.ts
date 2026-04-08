import { createContext, useContext, useReducer, useMemo, type ReactNode } from 'react';
import React from 'react';

// ============================================================
// TYPES
// ============================================================

export interface CartItem {
  id: string;
  productId: string;
  variantId: string | null;
  skuCode: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  taxApplicable: boolean;
  discount: { type: 'percent' | 'fixed'; value: number } | null;
  imageUrl: string | null;
}

export interface CartState {
  items: CartItem[];
  transactionDiscount: { type: 'percent' | 'fixed'; value: number } | null;
  locationId: string | null;
}

export interface CartTotals {
  itemCount: number;
  subtotal: number;
  itemDiscountTotal: number;
  transactionDiscountAmount: number;
  taxAmount: number;
  grandTotal: number;
}

// ============================================================
// ACTIONS
// ============================================================

type CartAction =
  | { type: 'ADD_ITEM'; payload: Omit<CartItem, 'id' | 'quantity' | 'discount'> }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'SET_ITEM_DISCOUNT'; payload: { id: string; discount: CartItem['discount'] } }
  | { type: 'SET_TRANSACTION_DISCOUNT'; payload: CartState['transactionDiscount'] }
  | { type: 'SET_LOCATION'; payload: string }
  | { type: 'CLEAR' };

// ============================================================
// REDUCER
// ============================================================

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      // Check if item already exists (same product + variant)
      const existing = state.items.find(
        i => i.productId === action.payload.productId && i.variantId === action.payload.variantId
      );
      if (existing) {
        return {
          ...state,
          items: state.items.map(i =>
            i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return {
        ...state,
        items: [...state.items, {
          ...action.payload,
          id: crypto.randomUUID(),
          quantity: 1,
          discount: null,
        }],
      };
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter(i => i.id !== action.payload) };
    case 'UPDATE_QUANTITY':
      if (action.payload.quantity <= 0) {
        return { ...state, items: state.items.filter(i => i.id !== action.payload.id) };
      }
      return {
        ...state,
        items: state.items.map(i =>
          i.id === action.payload.id ? { ...i, quantity: action.payload.quantity } : i
        ),
      };
    case 'SET_ITEM_DISCOUNT':
      return {
        ...state,
        items: state.items.map(i =>
          i.id === action.payload.id ? { ...i, discount: action.payload.discount } : i
        ),
      };
    case 'SET_TRANSACTION_DISCOUNT':
      return { ...state, transactionDiscount: action.payload };
    case 'SET_LOCATION':
      return { ...state, locationId: action.payload };
    case 'CLEAR':
      return { ...state, items: [], transactionDiscount: null };
    default:
      return state;
  }
}

// ============================================================
// TAX CALCULATION (client-side mirror of server)
// ============================================================

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateCartTotals(
  items: CartItem[],
  transactionDiscount: CartState['transactionDiscount'],
  taxRate: number,
  taxCalcMode: 'inclusive' | 'exclusive',
): CartTotals {
  let subtotalBeforeTax = 0;
  let itemDiscountTotal = 0;
  let totalTax = 0;

  for (const item of items) {
    const gross = item.quantity * item.unitPrice;
    let discountAmount = 0;
    if (item.discount?.type === 'percent') {
      discountAmount = round2(gross * (item.discount.value / 100));
    } else if (item.discount?.type === 'fixed') {
      discountAmount = round2(Math.min(item.discount.value * item.quantity, gross));
    }
    const afterDiscount = gross - discountAmount;
    itemDiscountTotal += discountAmount;

    let taxAmount = 0;
    if (item.taxApplicable && taxRate > 0) {
      if (taxCalcMode === 'inclusive') {
        taxAmount = round2(afterDiscount - afterDiscount / (1 + taxRate));
        subtotalBeforeTax += afterDiscount - taxAmount;
      } else {
        taxAmount = round2(afterDiscount * taxRate);
        subtotalBeforeTax += afterDiscount;
      }
    } else {
      subtotalBeforeTax += afterDiscount;
    }
    totalTax += taxAmount;
  }

  let transactionDiscountAmount = 0;
  if (transactionDiscount && transactionDiscount.value > 0) {
    if (transactionDiscount.type === 'percent') {
      transactionDiscountAmount = round2(subtotalBeforeTax * (transactionDiscount.value / 100));
    } else {
      transactionDiscountAmount = round2(Math.min(transactionDiscount.value, subtotalBeforeTax));
    }
  }

  return {
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: round2(subtotalBeforeTax),
    itemDiscountTotal: round2(itemDiscountTotal),
    transactionDiscountAmount: round2(transactionDiscountAmount),
    taxAmount: round2(totalTax),
    grandTotal: round2(subtotalBeforeTax - transactionDiscountAmount + round2(totalTax)),
  };
}

// ============================================================
// CONTEXT
// ============================================================

interface CartContextType {
  state: CartState;
  totals: CartTotals;
  taxRate: number;
  taxCalcMode: 'inclusive' | 'exclusive';
  setTaxConfig: (rate: number, mode: 'inclusive' | 'exclusive') => void;
  addItem: (item: Omit<CartItem, 'id' | 'quantity' | 'discount'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  setItemDiscount: (id: string, discount: CartItem['discount']) => void;
  setTransactionDiscount: (discount: CartState['transactionDiscount']) => void;
  setLocation: (locationId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    transactionDiscount: null,
    locationId: null,
  });

  const [taxRate, setTaxRate] = React.useState(0);
  const [taxCalcMode, setTaxCalcMode] = React.useState<'inclusive' | 'exclusive'>('exclusive');

  const totals = useMemo(
    () => calculateCartTotals(state.items, state.transactionDiscount, taxRate, taxCalcMode),
    [state.items, state.transactionDiscount, taxRate, taxCalcMode]
  );

  const ctx: CartContextType = useMemo(() => ({
    state,
    totals,
    taxRate,
    taxCalcMode,
    setTaxConfig: (rate: number, mode: 'inclusive' | 'exclusive') => {
      setTaxRate(rate);
      setTaxCalcMode(mode);
    },
    addItem: (item) => dispatch({ type: 'ADD_ITEM', payload: item }),
    removeItem: (id) => dispatch({ type: 'REMOVE_ITEM', payload: id }),
    updateQuantity: (id, quantity) => dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } }),
    setItemDiscount: (id, discount) => dispatch({ type: 'SET_ITEM_DISCOUNT', payload: { id, discount } }),
    setTransactionDiscount: (discount) => dispatch({ type: 'SET_TRANSACTION_DISCOUNT', payload: discount }),
    setLocation: (locationId) => dispatch({ type: 'SET_LOCATION', payload: locationId }),
    clear: () => dispatch({ type: 'CLEAR' }),
  }), [state, totals, taxRate, taxCalcMode]);

  return React.createElement(CartContext.Provider, { value: ctx }, children);
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
