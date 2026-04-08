import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
}

const STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  dispatched: 'Dispatched',
  acknowledged: 'Acknowledged',
  credit_note_received: 'Credit Note Received',
  closed: 'Closed',
  rejected: 'Rejected',
};

const REASON_LABELS: Record<string, string> = {
  defective: 'Defective', damaged: 'Damaged', expired: 'Expired',
  excess: 'Excess Stock', wrong_item: 'Wrong Item',
};

export function generateReturnPdf(sr: any): void {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('SUPPLIER RETURN', 105, 20, { align: 'center' });

  // Return Info (left)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Return Number: ${sr.returnNumber}`, 14, 35);
  doc.text(`GRN Number: ${sr.grn?.grnNumber || '-'}`, 14, 42);
  doc.text(`PO Number: ${sr.purchaseOrder?.poNumber || '-'}`, 14, 49);
  doc.text(`Return Date: ${formatDate(sr.returnDate)}`, 14, 56);
  doc.text(`Status: ${STATUS_LABELS[sr.status] || sr.status}`, 14, 63);

  // Supplier Info (right)
  doc.setFont('helvetica', 'bold');
  doc.text('Supplier:', 120, 35);
  doc.setFont('helvetica', 'normal');
  doc.text(sr.supplier?.name || '-', 120, 42);
  doc.text(`Code: ${sr.supplier?.code || '-'}`, 120, 49);
  if (sr.location?.name) {
    doc.text(`From Location: ${sr.location.name}`, 120, 56);
  }

  doc.setDrawColor(200);
  doc.line(14, 68, 196, 68);

  // Items table
  const tableData = (sr.items || []).map((item: any, i: number) => [
    i + 1,
    item.skuCode,
    item.productName,
    item.returnQuantity,
    item.uom,
    REASON_LABELS[item.reasonCode] || item.reasonCode,
    item.reasonNotes || '-',
  ]);

  autoTable(doc, {
    startY: 73,
    head: [['#', 'SKU', 'Product', 'Qty', 'UOM', 'Reason', 'Notes']],
    body: tableData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [51, 65, 85], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      3: { halign: 'right', cellWidth: 15 },
      4: { cellWidth: 15 },
    },
    theme: 'striped',
  });

  // Credit Notes
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  if ((sr.creditNotes || []).length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Credit Notes', 14, finalY);

    const cnData = sr.creditNotes.map((cn: any, i: number) => [
      i + 1,
      cn.creditNoteNumber,
      Number(cn.amount).toLocaleString('id-ID', { style: 'currency', currency: 'IDR' }),
      formatDate(cn.creditDate),
      cn.isReplacement ? 'Replacement' : 'Credit',
      cn.notes || '-',
    ]);

    autoTable(doc, {
      startY: finalY + 5,
      head: [['#', 'CN Number', 'Amount', 'Date', 'Type', 'Notes']],
      body: cnData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 122, 87], fontStyle: 'bold' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        2: { halign: 'right' },
      },
      theme: 'striped',
    });
  }

  // Notes
  if (sr.notes) {
    const notesY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : finalY;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Notes:', 14, notesY);
    doc.text(sr.notes, 14, notesY + 7, { maxWidth: 180 });
  }

  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150);
  doc.text(`Generated on ${new Date().toLocaleString('id-ID')}`, 14, pageHeight - 10);

  doc.save(`${sr.returnNumber}.pdf`);
}
