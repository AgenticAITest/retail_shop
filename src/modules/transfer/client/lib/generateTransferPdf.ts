import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatDate(d: string | null) { return d ? new Date(d).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'; }

const STATUS_LABELS: Record<string, string> = {
  requested: 'Requested', pending_approval: 'Pending Approval', approved: 'Approved',
  picking: 'Picking', dispatched: 'Dispatched', received: 'Received', closed: 'Closed',
};

export function generateTransferPdf(t: any): void {
  const doc = new jsPDF();

  doc.setFontSize(20); doc.setFont('helvetica', 'bold');
  doc.text('INTER-SHOP TRANSFER', 105, 20, { align: 'center' });

  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(`Transfer #: ${t.transferNumber}`, 14, 35);
  doc.text(`Status: ${STATUS_LABELS[t.status] || t.status}`, 14, 42);
  doc.text(`Date: ${formatDate(t.createdAt)}`, 14, 49);

  doc.setFont('helvetica', 'bold'); doc.text('From:', 14, 60); doc.text('To:', 120, 60);
  doc.setFont('helvetica', 'normal');
  doc.text(t.sourceLocation?.name || '-', 14, 67);
  doc.text(t.destLocation?.name || '-', 120, 67);

  doc.text(`Requested By: ${t.requestedByUser?.fullname || '-'}`, 14, 78);
  if (t.approvedByUser) doc.text(`Approved By: ${t.approvedByUser.fullname}`, 120, 78);

  doc.setDrawColor(200); doc.line(14, 83, 196, 83);

  const tableData = (t.items || []).map((item: any, i: number) => [
    i + 1, item.skuCode, item.productName, item.requestedQty,
    item.pickedQty || '-', item.receivedQty || '-',
    item.discrepancyQty || '-', item.discrepancyReason || '-',
  ]);

  autoTable(doc, {
    startY: 88,
    head: [['#', 'SKU', 'Product', 'Requested', 'Picked', 'Received', 'Discrepancy', 'Reason']],
    body: tableData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [51, 65, 85] },
    columnStyles: { 0: { halign: 'center', cellWidth: 8 }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
    theme: 'striped',
  });

  if (t.notes) {
    const y = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(9); doc.text('Notes:', 14, y); doc.text(t.notes, 14, y + 7, { maxWidth: 180 });
  }

  const ph = doc.internal.pageSize.height;
  doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(150);
  doc.text(`Generated on ${new Date().toLocaleString('id-ID')}`, 14, ph - 10);

  doc.save(`${t.transferNumber}.pdf`);
}
