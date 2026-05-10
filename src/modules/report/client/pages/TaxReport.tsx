import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import { Button } from '@client/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@client/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import axios from 'axios';
import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { exportToCsv, exportToXlsx, exportToPdf } from '../lib/exportUtils';

function fmt(v: number | string) { return `Rp ${Math.abs(Number(v)).toLocaleString('id-ID')}`; }

const TaxReport = () => {
  const [period, setPeriod] = useState('30');
  const [summary, setSummary] = useState<any>(null);
  const [byLocation, setByLocation] = useState<any[]>([]);
  const [byCategory, setByCategory] = useState<any[]>([]);

  useEffect(() => {
    const p = `?days=${period}`;
    axios.get(`/api/modules/report/tax/summary${p}`).then(r => setSummary(r.data)).catch(() => {});
    axios.get(`/api/modules/report/tax/by-location${p}`).then(r => setByLocation(r.data.byLocation || [])).catch(() => {});
    axios.get(`/api/modules/report/tax/by-category${p}`).then(r => setByCategory(r.data.byCategory || [])).catch(() => {});
  }, [period]);

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <h1 className="text-2xl font-semibold">Tax (PPN) Report</h1>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}><SelectTrigger className="w-[150px] h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem></SelectContent></Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8"><Download className="w-4 h-4 mr-1" />Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportToCsv(`tax-by-location-${period}d`, ['Location', 'PPN Collected (IDR)', 'Revenue (IDR)'], byLocation.map(l => [l.location_name, l.ppn, l.revenue]))}>Export CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToXlsx(`tax-by-location-${period}d`, 'PPN by Location', ['Location', 'PPN Collected (IDR)', 'Revenue (IDR)'], byLocation.map(l => [l.location_name, l.ppn, l.revenue]))}>Export Excel (XLSX)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToPdf(`tax-by-location-${period}d`, `Tax (PPN) Report — Last ${period} days`, ['Location', 'PPN Collected (IDR)', 'Revenue (IDR)'], byLocation.map(l => [l.location_name, l.ppn, l.revenue]))}>Export PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <div className="@container/main flex flex-1 flex-col gap-2"><div className="flex flex-col gap-4 px-2 py-2">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card rounded-lg border p-4 text-center"><p className="text-sm text-muted-foreground">Total PPN Collected</p><p className="text-2xl font-bold">{fmt(summary.totalPPN)}</p></div>
            <div className="bg-card rounded-lg border p-4 text-center"><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-2xl font-bold">{fmt(summary.totalRevenue)}</p></div>
            <div className="bg-card rounded-lg border p-4 text-center"><p className="text-sm text-muted-foreground">Transactions</p><p className="text-2xl font-bold">{summary.transactionCount}</p></div>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* By Location */}
          <div className="bg-card rounded-lg border"><div className="p-4 border-b"><h3 className="font-medium">PPN by Location</h3></div>
            <Table><TableHeader className="bg-muted/20"><TableRow><TableHead>Location</TableHead><TableHead className="text-right">PPN</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
              <TableBody>{byLocation.map((l: any, i: number) => (<TableRow key={i}><TableCell className="font-medium">{l.location_name}</TableCell><TableCell className="text-right font-bold">{fmt(l.ppn)}</TableCell><TableCell className="text-right">{fmt(l.revenue)}</TableCell></TableRow>))}</TableBody></Table></div>
          {/* By Category */}
          <div className="bg-card rounded-lg border"><div className="p-4 border-b"><h3 className="font-medium">PPN by Category</h3></div>
            <Table><TableHeader className="bg-muted/20"><TableRow><TableHead>Category</TableHead><TableHead className="text-right">PPN</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
              <TableBody>{byCategory.map((c: any, i: number) => (<TableRow key={i}><TableCell className="font-medium">{c.category_name}</TableCell><TableCell className="text-right font-bold">{fmt(c.ppn)}</TableCell><TableCell className="text-right">{fmt(c.revenue)}</TableCell></TableRow>))}</TableBody></Table></div>
        </div>
      </div></div>
    </>
  );
};
export default withModuleAuthorization(TaxReport, { moduleId: 'report', moduleName: 'Reports & Analytics' });
