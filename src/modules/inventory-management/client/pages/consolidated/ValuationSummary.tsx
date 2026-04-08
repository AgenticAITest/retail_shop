import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import { Label } from '@client/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import axios from 'axios';
import { useEffect, useState } from 'react';

function formatCurrency(v: number) { return `Rp ${v.toLocaleString('id-ID')}`; }

const ValuationSummary = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get('/api/modules/inventory-management/valuation')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4"><h1 className="text-2xl font-semibold">Inventory Valuation</h1></header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2">

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">Total Inventory Value</p>
              <p className="text-2xl font-bold">{formatCurrency(data?.totals?.totalValue || 0)}</p>
            </div>
            <div className="bg-card rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">Total Units</p>
              <p className="text-2xl font-bold">{data?.totals?.totalUnits || 0}</p>
            </div>
            <div className="bg-card rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">Products with Stock</p>
              <p className="text-2xl font-bold">{data?.totals?.totalProducts || 0}</p>
            </div>
            <div className="bg-card rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">Valuation Method</p>
              <p className="text-lg font-medium capitalize">{data?.method?.replace(/_/g, ' ') || '-'}</p>
            </div>
          </div>

          {/* By Location */}
          <div className="bg-card rounded-lg border">
            <div className="p-4 border-b"><h3 className="font-medium">Value by Location</h3></div>
            <Table>
              <TableHeader className="bg-muted/20"><TableRow>
                <TableHead className="w-[50px] text-center">#</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Products</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(data?.byLocation || []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No inventory data.</TableCell></TableRow>}
                {(data?.byLocation || []).map((loc: any, i: number) => (
                  <TableRow key={loc.locationId}>
                    <TableCell className="text-center">{i + 1}</TableCell>
                    <TableCell className="font-medium">{loc.locationName}</TableCell>
                    <TableCell className="text-right">{loc.units}</TableCell>
                    <TableCell className="text-right">{loc.products}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(loc.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(ValuationSummary, { moduleId: 'inventory-management', moduleName: 'Inventory Management' });
