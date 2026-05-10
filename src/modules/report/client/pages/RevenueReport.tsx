import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import { Button } from '@client/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@client/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import axios from 'axios';
import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { exportToCsv, exportToXlsx, exportToPdf } from '../lib/exportUtils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

function formatCurrency(v: number | string) { return `Rp ${Math.abs(Number(v)).toLocaleString('id-ID')}`; }

const RevenueReport = () => {
  const [period, setPeriod] = useState('30');
  const [byShop, setByShop] = useState<any[]>([]);
  const [byProduct, setByProduct] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);

  useEffect(() => {
    axios.get(`/api/modules/report/revenue/by-shop?days=${period}`).then(r => setByShop(r.data.byShop || [])).catch(() => {});
    axios.get(`/api/modules/report/revenue/by-product?days=${period}&limit=10`).then(r => setByProduct(r.data.byProduct || [])).catch(() => {});
    axios.get(`/api/modules/report/revenue/trends?days=${period}`).then(r => setTrends(r.data.trends || [])).catch(() => {});
  }, [period]);

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <h1 className="text-2xl font-semibold">Revenue Report</h1>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8"><Download className="w-4 h-4 mr-1" />Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportToCsv(`revenue-by-shop-${period}d`, ['Location', 'Revenue (IDR)', 'Transactions', 'Avg Basket (IDR)'], byShop.map(s => [s.location_name, s.revenue, s.transaction_count, s.avg_basket]))}>Export CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToXlsx(`revenue-by-shop-${period}d`, 'Revenue by Shop', ['Location', 'Revenue (IDR)', 'Transactions', 'Avg Basket (IDR)'], byShop.map(s => [s.location_name, s.revenue, s.transaction_count, s.avg_basket]))}>Export Excel (XLSX)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToPdf(`revenue-by-shop-${period}d`, `Revenue by Shop — Last ${period} days`, ['Location', 'Revenue (IDR)', 'Transactions', 'Avg Basket (IDR)'], byShop.map(s => [s.location_name, s.revenue, s.transaction_count, s.avg_basket]))}>Export PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2">

          {/* Trend Chart */}
          <div className="bg-card rounded-lg border p-4">
            <h3 className="font-medium mb-3">Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trends.map((r: any) => ({ date: r.date?.substring(5, 10), revenue: Number(r.revenue) }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => formatCurrency(v)} />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* By Shop */}
            <div className="bg-card rounded-lg border">
              <div className="p-4 border-b"><h3 className="font-medium">Revenue by Shop</h3></div>
              <Table>
                <TableHeader className="bg-muted/20"><TableRow>
                  <TableHead>Location</TableHead><TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Transactions</TableHead><TableHead className="text-right">Avg Basket</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {byShop.map((s: any) => (
                    <TableRow key={s.location_id}>
                      <TableCell className="font-medium">{s.location_name}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(s.revenue)}</TableCell>
                      <TableCell className="text-right">{s.transaction_count}</TableCell>
                      <TableCell className="text-right">{formatCurrency(s.avg_basket)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Top Products */}
            <div className="bg-card rounded-lg border">
              <div className="p-4 border-b"><h3 className="font-medium">Top Selling Products</h3></div>
              <Table>
                <TableHeader className="bg-muted/20"><TableRow>
                  <TableHead className="w-[50px] text-center">#</TableHead>
                  <TableHead>Product</TableHead><TableHead className="text-right">Qty Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {byProduct.map((p: any, i: number) => (
                    <TableRow key={p.product_id}>
                      <TableCell className="text-center">{i + 1}</TableCell>
                      <TableCell className="font-medium">{p.product_name}<br /><span className="text-xs text-muted-foreground">{p.sku_code}</span></TableCell>
                      <TableCell className="text-right">{Number(p.total_qty)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(p.total_revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(RevenueReport, { moduleId: 'report', moduleName: 'Reports & Analytics' });
