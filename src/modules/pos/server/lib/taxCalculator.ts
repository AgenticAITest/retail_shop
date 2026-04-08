export interface PosTaxConfig {
  ratePercent: string | number;
  calcMode: 'inclusive' | 'exclusive';
}

export interface PosLineItemInput {
  quantity: number;
  unitPrice: number;
  taxApplicable: boolean;
  discountType?: 'percent' | 'fixed' | null;
  discountValue?: number;
}

export interface CalculatedPosLineItem extends PosLineItemInput {
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface PosCalculationResult {
  subtotal: number;
  itemDiscountTotal: number;
  transactionDiscountAmount: number;
  taxAmount: number;
  totalAmount: number;
  items: CalculatedPosLineItem[];
}

export function calculatePosTransaction(
  items: PosLineItemInput[],
  taxConfig: PosTaxConfig | null,
  transactionDiscount?: { type: 'percent' | 'fixed'; value: number } | null,
): PosCalculationResult {
  const taxRate = taxConfig ? parseFloat(String(taxConfig.ratePercent)) / 100 : 0;
  const calcMode = taxConfig?.calcMode || 'exclusive';

  let subtotalBeforeTax = 0;
  let totalItemDiscount = 0;
  let totalTax = 0;

  const calculatedItems: CalculatedPosLineItem[] = items.map((item) => {
    const grossAmount = item.quantity * item.unitPrice;

    // Per-item discount
    let discountAmount = 0;
    if (item.discountType === 'percent' && item.discountValue) {
      discountAmount = round2(grossAmount * (item.discountValue / 100));
    } else if (item.discountType === 'fixed' && item.discountValue) {
      discountAmount = round2(Math.min(item.discountValue * item.quantity, grossAmount));
    }

    const afterDiscount = grossAmount - discountAmount;

    // Tax calculation (only if taxApplicable)
    let taxAmount = 0;
    let lineTotal: number;

    if (item.taxApplicable && taxRate > 0) {
      if (calcMode === 'inclusive') {
        taxAmount = round2(afterDiscount - afterDiscount / (1 + taxRate));
        lineTotal = round2(afterDiscount);
      } else {
        taxAmount = round2(afterDiscount * taxRate);
        lineTotal = round2(afterDiscount + taxAmount);
      }
    } else {
      lineTotal = round2(afterDiscount);
    }

    // For subtotal display: amount before tax
    if (calcMode === 'inclusive' && item.taxApplicable) {
      subtotalBeforeTax += afterDiscount - taxAmount;
    } else {
      subtotalBeforeTax += afterDiscount;
    }

    totalItemDiscount += discountAmount;
    totalTax += taxAmount;

    return {
      ...item,
      discountAmount,
      taxAmount,
      lineTotal,
    };
  });

  // Transaction-level discount (applied to subtotal before tax)
  let transactionDiscountAmount = 0;
  if (transactionDiscount && transactionDiscount.value > 0) {
    if (transactionDiscount.type === 'percent') {
      transactionDiscountAmount = round2(subtotalBeforeTax * (transactionDiscount.value / 100));
    } else {
      transactionDiscountAmount = round2(Math.min(transactionDiscount.value, subtotalBeforeTax));
    }
  }

  const subtotal = round2(subtotalBeforeTax);
  const totalDiscount = round2(totalItemDiscount + transactionDiscountAmount);
  const totalAmount = round2(subtotal - transactionDiscountAmount + round2(totalTax));

  return {
    subtotal,
    itemDiscountTotal: round2(totalItemDiscount),
    transactionDiscountAmount: round2(transactionDiscountAmount),
    taxAmount: round2(totalTax),
    totalAmount,
    items: calculatedItems,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
