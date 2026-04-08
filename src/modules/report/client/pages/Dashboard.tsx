import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import { Button } from '@client/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import axios from 'axios';
import { BarChart3, DollarSign, Package, ShoppingCart, ArrowRightLeft, AlertTriangle, Warehouse, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

function formatCurrency(v: number) { return `Rp ${Math.abs(v).toLocaleString('id-ID')}`; }
function formatDate(d: string) { return new Date(d).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' }); }

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

const ReportDashboard = () => {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [invByLocation, setInvByLocation] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get('/api/modules/report/dashboard/kpis').then(r => setKpis(r.data)).catch(() => {}),
      axios.get('/api/modules/report/dashboard/revenue-chart').then(r => setChartData(r.data.chartData || [])).catch(() => {}),
      axios.get('/api/modules/report/inventory/by-location').then(r => setInvByLocation(r.data.byLocation || [])).catch(() => {}),
      axios.get('/api/modules/report/dashboard/activity').then(r => setActivity(r.data.activity || [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  const kpiCards = [
    { label: 'Revenue Today', value: formatCurrency(kpis?.totalRevenueToday || 0), icon: DollarSign, color: 'text-green-600' },
    { label: 'Revenue MTD', value: formatCurrency(kpis?.totalRevenueMTD || 0), icon: BarChart3, color: 'text-blue-600' },
    { label: 'Inventory Value', value: formatCurrency(kpis?.totalInventoryValue || 0), icon: Warehouse, color: 'text-purple-600' },
    { label: 'Pending Approvals', value: String(kpis?.pendingApprovals || 0), icon: ShoppingCart, color: 'text-yellow-600' },
    { label: 'Active Transfers', value: String(kpis?.activeTransfers || 0), icon: ArrowRightLeft, color: 'text-indigo-600' },
    { label: 'Low-Stock Alerts', value: String(kpis?.lowStockAlerts || 0), icon: AlertTriangle, color: kpis?.lowStockAlerts > 0 ? 'text-red-600' : 'text-gray-400' },
  ];

  const pieData = invByLocation.filter((l: any) => Number(l.total_value) > 0).map((l: any) => ({
    name: l.location_name, value: Math.round(Number(l.total_value)),
  }));

  const revenueChartFormatted = chartData.map((r: any) => ({
    date: r.date?.substring(0, 10), revenue: Number(r.revenue), location: r.location_name,
  }));

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
      </header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {kpiCards.map(kpi => (
              <div key={kpi.label} className="bg-card rounded-lg border p-4">
                <div className="flex items-center gap-2 mb-1">
                  <kpi.icon size={16} className={kpi.color} />
                  <span className="text-xs text-muted-foreground">{kpi.label}</span>
                </div>
                <p className="text-lg font-bold">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Revenue Chart */}
            <div className="bg-card rounded-lg border p-4">
              <h3 className="font-medium mb-3">Revenue (Last 30 Days)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={revenueChartFormatted}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Inventory Distribution */}
            <div className="bg-card rounded-lg border p-4">
              <h3 className="font-medium mb-3">Inventory Value by Location</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                      {pieData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">No inventory data</div>
              )}
            </div>
          </div>

          {/* Quick Actions + Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Quick Actions */}
            <div className="bg-card rounded-lg border p-4">
              <h3 className="font-medium mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start h-9" onClick={() => navigate('/console/modules/purchase-order/po/add')}>
                  <Plus size={14} className="mr-2" /> New Purchase Order
                </Button>
                <Button variant="outline" className="w-full justify-start h-9" onClick={() => navigate('/console/modules/transfer/transfer/add')}>
                  <ArrowRightLeft size={14} className="mr-2" /> New Transfer
                </Button>
                <Button variant="outline" className="w-full justify-start h-9" onClick={() => navigate('/console/modules/inventory-management/stock-count')}>
                  <Package size={14} className="mr-2" /> Stock Count
                </Button>
                <Button variant="outline" className="w-full justify-start h-9" onClick={() => navigate('/pos')}>
                  <ShoppingCart size={14} className="mr-2" /> Open POS
                </Button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-card rounded-lg border p-4 lg:col-span-2">
              <h3 className="font-medium mb-3">Recent Activity</h3>
              <Table>
                <TableHeader className="bg-muted/20"><TableRow>
                  <TableHead>Type</TableHead><TableHead>Reference</TableHead>
                  <TableHead>Location</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {activity.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No recent activity</TableCell></TableRow>}
                  {activity.map((a: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="capitalize text-xs font-medium">{a.type}</TableCell>
                      <TableCell className="font-mono text-xs">{a.ref}</TableCell>
                      <TableCell className="text-xs">{a.location_name || '-'}</TableCell>
                      <TableCell className="capitalize text-xs">{a.status}</TableCell>
                      <TableCell className="text-xs">{a.date ? formatDate(a.date) : '-'}</TableCell>
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

export default withModuleAuthorization(ReportDashboard, { moduleId: 'report', moduleName: 'Reports & Analytics' });
