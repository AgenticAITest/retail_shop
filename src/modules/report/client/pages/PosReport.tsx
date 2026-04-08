import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function fmt(v: number | string) { return `Rp ${Math.abs(Number(v)).toLocaleString('id-ID')}`; }
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'; }

const PosReport = () => {
  const [period, setPeriod] = useState('30');
  const [shifts, setShifts] = useState<any[]>([]);
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [hourly, setHourly] = useState<any[]>([]);
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [voids, setVoids] = useState<any[]>([]);

  useEffect(() => {
    const p = `?days=${period}`;
    axios.get(`/api/modules/report/pos/shift-summary${p}`).then(r => setShifts(r.data.shifts || [])).catch(() => {});
    axios.get(`/api/modules/report/pos/payment-breakdown${p}`).then(r => setBreakdown(r.data.breakdown || [])).catch(() => {});
    axios.get(`/api/modules/report/pos/hourly${p}`).then(r => setHourly(r.data.hourly || [])).catch(() => {});
    axios.get(`/api/modules/report/pos/cashier-performance${p}`).then(r => setCashiers(r.data.cashiers || [])).catch(() => {});
    axios.get(`/api/modules/report/pos/voids${p}`).then(r => setVoids(r.data.voids || [])).catch(() => {});
  }, [period]);

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <h1 className="text-2xl font-semibold">POS Report</h1>
        <Select value={period} onValueChange={setPeriod}><SelectTrigger className="w-[150px] h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem></SelectContent></Select>
      </header>
      <div className="@container/main flex flex-1 flex-col gap-2"><div className="flex flex-col gap-4 px-2 py-2">
        {/* Hourly Chart */}
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-medium mb-3">Hourly Sales Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourly.map((h: any) => ({ hour: `${h.hour}:00`, revenue: Number(h.revenue) }))}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="hour" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: any) => fmt(v)} /><Bar dataKey="revenue" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Payment Breakdown */}
          <div className="bg-card rounded-lg border"><div className="p-4 border-b"><h3 className="font-medium">Payment Method Breakdown</h3></div>
            <Table><TableHeader className="bg-muted/20"><TableRow><TableHead>Method</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>{breakdown.map((b: any) => (<TableRow key={b.payment_method}><TableCell className="capitalize font-medium">{b.payment_method}</TableCell><TableCell className="text-right">{Number(b.count)}</TableCell><TableCell className="text-right font-bold">{fmt(b.total)}</TableCell></TableRow>))}</TableBody></Table></div>
          {/* Cashier Performance */}
          <div className="bg-card rounded-lg border"><div className="p-4 border-b"><h3 className="font-medium">Cashier Performance</h3></div>
            <Table><TableHeader className="bg-muted/20"><TableRow><TableHead>Cashier</TableHead><TableHead className="text-right">Txns</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Avg Basket</TableHead></TableRow></TableHeader>
              <TableBody>{cashiers.map((c: any) => (<TableRow key={c.cashier_id}><TableCell className="font-medium">{c.cashier_name}</TableCell><TableCell className="text-right">{Number(c.transactions)}</TableCell><TableCell className="text-right font-bold">{fmt(c.revenue)}</TableCell><TableCell className="text-right">{fmt(c.avg_basket)}</TableCell></TableRow>))}</TableBody></Table></div>
        </div>
        {/* Voids */}
        <div className="bg-card rounded-lg border"><div className="p-4 border-b"><h3 className="font-medium">Voided Transactions</h3></div>
          <Table><TableHeader className="bg-muted/20"><TableRow><TableHead>Transaction</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Reason</TableHead><TableHead>Voided By</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
            <TableBody>{voids.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No voided transactions.</TableCell></TableRow>}
              {voids.map((v: any, i: number) => (<TableRow key={i}><TableCell className="font-mono text-xs">{v.transaction_id}</TableCell><TableCell className="text-right">{fmt(v.total_amount)}</TableCell><TableCell>{v.void_reason || '-'}</TableCell><TableCell>{v.voided_by_name || '-'}</TableCell><TableCell className="text-sm">{fmtDate(v.voided_at)}</TableCell></TableRow>))}</TableBody></Table></div>
      </div></div>
    </>
  );
};
export default withModuleAuthorization(PosReport, { moduleId: 'report', moduleName: 'Reports & Analytics' });
