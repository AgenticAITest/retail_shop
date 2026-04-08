import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import DataPagination from '@client/components/console/DataPagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle } from '@client/components/ui/alert-dialog';
import { useErrorHandler } from '@client/hooks/useErrorHandler';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

const TYPE_LABELS: Record<string, string> = {
  sale: 'Sale', return: 'Return', grn: 'GRN', transfer_out: 'Transfer Out',
  transfer_in: 'Transfer In', adjustment: 'Adjustment', stock_count: 'Stock Count', opening_balance: 'Opening',
};
const TYPE_COLORS: Record<string, string> = {
  sale: 'text-red-600', return: 'text-blue-600', grn: 'text-green-600',
  transfer_out: 'text-purple-600', transfer_in: 'text-teal-600',
  adjustment: 'text-orange-600', stock_count: 'text-indigo-600', opening_balance: 'text-gray-600',
};

function formatDate(d: string) { return new Date(d).toLocaleString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }

const MovementLedger = () => {
  const { throwError } = useErrorHandler();
  const [movements, setMovements] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');

  function load() {
    setLoading(true);
    const params: any = { page, perPage: 20 };
    if (typeFilter !== 'all') params.movementType = typeFilter;
    axios.get('/api/modules/inventory-management/movement', { params })
      .then(r => { setMovements(r.data.movements || []); setTotal(r.data.count || 0); })
      .catch(throwError).finally(() => setLoading(false));
  }

  useEffect(() => { setPage(1); load(); }, [typeFilter]);
  useEffect(() => { load(); }, [page]);

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4"><h1 className="text-2xl font-semibold">Movement Ledger</h1></header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2">
          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/20"><TableRow>
                <TableHead className="w-[50px] text-center">#</TableHead>
                <TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead>Location</TableHead>
                <TableHead>Type</TableHead><TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Balance After</TableHead><TableHead>Date</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {movements.length === 0 && !loading && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No movements.</TableCell></TableRow>}
                {movements.map((m, i) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-center">{(page - 1) * 20 + i + 1}</TableCell>
                    <TableCell>{m.productName || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{m.skuCode || '-'}</TableCell>
                    <TableCell>{m.locationName || '-'}</TableCell>
                    <TableCell><span className={`text-xs font-medium ${TYPE_COLORS[m.movementType] || ''}`}>{TYPE_LABELS[m.movementType] || m.movementType}</span></TableCell>
                    <TableCell className={`text-right font-medium ${m.qty > 0 ? 'text-green-600' : m.qty < 0 ? 'text-red-600' : ''}`}>{m.qty > 0 ? `+${m.qty}` : m.qty}</TableCell>
                    <TableCell className="text-right">{m.balanceAfter}</TableCell>
                    <TableCell className="text-sm">{formatDate(m.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DataPagination count={total} perPage={20} page={page} gotoPage={setPage} />
        </div>
      </div>
      <AlertDialog open={loading}><AlertDialogContent><AlertDialogHeader className="flex w-full items-center text-center"><AlertDialogTitle className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading...</AlertDialogTitle></AlertDialogHeader></AlertDialogContent></AlertDialog>
    </>
  );
};

export default withModuleAuthorization(MovementLedger, { moduleId: 'inventory-management', moduleName: 'Inventory Management' });
