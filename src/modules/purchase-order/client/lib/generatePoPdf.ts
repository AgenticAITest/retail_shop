import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatIDR(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  sent: 'Sent to Supplier',
  partially_received: 'Partially Received',
  fully_received: 'Fully Received',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export function generatePoPdf(po: any): void {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('PURCHASE ORDER', 105, 20, { align: 'center' });

  // PO Info (left side)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`PO Number: ${po.poNumber}`, 14, 35);
  doc.text(`Date: ${formatDate(po.orderDate)}`, 14, 42);
  doc.text(`Expected Delivery: ${formatDate(po.expectedDeliveryDate)}`, 14, 49);
  doc.text(`Status: ${STATUS_LABELS[po.status] || po.status}`, 14, 56);
  doc.text(`Version: v${po.version}`, 14, 63);

  // Supplier Info (right side)
  doc.setFont('helvetica', 'bold');
  doc.text('Supplier:', 120, 35);
  doc.setFont('helvetica', 'normal');
  doc.text(po.supplier?.name || '-', 120, 42);
  doc.text(po.supplier?.address || '', 120, 49, { maxWidth: 70 });
  if (po.supplier?.npwp) {
    doc.text(`NPWP: ${po.supplier.npwp}`, 120, 56);
  }

  // Delivery location
  if (po.location?.name) {
    doc.text(`Deliver to: ${po.location.name}`, 14, 70);
  }

  // Line separator
  doc.setDrawColor(200);
  doc.line(14, 75, 196, 75);

  // Items table
  const tableData = (po.items || []).map((item: any, i: number) => [
    i + 1,
    item.skuCode,
    item.productName,
    item.quantity,
    item.uom,
    formatIDR(item.unitPrice),
    `${item.discountPercent}%`,
    formatIDR(item.taxAmount),
    formatIDR(item.lineTotal),
  ]);

  autoTable(doc, {
    startY: 80,
    head: [['#', 'SKU', 'Product', 'Qty', 'UOM', 'Unit Price', 'Disc%', 'Tax', 'Line Total']],
    body: tableData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [51, 65, 85], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 22 },
      2: { cellWidth: 45 },
      3: { halign: 'right', cellWidth: 15 },
      4: { halign: 'center', cellWidth: 15 },
      5: { halign: 'right', cellWidth: 25 },
      6: { halign: 'right', cellWidth: 15 },
      7: { halign: 'right', cellWidth: 22 },
      8: { halign: 'right', cellWidth: 25 },
    },
    theme: 'striped',
  });

  // Totals
  const finalY = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(9);
  doc.text('Subtotal:', 145, finalY);
  doc.text(formatIDR(po.subtotal), 196, finalY, { align: 'right' });

  doc.text('Discount:', 145, finalY + 7);
  doc.text(`-${formatIDR(po.discountAmount)}`, 196, finalY + 7, { align: 'right' });

  doc.text(`Tax (PPN ${po.taxRatePercent || '0'}%):`, 145, finalY + 14);
  doc.text(formatIDR(po.taxAmount), 196, finalY + 14, { align: 'right' });

  doc.setDrawColor(100);
  doc.line(145, finalY + 18, 196, finalY + 18);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', 145, finalY + 25);
  doc.text(formatIDR(po.totalAmount), 196, finalY + 25, { align: 'right' });

  // Notes
  if (po.notes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Notes:', 14, finalY + 10);
    doc.text(po.notes, 14, finalY + 17, { maxWidth: 100 });
  }

  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150);
  doc.text(`Generated on ${new Date().toLocaleString('id-ID')}`, 14, pageHeight - 10);

  // Save
  doc.save(`${po.poNumber}.pdf`);
}
