import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  quality_inspection: 'Quality Inspection',
  accepted: 'Accepted',
  stock_updated: 'Stock Updated',
};

export function generateGrnPdf(grn: any): void {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('GOODS RECEIVED NOTE', 105, 20, { align: 'center' });

  // GRN Info (left)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`GRN Number: ${grn.grnNumber}`, 14, 35);
  doc.text(`PO Number: ${grn.purchaseOrder?.poNumber || '-'}`, 14, 42);
  doc.text(`Received Date: ${formatDate(grn.receivedDate)}`, 14, 49);
  doc.text(`Status: ${STATUS_LABELS[grn.status] || grn.status}`, 14, 56);

  // Supplier Info (right)
  doc.setFont('helvetica', 'bold');
  doc.text('Supplier:', 120, 35);
  doc.setFont('helvetica', 'normal');
  doc.text(grn.purchaseOrder?.supplier?.name || '-', 120, 42);
  if (grn.purchaseOrder?.supplier?.address) {
    doc.text(grn.purchaseOrder.supplier.address, 120, 49, { maxWidth: 70 });
  }

  // References
  doc.text(`Delivery Note: ${grn.deliveryNoteRef || '-'}`, 14, 66);
  doc.text(`Invoice Ref: ${grn.invoiceRef || '-'}`, 14, 73);
  if (grn.location?.name) {
    doc.text(`Location: ${grn.location.name}`, 120, 66);
  }

  doc.setDrawColor(200);
  doc.line(14, 78, 196, 78);

  // Items table
  const tableData = (grn.items || []).map((item: any, i: number) => [
    i + 1,
    item.skuCode,
    item.productName,
    item.orderedQuantity,
    item.previouslyReceivedQuantity,
    item.receivedQuantity,
    item.acceptedQuantity,
    item.rejectedQuantity || 0,
    item.rejectionReasonCode || '-',
    item.batchNumber || '-',
    item.expiryDate ? formatDate(item.expiryDate) : '-',
  ]);

  autoTable(doc, {
    startY: 83,
    head: [['#', 'SKU', 'Product', 'Ordered', 'Prev Rcvd', 'Received', 'Accepted', 'Rejected', 'Reason', 'Batch', 'Expiry']],
    body: tableData,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [51, 65, 85], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
    },
    theme: 'striped',
  });

  // Quality inspection
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  if (grn.qualityCheckPassed !== null && grn.qualityCheckPassed !== undefined) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Quality Inspection:', 14, finalY);
    doc.setFont('helvetica', 'normal');
    doc.text(`Result: ${grn.qualityCheckPassed ? 'PASSED' : 'FAILED'}`, 14, finalY + 7);
    if (grn.qualityNotes) {
      doc.text(`Notes: ${grn.qualityNotes}`, 14, finalY + 14, { maxWidth: 180 });
    }
  }

  // Notes
  if (grn.notes) {
    const notesY = grn.qualityCheckPassed !== null ? finalY + 24 : finalY;
    doc.setFontSize(9);
    doc.text('Notes:', 14, notesY);
    doc.text(grn.notes, 14, notesY + 7, { maxWidth: 180 });
  }

  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150);
  doc.text(`Generated on ${new Date().toLocaleString('id-ID')}`, 14, pageHeight - 10);

  doc.save(`${grn.grnNumber}.pdf`);
}
