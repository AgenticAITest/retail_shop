import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import { Button } from '@client/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@client/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import axios from 'axios';
import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { exportToCsv, exportToXlsx, exportToPdf } from '../lib/exportUtils';

const TransferReport = () => {
  const [volume, setVolume] = useState<any[]>([]);
  const [discrepancies, setDiscrepancies] = useState<any[]>([]);

  useEffect(() => {
    axios.get('/api/modules/report/transfer/volume').then(r => setVolume(r.data.volume || [])).catch(() => {});
    axios.get('/api/modules/report/transfer/discrepancy').then(r => setDiscrepancies(r.data.discrepancies || [])).catch(() => {});
  }, []);

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <h1 className="text-2xl font-semibold">Transfer Report</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8"><Download className="w-4 h-4 mr-1" />Export</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportToCsv('transfer-volume', ['From', 'To', 'Transfers', 'Total Qty'], volume.map(v => [v.source_name, v.dest_name, v.transfer_count, v.total_qty]))}>Export CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportToXlsx('transfer-volume', 'Transfer Volume', ['From', 'To', 'Transfers', 'Total Qty'], volume.map(v => [v.source_name, v.dest_name, v.transfer_count, v.total_qty]))}>Export Excel (XLSX)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportToPdf('transfer-volume', 'Transfer Report — Volume by Location Pair', ['From', 'To', 'Transfers', 'Total Qty'], volume.map(v => [v.source_name, v.dest_name, v.transfer_count, v.total_qty]))}>Export PDF</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div className="@container/main flex flex-1 flex-col gap-2"><div className="flex flex-col gap-4 px-2 py-2">
        {/* Volume */}
        <div className="bg-card rounded-lg border"><div className="p-4 border-b"><h3 className="font-medium">Transfer Volume Between Locations</h3></div>
          <Table><TableHeader className="bg-muted/20"><TableRow><TableHead>From</TableHead><TableHead>To</TableHead><TableHead className="text-right">Transfers</TableHead><TableHead className="text-right">Total Qty</TableHead></TableRow></TableHeader>
            <TableBody>{volume.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No transfer data.</TableCell></TableRow>}
              {volume.map((v: any, i: number) => (<TableRow key={i}><TableCell className="font-medium">{v.source_name}</TableCell><TableCell>{v.dest_name}</TableCell><TableCell className="text-right">{Number(v.transfer_count)}</TableCell><TableCell className="text-right font-bold">{Number(v.total_qty)}</TableCell></TableRow>))}</TableBody></Table></div>
        {/* Discrepancies */}
        <div className="bg-card rounded-lg border"><div className="p-4 border-b"><h3 className="font-medium">Transfer Discrepancy Summary</h3></div>
          <Table><TableHeader className="bg-muted/20"><TableRow><TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">Lines</TableHead><TableHead className="text-right">Total Discrepancy</TableHead><TableHead className="text-right">Short</TableHead><TableHead className="text-right">Damaged</TableHead></TableRow></TableHeader>
            <TableBody>{discrepancies.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">No discrepancies recorded.</TableCell></TableRow>}
              {discrepancies.map((d: any, i: number) => (<TableRow key={i}><TableCell className="font-medium">{d.product_name}</TableCell><TableCell className="text-muted-foreground">{d.sku_code}</TableCell><TableCell className="text-right">{Number(d.line_count)}</TableCell><TableCell className="text-right font-bold text-red-600">{Number(d.total_discrepancy)}</TableCell><TableCell className="text-right">{Number(d.short_qty)}</TableCell><TableCell className="text-right">{Number(d.damaged_qty)}</TableCell></TableRow>))}</TableBody></Table></div>
      </div></div>
    </>
  );
};
export default withModuleAuthorization(TransferReport, { moduleId: 'report', moduleName: 'Reports & Analytics' });
