import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import axios from 'axios';
import { useEffect, useState } from 'react';

function formatCurrency(v: number | string) { return `Rp ${Math.abs(Number(v)).toLocaleString('id-ID')}`; }

const InventoryReport = () => {
  const [byLocation, setByLocation] = useState<any[]>([]);
  const [slowMoving, setSlowMoving] = useState<any[]>([]);

  useEffect(() => {
    axios.get('/api/modules/report/inventory/by-location').then(r => setByLocation(r.data.byLocation || [])).catch(() => {});
    axios.get('/api/modules/report/inventory/slow-moving').then(r => setSlowMoving(r.data.slowMoving || [])).catch(() => {});
  }, []);

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4"><h1 className="text-2xl font-semibold">Inventory Report</h1></header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2">

          {/* By Location */}
          <div className="bg-card rounded-lg border">
            <div className="p-4 border-b"><h3 className="font-medium">Stock by Location</h3></div>
            <Table>
              <TableHeader className="bg-muted/20"><TableRow>
                <TableHead>Location</TableHead><TableHead className="text-right">On Hand</TableHead>
                <TableHead className="text-right">In Transit</TableHead><TableHead className="text-right">Products</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {byLocation.map((l: any) => (
                  <TableRow key={l.location_id}>
                    <TableCell className="font-medium">{l.location_name}</TableCell>
                    <TableCell className="text-right">{Number(l.total_on_hand)}</TableCell>
                    <TableCell className="text-right text-purple-600">{Number(l.total_in_transit) || '-'}</TableCell>
                    <TableCell className="text-right">{Number(l.product_count)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(l.total_value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Slow Moving */}
          <div className="bg-card rounded-lg border">
            <div className="p-4 border-b"><h3 className="font-medium">Slow-Moving Stock (No sales in 30 days)</h3></div>
            <Table>
              <TableHeader className="bg-muted/20"><TableRow>
                <TableHead className="w-[50px] text-center">#</TableHead>
                <TableHead>Product</TableHead><TableHead>SKU</TableHead>
                <TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Sold (30d)</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {slowMoving.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No slow-moving stock detected.</TableCell></TableRow>}
                {slowMoving.map((p: any, i: number) => (
                  <TableRow key={p.product_id}>
                    <TableCell className="text-center">{i + 1}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.sku_code}</TableCell>
                    <TableCell className="text-right">{Number(p.total_stock)}</TableCell>
                    <TableCell className="text-right text-red-600">0</TableCell>
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

export default withModuleAuthorization(InventoryReport, { moduleId: 'report', moduleName: 'Reports & Analytics' });
