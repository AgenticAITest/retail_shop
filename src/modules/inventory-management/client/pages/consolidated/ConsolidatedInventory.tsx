import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import DataPagination from '@client/components/console/DataPagination';
import InputGroup from '@client/components/console/InputGroup';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel } from '@client/components/ui/alert-dialog';
import { Input } from '@client/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { useErrorHandler } from '@client/hooks/useErrorHandler';
import axios from 'axios';
import { Loader2, Search, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

function formatCurrency(v: number) { return `Rp ${v.toLocaleString('id-ID')}`; }

const ConsolidatedInventory = () => {
  const { throwError } = useErrorHandler();
  const [items, setItems] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);

  function DebouncedInput({ value: init, onChange, debounce = 500, ...props }: any) {
    const [v, setV] = useState(init);
    React.useEffect(() => { setV(init); }, [init]);
    React.useEffect(() => { const t = setTimeout(() => onChange(v), debounce); return () => clearTimeout(t); }, [v]);
    return <Input {...props} value={v} onChange={(e: any) => setV(e.target.value)} className="h-8 px-1 w-60 max-w-sm border-0 focus-visible:ring-0 shadow-none dark:bg-input/0" />;
  }

  function load() {
    setLoading(true);
    axios.get('/api/modules/inventory-management/consolidated', { params: { page, perPage: 20, search } })
      .then(r => { setItems(r.data.consolidated || []); setCount(r.data.count || 0); })
      .catch(throwError).finally(() => setLoading(false));
  }

  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => { load(); }, [page, search]);

  function openDrillDown(productId: string) {
    axios.get(`/api/modules/inventory-management/consolidated/${productId}`)
      .then(r => { setDetail(r.data); setShowDetail(true); })
      .catch(() => {});
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4"><h1 className="text-2xl font-semibold">Consolidated Inventory</h1></header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2">
          <div className="flex gap-2">
            <div className="ml-auto">
              <InputGroup>
                <DebouncedInput onChange={(v: any) => setSearch(String(v))} placeholder="Search product..." type="text" value={search} />
                {search ? <X size={20} className="text-muted-foreground cursor-pointer mx-2" onClick={() => setSearch('')} /> : <Search size={20} className="text-muted-foreground mx-2" />}
              </InputGroup>
            </div>
          </div>
          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/20 font-semibold"><TableRow>
                <TableHead className="w-[50px] text-center">#</TableHead>
                <TableHead>Product</TableHead><TableHead>SKU</TableHead>
                <TableHead className="text-right">On Hand</TableHead>
                <TableHead className="text-right">In Transit</TableHead>
                <TableHead className="text-right">On Order</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {items.length === 0 && !loading && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No inventory data.</TableCell></TableRow>}
                {items.map((item, i) => (
                  <TableRow key={item.productId} className="cursor-pointer hover:bg-accent" onClick={() => openDrillDown(item.productId)}>
                    <TableCell className="text-center">{(page - 1) * 20 + i + 1}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground">{item.skuCode}</TableCell>
                    <TableCell className="text-right">{item.totalOnHand}</TableCell>
                    <TableCell className="text-right">{item.totalInTransit > 0 ? <span className="text-purple-600">{item.totalInTransit}</span> : '-'}</TableCell>
                    <TableCell className="text-right">{item.totalOnOrder > 0 ? <span className="text-blue-600">{item.totalOnOrder}</span> : '-'}</TableCell>
                    <TableCell className="text-right font-medium">{item.available}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.totalValue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DataPagination count={count} perPage={20} page={page} gotoPage={setPage} />
        </div>
      </div>

      {/* Drill-down Dialog */}
      <AlertDialog open={showDetail} onOpenChange={setShowDetail}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{detail?.product?.name} ({detail?.product?.skuCode})</AlertDialogTitle>
            <AlertDialogDescription>Per-location inventory breakdown</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="flex gap-4 text-sm text-center">
              <div><span className="text-muted-foreground">Total On Hand</span><p className="font-bold text-lg">{detail?.totals?.totalOnHand}</p></div>
              <div><span className="text-muted-foreground">In Transit</span><p className="font-bold text-lg text-purple-600">{detail?.totals?.totalInTransit}</p></div>
              <div><span className="text-muted-foreground">On Order</span><p className="font-bold text-lg text-blue-600">{detail?.totals?.totalOnOrder}</p></div>
            </div>
            <Table>
              <TableHeader className="bg-muted/20"><TableRow>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">On Hand</TableHead>
                <TableHead className="text-right">In Transit</TableHead>
                <TableHead className="text-right">On Order</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(detail?.breakdown || []).map((b: any) => (
                  <TableRow key={b.locationId}>
                    <TableCell>{b.locationName} ({b.locationCode})</TableCell>
                    <TableCell className="text-right">{b.qtyOnHand}</TableCell>
                    <TableCell className="text-right text-purple-600">{b.inTransit || '-'}</TableCell>
                    <TableCell className="text-right text-blue-600">{b.onOrder || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <AlertDialogFooter><AlertDialogCancel>Close</AlertDialogCancel></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={loading}><AlertDialogContent><AlertDialogHeader className="flex w-full items-center text-center"><AlertDialogTitle className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading...</AlertDialogTitle></AlertDialogHeader></AlertDialogContent></AlertDialog>
    </>
  );
};

export default withModuleAuthorization(ConsolidatedInventory, { moduleId: 'inventory-management', moduleName: 'Inventory Management' });
