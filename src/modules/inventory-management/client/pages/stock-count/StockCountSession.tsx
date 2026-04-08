import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import Breadcrumbs, { createBreadcrumbItems, useBreadcrumbs } from '@client/components/console/Breadcrumbs';
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import axios from 'axios';
import { Check, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

const StockCountSession = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [sc, setSc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [countedValues, setCountedValues] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const { items: breadcrumbs } = useBreadcrumbs(createBreadcrumbItems([
    { label: "Stock Counts", onClick: () => navigate("/console/modules/inventory-management/stock-count") },
    { label: "Count Session" },
  ]));

  useEffect(() => {
    setLoading(true);
    axios.get(`/api/modules/inventory-management/stock-count/${id}`)
      .then(r => {
        setSc(r.data);
        const initial: Record<string, number> = {};
        for (const line of r.data.lines || []) {
          if (line.countedQty !== null) initial[line.productId] = line.countedQty;
        }
        setCountedValues(initial);
      })
      .catch(() => { toast.error('Failed to load'); navigate('/console/modules/inventory-management/stock-count'); })
      .finally(() => setLoading(false));
  }, [id]);

  function handleSaveLines() {
    setSaving(true);
    const lines = Object.entries(countedValues).map(([productId, countedQty]) => {
      const line = sc.lines.find((l: any) => l.productId === productId);
      return { productId, skuCode: line?.skuCode || '', productName: line?.productName || '', countedQty };
    });
    axios.put(`/api/modules/inventory-management/stock-count/${id}/lines`, { lines })
      .then(() => toast.success('Counts saved'))
      .catch(err => toast.error(err.response?.data?.error || 'Failed'))
      .finally(() => setSaving(false));
  }

  function handleFinalize() {
    axios.post(`/api/modules/inventory-management/stock-count/${id}/finalize`)
      .then(() => { toast.success('Stock count finalized — inventory updated'); navigate('/console/modules/inventory-management/stock-count'); })
      .catch(err => toast.error(err.response?.data?.error || 'Failed to finalize'));
  }

  if (loading || !sc) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  const isFinalized = sc.status === 'finalized';

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <h1 className="text-2xl font-semibold">Stock Count</h1>
        <div className="ml-auto px-4"><Breadcrumbs items={breadcrumbs} loading={loading} /></div>
      </header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2">
          <div className="bg-card rounded-lg border p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div><Label className="text-muted-foreground">Location</Label><p className="font-medium">{sc.location?.name || '-'}</p></div>
              <div><Label className="text-muted-foreground">Status</Label><p className="capitalize font-medium">{sc.status?.replace('_', ' ')}</p></div>
              <div><Label className="text-muted-foreground">Items</Label><p>{sc.lines?.length || 0} products</p></div>
              <div><Label className="text-muted-foreground">Started By</Label><p>{sc.startedByUser?.fullname || '-'}</p></div>
            </div>
          </div>

          {!isFinalized && (
            <div className="flex gap-2">
              <Button onClick={handleSaveLines} disabled={saving}><Save size={16} className="mr-1" /> Save Counts</Button>
              <Button variant="default" onClick={handleFinalize}><Check size={16} className="mr-1" /> Finalize</Button>
            </div>
          )}

          <div className="bg-card rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/20"><TableRow>
                <TableHead className="w-[50px] text-center">#</TableHead>
                <TableHead>Product</TableHead><TableHead>SKU</TableHead>
                <TableHead className="text-right">System Qty</TableHead>
                <TableHead className="w-[120px]">Counted Qty</TableHead>
                <TableHead className="text-right">Variance</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(sc.lines || []).map((line: any, i: number) => {
                  const counted = countedValues[line.productId];
                  const variance = counted !== undefined ? counted - line.systemQty : (line.varianceQty ?? null);
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="text-center">{i + 1}</TableCell>
                      <TableCell>{line.productName}</TableCell>
                      <TableCell className="text-muted-foreground">{line.skuCode}</TableCell>
                      <TableCell className="text-right">{line.systemQty}</TableCell>
                      <TableCell>
                        {isFinalized ? (
                          <span className="text-right block">{line.countedQty ?? '-'}</span>
                        ) : (
                          <Input type="number" min={0} className="h-8 w-24"
                            value={countedValues[line.productId] ?? ''}
                            onChange={e => setCountedValues(prev => ({ ...prev, [line.productId]: parseInt(e.target.value) || 0 }))} />
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${variance !== null ? (variance > 0 ? 'text-green-600' : variance < 0 ? 'text-red-600' : '') : ''}`}>
                        {variance !== null ? (variance > 0 ? `+${variance}` : variance) : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(StockCountSession, { moduleId: 'inventory-management', moduleName: 'Inventory Management' });
