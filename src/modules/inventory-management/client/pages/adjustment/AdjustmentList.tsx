import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import DataPagination from '@client/components/console/DataPagination';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from '@client/components/ui/alert-dialog';
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { Textarea } from '@client/components/ui/textarea';
import { useErrorHandler } from '@client/hooks/useErrorHandler';
import axios from 'axios';
import { Loader2, Plus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

const REASON_LABELS: Record<string, string> = { damage: 'Damage', theft: 'Theft', write_off: 'Write-off', correction: 'Correction', other: 'Other' };

function formatDate(d: string) { return new Date(d).toLocaleString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }

const AdjustmentList = () => {
  const { throwError } = useErrorHandler();
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [formLoc, setFormLoc] = useState('');
  const [formProd, setFormProd] = useState('');
  const [formQty, setFormQty] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    axios.get('/api/modules/location-management/location', { params: { perPage: 1000 } }).then(r => setLocations((r.data.locations || []).filter((l: any) => l.status === 'active'))).catch(() => {});
    axios.get('/api/modules/product-catalog/product', { params: { perPage: 1000, status: 'active' } }).then(r => setProducts(r.data.products || [])).catch(() => {});
  }, []);

  function load() {
    setLoading(true);
    axios.get('/api/modules/inventory-management/adjustment', { params: { page, perPage: 10 } })
      .then(r => { setAdjustments(r.data.adjustments || []); setTotal(r.data.count || 0); })
      .catch(throwError).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [page]);

  function handleCreate() {
    const prod = products.find(p => p.id === formProd);
    if (!formLoc || !formProd || !formQty || !formReason) { toast.error('Fill all fields'); return; }
    axios.post('/api/modules/inventory-management/adjustment', {
      locationId: formLoc, productId: formProd, skuCode: prod?.skuCode || '', productName: prod?.name || '',
      qty: parseInt(formQty), reasonCode: formReason, notes: formNotes || null,
    }).then(() => { toast.success('Adjustment recorded'); setShowForm(false); setFormQty(''); setFormNotes(''); load(); })
      .catch(err => toast.error(err.response?.data?.error || 'Failed'));
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4"><h1 className="text-2xl font-semibold">Stock Adjustments</h1></header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2">
          <div className="flex gap-2"><Button onClick={() => setShowForm(true)}><Plus /> New Adjustment</Button></div>
          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/20"><TableRow>
                <TableHead className="w-[50px] text-center">#</TableHead>
                <TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead>Location</TableHead>
                <TableHead className="text-right">Qty</TableHead><TableHead>Reason</TableHead>
                <TableHead>By</TableHead><TableHead>Date</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {adjustments.length === 0 && !loading && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No adjustments.</TableCell></TableRow>}
                {adjustments.map((a, i) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-center">{(page - 1) * 10 + i + 1}</TableCell>
                    <TableCell>{a.productName}</TableCell><TableCell className="text-muted-foreground">{a.skuCode}</TableCell>
                    <TableCell>{a.locationName || '-'}</TableCell>
                    <TableCell className={`text-right font-medium ${a.qty > 0 ? 'text-green-600' : 'text-red-600'}`}>{a.qty > 0 ? `+${a.qty}` : a.qty}</TableCell>
                    <TableCell><span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700">{REASON_LABELS[a.reasonCode] || a.reasonCode}</span></TableCell>
                    <TableCell>{a.adjustedByName || '-'}</TableCell><TableCell className="text-sm">{formatDate(a.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DataPagination count={total} perPage={10} page={page} gotoPage={setPage} />
        </div>
      </div>
      <AlertDialog open={showForm} onOpenChange={setShowForm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>New Stock Adjustment</AlertDialogTitle><AlertDialogDescription>Adjust inventory with a reason code.</AlertDialogDescription></AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Location</Label><Select value={formLoc} onValueChange={setFormLoc}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Product</Label><Select value={formProd} onValueChange={setFormProd}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.skuCode} - {p.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Quantity (+ or -)</Label><Input type="number" value={formQty} onChange={e => setFormQty(e.target.value)} placeholder="e.g. -5 or +10" /></div>
            <div><Label>Reason</Label><Select value={formReason} onValueChange={setFormReason}><SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger><SelectContent>
              {Object.entries(REASON_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent></Select></div>
            <div><Label>Notes</Label><Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Details..." rows={2} /></div>
          </div>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleCreate}>Record Adjustment</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={loading}><AlertDialogContent><AlertDialogHeader className="flex w-full items-center text-center"><AlertDialogTitle className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading...</AlertDialogTitle></AlertDialogHeader></AlertDialogContent></AlertDialog>
    </>
  );
};

export default withModuleAuthorization(AdjustmentList, { moduleId: 'inventory-management', moduleName: 'Inventory Management' });
