import Authorized from '@client/components/auth/Authorized';
import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import DataPagination from '@client/components/console/DataPagination';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from '@client/components/ui/alert-dialog';
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@client/components/ui/tooltip';
import { useErrorHandler } from '@client/hooks/useErrorHandler';
import axios from 'axios';
import { Eye, Loader2, Plus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700', in_progress: 'bg-yellow-100 text-yellow-700',
  finalized: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700',
};

function formatDate(d: string | null) { return d ? new Date(d).toLocaleString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'; }

const StockCountList = () => {
  const { throwError } = useErrorHandler();
  const navigate = useNavigate();
  const [counts, setCounts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLoc, setSelectedLoc] = useState('');

  useEffect(() => {
    axios.get('/api/modules/location-management/location', { params: { perPage: 1000 } })
      .then(r => setLocations((r.data.locations || []).filter((l: any) => l.status === 'active'))).catch(() => {});
  }, []);

  function load() {
    setLoading(true);
    axios.get('/api/modules/inventory-management/stock-count', { params: { page, perPage: 10 } })
      .then(r => { setCounts(r.data.stockCounts || []); setTotal(r.data.count || 0); })
      .catch(throwError).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [page]);

  function handleCreate() {
    if (!selectedLoc) { toast.error('Select a location'); return; }
    axios.post('/api/modules/inventory-management/stock-count', { locationId: selectedLoc })
      .then(r => { toast.success('Stock count started'); navigate(`/console/modules/inventory-management/stock-count/${r.data.id}`); })
      .catch(err => toast.error(err.response?.data?.error || 'Failed'));
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4"><h1 className="text-2xl font-semibold">Stock Counts</h1></header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2">
          <div className="flex gap-2">
            <Authorized roles="ADMIN" permissions="retail.inventory.count">
              <Button onClick={() => setShowCreate(true)}><Plus /> New Count</Button>
            </Authorized>
          </div>
          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/20"><TableRow>
                <TableHead className="w-[50px] text-center">#</TableHead>
                <TableHead>Location</TableHead><TableHead>Status</TableHead>
                <TableHead>Started</TableHead><TableHead>Finalized</TableHead>
                <TableHead>Started By</TableHead><TableHead className="w-[60px]"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {counts.length === 0 && !loading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No stock counts.</TableCell></TableRow>}
                {counts.map((c, i) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-center">{(page - 1) * 10 + i + 1}</TableCell>
                    <TableCell>{c.locationName || '-'}</TableCell>
                    <TableCell><span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize ${STATUS_COLORS[c.status] || ''}`}>{c.status?.replace('_', ' ')}</span></TableCell>
                    <TableCell>{formatDate(c.startedAt)}</TableCell>
                    <TableCell>{formatDate(c.finalizedAt)}</TableCell>
                    <TableCell>{c.startedByName || '-'}</TableCell>
                    <TableCell><Tooltip><TooltipTrigger asChild><Button variant="secondary" size="sm" onClick={() => navigate(`/console/modules/inventory-management/stock-count/${c.id}`)}><Eye size={16} /></Button></TooltipTrigger><TooltipContent><p>View</p></TooltipContent></Tooltip></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DataPagination count={total} perPage={10} page={page} gotoPage={setPage} />
        </div>
      </div>
      <AlertDialog open={showCreate} onOpenChange={setShowCreate}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Start Stock Count</AlertDialogTitle><AlertDialogDescription>Select a location to start counting.</AlertDialogDescription></AlertDialogHeader>
          <div className="py-2 space-y-2">
            <Label>Location</Label>
            <Select value={selectedLoc} onValueChange={setSelectedLoc}>
              <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
              <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.code} - {l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleCreate}>Start Count</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={loading}><AlertDialogContent><AlertDialogHeader className="flex w-full items-center text-center"><AlertDialogTitle className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading...</AlertDialogTitle></AlertDialogHeader></AlertDialogContent></AlertDialog>
    </>
  );
};

export default withModuleAuthorization(StockCountList, { moduleId: 'inventory-management', moduleName: 'Inventory Management' });
