/**
 * Receipt Template Builder
 *
 * Takes transaction data and generates ESC/POS byte commands
 * for thermal printing using the EscPosBuilder.
 */

import { EscPosBuilder, type PaperWidth, PAPER_WIDTHS } from './escpos';

interface ReceiptLocation {
  name: string;
  address?: string;
  phone?: string;
}

interface ReceiptItem {
  productName: string;
  quantity: number;
  unitPrice: string | number;
  discountAmount: string | number;
  lineTotal: string | number;
}

interface ReceiptPayment {
  paymentMethod: string;
  amount: string | number;
  amountTendered?: string | number | null;
  changeAmount?: string | number | null;
  paymentRef?: string | null;
}

interface ReceiptData {
  transactionId: string;
  completedAt?: string | null;
  createdAt: string;
  cashier?: { fullname?: string; username?: string } | null;
  location?: ReceiptLocation | null;
  items: ReceiptItem[];
  payments?: ReceiptPayment[];
  subtotal: string | number;
  discountAmount: string | number;
  taxAmount: string | number;
  totalAmount: string | number;
  // Legacy single-payment fields
  paymentMethod?: string | null;
  amountTendered?: string | number | null;
  changeAmount?: string | number | null;
}

function formatCurrency(amount: string | number): string {
  return Number(amount).toLocaleString('id-ID');
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('id-ID', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Build a thermal receipt as ESC/POS byte commands
 */
export function buildReceiptCommands(
  data: ReceiptData,
  paperWidth: PaperWidth = '80mm',
): Uint8Array {
  const w = PAPER_WIDTHS[paperWidth].chars;
  const b = new EscPosBuilder();

  b.initialize();

  // === Header ===
  b.align('center');
  b.bold(true).doubleHeight(true);
  b.line(data.location?.name || 'SHOP');
  b.doubleHeight(false).bold(false);

  if (data.location?.address) {
    b.line(data.location.address);
  }
  if (data.location?.phone) {
    b.line(data.location.phone);
  }

  b.align('left');
  b.separator('=', w);

  // === Transaction Info ===
  b.leftRight('Txn:', data.transactionId, w);
  b.leftRight('Date:', formatDate(data.completedAt || data.createdAt), w);
  b.leftRight('Cashier:', data.cashier?.fullname || data.cashier?.username || '-', w);
  b.separator('-', w);

  // === Items ===
  for (const item of data.items) {
    const qty = item.quantity;
    const price = Number(item.unitPrice);
    const total = Number(item.lineTotal);
    const discount = Number(item.discountAmount);

    // Product name (may wrap)
    b.line(item.productName);

    // Qty x Price = Total
    let detail = `  ${qty} x ${formatCurrency(price)}`;
    if (discount > 0) {
      detail += ` (-${formatCurrency(discount)})`;
    }
    b.leftRight(detail, `Rp ${formatCurrency(total)}`, w);
  }

  b.separator('-', w);

  // === Totals ===
  b.leftRight('Subtotal', `Rp ${formatCurrency(data.subtotal)}`, w);

  if (Number(data.discountAmount) > 0) {
    b.leftRight('Discount', `-Rp ${formatCurrency(data.discountAmount)}`, w);
  }

  if (Number(data.taxAmount) > 0) {
    b.leftRight('Tax (PPN)', `Rp ${formatCurrency(data.taxAmount)}`, w);
  }

  b.separator('=', w);
  b.bold(true).large(true);
  b.align('right');
  b.line(`Rp ${formatCurrency(data.totalAmount)}`);
  b.large(false).bold(false);
  b.align('left');
  b.separator('-', w);

  // === Payments ===
  const payments = data.payments || [];
  if (payments.length > 0) {
    for (const p of payments) {
      const method = String(p.paymentMethod).toUpperCase();
      b.leftRight(method, `Rp ${formatCurrency(p.amount)}`, w);

      if (p.paymentMethod === 'cash' && p.amountTendered) {
        b.leftRight('  Tendered', `Rp ${formatCurrency(p.amountTendered)}`, w);
        const change = Number(p.changeAmount) || 0;
        if (change > 0) {
          b.bold(true);
          b.leftRight('  CHANGE', `Rp ${formatCurrency(change)}`, w);
          b.bold(false);
        }
      }
      if (p.paymentRef) {
        b.leftRight('  Ref', p.paymentRef, w);
      }
    }
  } else if (data.paymentMethod) {
    // Legacy single payment
    b.leftRight(String(data.paymentMethod).toUpperCase(), `Rp ${formatCurrency(data.totalAmount)}`, w);
    if (data.amountTendered) {
      b.leftRight('  Tendered', `Rp ${formatCurrency(data.amountTendered)}`, w);
    }
    if (data.changeAmount && Number(data.changeAmount) > 0) {
      b.bold(true);
      b.leftRight('  CHANGE', `Rp ${formatCurrency(data.changeAmount)}`, w);
      b.bold(false);
    }
  }

  b.separator('-', w);
  b.lineFeed();

  // === Footer ===
  b.align('center');
  b.line('Thank you for your purchase!');
  if (data.location?.phone) {
    b.line(data.location.phone);
  }
  b.lineFeed();

  // === Barcode (transaction ID) ===
  b.barcode(data.transactionId);

  // === Cut ===
  b.cut();

  return b.build();
}
