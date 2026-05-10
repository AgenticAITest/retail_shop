import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export function exportToCsv(filename: string, headers: string[], rows: (string | number | null)[][]): void {
  const csvLines = [
    headers.join(','),
    ...rows.map(row =>
      row.map(cell => {
        const val = cell == null ? '' : String(cell);
        return val.includes(',') || val.includes('"') || val.includes('\n')
          ? `"${val.replace(/"/g, '""')}"`
          : val;
      }).join(',')
    ),
  ];
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportToXlsx(filename: string, sheetName: string, headers: string[], rows: (string | number | null)[][]): void {
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToPdf(filename: string, title: string, headers: string[], rows: (string | number | null)[][]): void {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 105, 18, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text(`Generated: ${new Date().toLocaleString('id-ID')}`, 105, 25, { align: 'center' });
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 32,
    head: [headers],
    body: rows.map(r => r.map(c => (c == null ? '' : String(c)))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [51, 65, 85], fontStyle: 'bold' },
    theme: 'striped',
  });

  doc.save(`${filename}.pdf`);
}
