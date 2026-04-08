import jsPDF from 'jspdf';

function formatCurrency(amount: number | string): string {
  return Number(amount).toLocaleString('id-ID');
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('id-ID', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export function generateReceiptPdf(txn: any): void {
  // Narrow receipt: 80mm = ~226pt, but we'll use a custom page
  const pageWidth = 80; // mm
  const doc = new jsPDF({ unit: 'mm', format: [pageWidth, 200] });
  const margin = 4;
  const contentWidth = pageWidth - margin * 2;
  let y = 8;

  function addLine(text: string, options?: { bold?: boolean; align?: 'left' | 'center' | 'right'; size?: number }) {
    const size = options?.size || 8;
    doc.setFontSize(size);
    doc.setFont('helvetica', options?.bold ? 'bold' : 'normal');
    const align = options?.align || 'left';
    const x = align === 'center' ? pageWidth / 2 : align === 'right' ? pageWidth - margin : margin;
    doc.text(text, x, y, { align });
    y += size * 0.45;
  }

  function addDivider() {
    doc.setDrawColor(180);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 2;
  }

  function addRow(left: string, right: string, options?: { bold?: boolean; size?: number }) {
    const size = options?.size || 7;
    doc.setFontSize(size);
    doc.setFont('helvetica', options?.bold ? 'bold' : 'normal');
    doc.text(left, margin, y);
    doc.text(right, pageWidth - margin, y, { align: 'right' });
    y += size * 0.45;
  }

  // Header
  const shopName = txn.location?.name || 'Shop';
  const shopAddress = txn.location?.address || '';
  addLine(shopName, { bold: true, align: 'center', size: 10 });
  if (shopAddress) {
    addLine(shopAddress, { align: 'center', size: 6 });
  }
  y += 1;
  addDivider();

  // Transaction Info
  addRow('Transaction:', txn.transactionId);
  addRow('Date:', formatDate(txn.completedAt || txn.createdAt));
  addRow('Cashier:', txn.cashier?.fullname || txn.cashier?.username || '-');
  addDivider();

  // Items
  const items = txn.items || [];
  for (const item of items) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(item.productName, margin, y);
    y += 3;

    const qty = item.quantity;
    const price = Number(item.unitPrice);
    const total = Number(item.lineTotal);
    const discount = Number(item.discountAmount);

    let detail = `  ${qty} x Rp ${formatCurrency(price)}`;
    if (discount > 0) detail += ` (-${formatCurrency(discount)})`;

    doc.setFontSize(6.5);
    doc.text(detail, margin, y);
    doc.text(`Rp ${formatCurrency(total)}`, pageWidth - margin, y, { align: 'right' });
    y += 3.2;
  }

  addDivider();

  // Totals
  addRow('Subtotal', `Rp ${formatCurrency(txn.subtotal)}`);
  if (Number(txn.discountAmount) > 0) {
    addRow('Discount', `-Rp ${formatCurrency(txn.discountAmount)}`);
  }
  if (Number(txn.taxAmount) > 0) {
    addRow('Tax (PPN)', `Rp ${formatCurrency(txn.taxAmount)}`);
  }
  addRow('TOTAL', `Rp ${formatCurrency(txn.totalAmount)}`, { bold: true, size: 9 });
  addDivider();

  // Payments
  const payments = txn.payments || [];
  if (payments.length > 0) {
    for (const p of payments) {
      const method = String(p.paymentMethod).toUpperCase();
      addRow(method, `Rp ${formatCurrency(p.amount)}`);
      if (p.paymentMethod === 'cash' && p.amountTendered) {
        addRow('  Tendered', `Rp ${formatCurrency(p.amountTendered)}`, { size: 6 });
        const change = Number(p.changeAmount) || 0;
        if (change > 0) {
          addRow('  Change', `Rp ${formatCurrency(change)}`, { size: 6 });
        }
      }
      if (p.paymentRef) {
        addRow('  Ref', p.paymentRef, { size: 6 });
      }
    }
  } else {
    // Legacy single payment
    if (txn.paymentMethod) {
      addRow(String(txn.paymentMethod).toUpperCase(), `Rp ${formatCurrency(txn.totalAmount)}`);
      if (txn.amountTendered) addRow('  Tendered', `Rp ${formatCurrency(txn.amountTendered)}`, { size: 6 });
      if (txn.changeAmount && Number(txn.changeAmount) > 0) addRow('  Change', `Rp ${formatCurrency(txn.changeAmount)}`, { size: 6 });
    }
  }

  addDivider();
  y += 1;

  // Footer
  addLine('Thank you for your purchase!', { align: 'center', size: 7 });
  if (txn.location?.phone) {
    addLine(txn.location.phone, { align: 'center', size: 6 });
  }
  y += 2;
  doc.setFontSize(5);
  doc.setTextColor(150);
  doc.text(`Generated ${new Date().toLocaleString('id-ID')}`, pageWidth / 2, y, { align: 'center' });

  // Resize page to content height
  const pageHeight = y + 5;
  (doc as any).internal.pageSize.height = pageHeight;

  doc.save(`Receipt-${txn.transactionId}.pdf`);
}
