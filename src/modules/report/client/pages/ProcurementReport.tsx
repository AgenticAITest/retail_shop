import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import { Button } from '@client/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@client/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import axios from 'axios';
import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { exportToCsv, exportToXlsx, exportToPdf } from '../lib/exportUtils';

function fmt(v: number | string) { return `Rp ${Math.abs(Number(v)).toLocaleString('id-ID')}`; }

const ProcurementReport = () => {
  const [poSummary, setPoSummary] = useState<any[]>([]);
  const [scorecard, setScorecard] = useState<any[]>([]);
  const [timeliness, setTimeliness] = useState<any[]>([]);

  useEffect(() => {
    axios.get('/api/modules/report/procurement/po-summary').then(r => setPoSummary(r.data.poSummary || [])).catch(() => {});
    axios.get('/api/modules/report/procurement/supplier-scorecard').then(r => setScorecard(r.data.scorecard || [])).catch(() => {});
    axios.get('/api/modules/report/procurement/grn-timeliness').then(r => setTimeliness(r.data.timeliness || [])).catch(() => {});
  }, []);

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <h1 className="text-2xl font-semibold">Procurement Report</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8"><Download className="w-4 h-4 mr-1" />Export</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportToCsv('procurement-supplier-scorecard', ['Supplier', 'Total POs', 'Completed', 'Returns'], scorecard.map(s => [s.supplier_name, s.total_pos, s.completed_pos, s.total_returns]))}>Export CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportToXlsx('procurement-supplier-scorecard', 'Supplier Scorecard', ['Supplier', 'Total POs', 'Completed', 'Returns'], scorecard.map(s => [s.supplier_name, s.total_pos, s.completed_pos, s.total_returns]))}>Export Excel (XLSX)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportToPdf('procurement-supplier-scorecard', 'Procurement Report — Supplier Scorecard', ['Supplier', 'Total POs', 'Completed', 'Returns'], scorecard.map(s => [s.supplier_name, s.total_pos, s.completed_pos, s.total_returns]))}>Export PDF</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div className="@container/main flex flex-1 flex-col gap-2"><div className="flex flex-col gap-4 px-2 py-2">
        {/* PO Summary */}
        <div className="bg-card rounded-lg border"><div className="p-4 border-b"><h3 className="font-medium">PO Status Summary</h3></div>
          <Table><TableHeader className="bg-muted/20"><TableRow><TableHead>Status</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
            <TableBody>{poSummary.map((p: any) => (<TableRow key={p.status}><TableCell className="capitalize font-medium">{p.status?.replace(/_/g, ' ')}</TableCell><TableCell className="text-right">{Number(p.count)}</TableCell><TableCell className="text-right font-bold">{fmt(p.total_value)}</TableCell></TableRow>))}</TableBody></Table></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Supplier Scorecard */}
          <div className="bg-card rounded-lg border"><div className="p-4 border-b"><h3 className="font-medium">Supplier Scorecard</h3></div>
            <Table><TableHeader className="bg-muted/20"><TableRow><TableHead>Supplier</TableHead><TableHead className="text-right">Total POs</TableHead><TableHead className="text-right">Completed</TableHead><TableHead className="text-right">Returns</TableHead></TableRow></TableHeader>
              <TableBody>{scorecard.map((s: any) => (<TableRow key={s.supplier_id}><TableCell className="font-medium">{s.supplier_name}</TableCell><TableCell className="text-right">{Number(s.total_pos)}</TableCell><TableCell className="text-right text-green-600">{Number(s.completed_pos)}</TableCell><TableCell className="text-right text-red-600">{Number(s.total_returns)}</TableCell></TableRow>))}</TableBody></Table></div>
          {/* GRN Timeliness */}
          <div className="bg-card rounded-lg border"><div className="p-4 border-b"><h3 className="font-medium">GRN Timeliness (Avg Days)</h3></div>
            <Table><TableHeader className="bg-muted/20"><TableRow><TableHead>Supplier</TableHead><TableHead className="text-right">GRNs</TableHead><TableHead className="text-right">Avg Days</TableHead></TableRow></TableHeader>
              <TableBody>{timeliness.map((t: any, i: number) => (<TableRow key={i}><TableCell className="font-medium">{t.supplier_name}</TableCell><TableCell className="text-right">{Number(t.grn_count)}</TableCell><TableCell className="text-right font-bold">{t.avg_days ?? '-'}</TableCell></TableRow>))}</TableBody></Table></div>
        </div>
      </div></div>
    </>
  );
};
export default withModuleAuthorization(ProcurementReport, { moduleId: 'report', moduleName: 'Reports & Analytics' });
