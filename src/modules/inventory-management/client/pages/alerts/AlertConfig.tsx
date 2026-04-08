import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from '@client/components/ui/alert-dialog';
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import axios from 'axios';
import { AlertTriangle, Bell, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const AlertConfig = () => {
  const [configs, setConfigs] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formLoc, setFormLoc] = useState('');
  const [formProd, setFormProd] = useState('');
  const [formMin, setFormMin] = useState('10');
  const [formMax, setFormMax] = useState('');

  function load() {
    axios.get('/api/modules/inventory-management/alert-config').then(r => setConfigs(r.data.configs || [])).catch(() => {});
    axios.get('/api/modules/inventory-management/alerts').then(r => setAlerts(r.data.alerts || [])).catch(() => {});
  }

  useEffect(() => {
    load();
    axios.get('/api/modules/location-management/location', { params: { perPage: 1000 } }).then(r => setLocations((r.data.locations || []).filter((l: any) => l.status === 'active'))).catch(() => {});
    axios.get('/api/modules/product-catalog/product', { params: { perPage: 1000, status: 'active' } }).then(r => setProducts(r.data.products || [])).catch(() => {});
  }, []);

  function handleSave() {
    if (!formLoc || !formProd) { toast.error('Select location and product'); return; }
    axios.post('/api/modules/inventory-management/alert-config', {
      locationId: formLoc, productId: formProd, minQty: parseInt(formMin) || 0, maxQty: formMax ? parseInt(formMax) : null,
    }).then(() => { toast.success('Alert config saved'); setShowForm(false); load(); })
      .catch(err => toast.error(err.response?.data?.error || 'Failed'));
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4"><h1 className="text-2xl font-semibold">Low-Stock Alerts</h1></header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2">

          {/* Active Alerts */}
          {alerts.length > 0 && (
            <div className="bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800 p-4">
              <h3 className="font-medium text-red-700 dark:text-red-300 flex items-center gap-1 mb-2"><AlertTriangle size={16} /> Low Stock Items ({alerts.length})</h3>
              <div className="space-y-1">
                {alerts.map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span>{a.product_name} ({a.sku_code}) — {a.location_name}</span>
                    <span className="font-bold text-red-600">{a.qty_on_hand} / min {a.min_qty}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alert Configs */}
          <div className="flex gap-2"><Button onClick={() => setShowForm(true)}><Plus /> Add Alert Rule</Button></div>
          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/20"><TableRow>
                <TableHead className="w-[50px] text-center">#</TableHead>
                <TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead>Location</TableHead>
                <TableHead className="text-right">Min Qty</TableHead><TableHead className="text-right">Max Qty</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {configs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No alert rules configured.</TableCell></TableRow>}
                {configs.map((c, i) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-center">{i + 1}</TableCell>
                    <TableCell>{c.productName || '-'}</TableCell><TableCell className="text-muted-foreground">{c.skuCode || '-'}</TableCell>
                    <TableCell>{c.locationName || '-'}</TableCell>
                    <TableCell className="text-right">{c.minQty}</TableCell><TableCell className="text-right">{c.maxQty ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
      <AlertDialog open={showForm} onOpenChange={setShowForm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Add Alert Rule</AlertDialogTitle><AlertDialogDescription>Set min/max stock thresholds for a product at a location.</AlertDialogDescription></AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Location</Label><Select value={formLoc} onValueChange={setFormLoc}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Product</Label><Select value={formProd} onValueChange={setFormProd}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.skuCode} - {p.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Min Qty (alert below this)</Label><Input type="number" min={0} value={formMin} onChange={e => setFormMin(e.target.value)} /></div>
            <div><Label>Max Qty (optional)</Label><Input type="number" min={0} value={formMax} onChange={e => setFormMax(e.target.value)} placeholder="Optional" /></div>
          </div>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleSave}>Save Rule</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default withModuleAuthorization(AlertConfig, { moduleId: 'inventory-management', moduleName: 'Inventory Management' });
