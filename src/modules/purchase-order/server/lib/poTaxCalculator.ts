export interface TaxConfigInput {
  ratePercent: string | number;
  calcMode: 'inclusive' | 'exclusive';
}

export interface LineItemInput {
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
}

export interface CalculatedLineItem extends LineItemInput {
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface CalculationResult {
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  items: CalculatedLineItem[];
}

export function calculatePoTotals(
  items: LineItemInput[],
  taxConfig: TaxConfigInput | null
): CalculationResult {
  const taxRate = taxConfig ? parseFloat(String(taxConfig.ratePercent)) / 100 : 0;
  const calcMode = taxConfig?.calcMode || 'exclusive';

  let subtotal = 0;
  let totalTax = 0;
  let totalDiscount = 0;

  const calculatedItems: CalculatedLineItem[] = items.map((item) => {
    const grossAmount = item.quantity * item.unitPrice;
    const discountPct = item.discountPercent || 0;
    const discountAmount = round2(grossAmount * (discountPct / 100));
    const afterDiscount = grossAmount - discountAmount;

    let taxAmount: number;
    let lineTotal: number;

    if (calcMode === 'inclusive') {
      // Tax is included in the unit price
      taxAmount = round2(afterDiscount - afterDiscount / (1 + taxRate));
      lineTotal = round2(afterDiscount);
    } else {
      // Tax is added on top
      taxAmount = round2(afterDiscount * taxRate);
      lineTotal = round2(afterDiscount + taxAmount);
    }

    subtotal += afterDiscount;
    totalTax += taxAmount;
    totalDiscount += discountAmount;

    return {
      ...item,
      discountAmount,
      taxAmount,
      lineTotal,
    };
  });

  // For exclusive mode, subtotal is before tax
  // For inclusive mode, subtotal includes tax (so we subtract tax for display)
  const displaySubtotal = calcMode === 'inclusive'
    ? round2(subtotal - totalTax)
    : round2(subtotal);

  return {
    subtotal: displaySubtotal,
    taxAmount: round2(totalTax),
    discountAmount: round2(totalDiscount),
    totalAmount: round2(displaySubtotal + round2(totalTax)),
    items: calculatedItems,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
