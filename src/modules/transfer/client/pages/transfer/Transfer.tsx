import Authorized from '@client/components/auth/Authorized';
import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import DataPagination from '@client/components/console/DataPagination';
import InputGroup from '@client/components/console/InputGroup';
import SortButton from '@client/components/console/SortButton';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@client/components/ui/alert-dialog';
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from "@client/components/ui/tooltip";
import { useErrorHandler } from '@client/hooks/useErrorHandler';
import axios from 'axios';
import { Eye, Loader2, Plus, Search, X } from 'lucide-react';
import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'requested', label: 'Requested' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'picking', label: 'Picking' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'received', label: 'Received' },
  { value: 'closed', label: 'Closed' },
];

const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  pending_approval: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  picking: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  dispatched: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  received: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
  closed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
};

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
}

const Transfer = () => {
  const { throwError } = useErrorHandler();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);

  const [transfers, setTransfers] = React.useState<any[]>([]);
  const [count, setCount] = React.useState(0);
  const [filter, setFilter] = React.useState(params.get('filter') || '');
  const [statusFilter, setStatusFilter] = React.useState(params.get('status') || 'all');
  const [sort, setSort] = React.useState(params.get('sort') || 'createdAt');
  const [order, setOrder] = React.useState(params.get('order') || 'desc');
  const [page, setPage] = React.useState(Number(params.get('page')) || 1);
  const [perPage] = React.useState(10);
  const [loading, setLoading] = React.useState(false);

  function gotoPage(p: number) {
    if (p < 1 || (count !== 0 && p > Math.ceil(count / perPage))) return;
    setPage(p);
    const params = new URLSearchParams(window.location.search);
    params.set('page', p.toString()); params.set('sort', sort); params.set('order', order);
    params.set('filter', filter); params.set('status', statusFilter);
    navigate(`${window.location.pathname}?${params.toString()}`);
    setLoading(true);
  }

  function sortBy(column: string) { if (sort === column) setOrder(order === 'asc' ? 'desc' : 'asc'); else { setSort(column); setOrder('asc'); } }
  function clearFilter() { setFilter(''); }

  function DebouncedInput({ value: initialValue, onChange, debounce = 500, ...props }: any) {
    const [value, setValue] = React.useState(initialValue);
    React.useEffect(() => { setValue(initialValue); }, [initialValue]);
    React.useEffect(() => { const t = setTimeout(() => { onChange(value); }, debounce); return () => clearTimeout(t); }, [value]);
    return <Input {...props} value={value} onChange={(e: any) => setValue(e.target.value)} className="h-8 px-1 w-60 max-w-sm border-0 focus-visible:ring-0 shadow-none dark:bg-input/0" />;
  }

  useEffect(() => { gotoPage(1); }, [sort, order, filter, statusFilter]);
  useEffect(() => { gotoPage(page); }, [page]);

  useEffect(() => {
    if (loading) {
      axios.get('/api/modules/transfer/transfer', { params: { page, perPage, sort, order, filter, status: statusFilter } })
        .then(r => { setTransfers(r.data.transfers || []); setCount(r.data.count || 0); })
        .catch(throwError)
        .finally(() => setLoading(false));
    }
  }, [loading]);

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <h1 className="text-2xl font-semibold">Inter-Shop Transfers</h1>
      </header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          <div className="flex gap-2 flex-wrap">
            <Authorized roles="ADMIN" permissions="retail.transfer.create">
              <Button onClick={() => navigate('/console/modules/transfer/transfer/add')}>
                <Plus /><span className="hidden lg:inline-block">New Transfer</span>
              </Button>
            </Authorized>
            <div className="ml-auto flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              <InputGroup>
                <DebouncedInput onChange={(v: any) => setFilter(String(v))} placeholder="Search transfer#..." type="text" value={filter ?? ''} />
                {filter !== '' ? <X size={20} className="text-muted-foreground cursor-pointer mx-2 hover:text-foreground" onClick={clearFilter} /> : <Search size={20} className="text-muted-foreground mx-2" />}
              </InputGroup>
            </div>
          </div>
          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/20 font-semibold">
                <TableRow>
                  <TableHead className="w-[50px] py-2 text-center">#</TableHead>
                  <TableHead className="w-[160px] py-2"><SortButton column="transferNumber" label="Transfer #" sort={sort} order={order} sortBy={sortBy} /></TableHead>
                  <TableHead className="w-[150px] py-2">From</TableHead>
                  <TableHead className="w-[150px] py-2">To</TableHead>
                  <TableHead className="w-[130px] py-2">Requested By</TableHead>
                  <TableHead className="w-[150px] py-2"><SortButton column="status" label="Status" sort={sort} order={order} sortBy={sortBy} /></TableHead>
                  <TableHead className="w-[120px] py-2"><SortButton column="createdAt" label="Date" sort={sort} order={order} sortBy={sortBy} /></TableHead>
                  <TableHead className="w-[60px] py-2"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No transfers found.</TableCell></TableRow>
                )}
                {transfers.map((t: any, i: number) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-center">{(page - 1) * perPage + i + 1}</TableCell>
                    <TableCell className="font-medium">
                      <Link to={`/console/modules/transfer/transfer/${t.id}`} className="no-underline hover:underline">{t.transfer_number}</Link>
                    </TableCell>
                    <TableCell>{t.source_location_name || '-'}</TableCell>
                    <TableCell>{t.dest_location_name || '-'}</TableCell>
                    <TableCell>{t.requested_by_name || '-'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[t.status] || ''}`}>
                        {STATUS_OPTIONS.find(o => o.value === t.status)?.label || t.status}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(t.created_at)}</TableCell>
                    <TableCell>
                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="secondary" size="sm" onClick={() => navigate(`/console/modules/transfer/transfer/${t.id}`)}><Eye size={16} /></Button>
                      </TooltipTrigger><TooltipContent><p>View</p></TooltipContent></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DataPagination count={count} perPage={perPage} page={page} gotoPage={gotoPage} />
        </div>
      </div>
      <AlertDialog open={loading}>
        <AlertDialogContent><AlertDialogHeader className='flex w-full items-center text-center'>
          <AlertDialogTitle className='flex items-center gap-2'><Loader2 size={16} className="animate-spin" /> Please wait ...</AlertDialogTitle>
          <AlertDialogDescription>Loading transfers.</AlertDialogDescription>
        </AlertDialogHeader></AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default withModuleAuthorization(Transfer, { moduleId: 'transfer', moduleName: 'Inter-Shop Transfers' });
