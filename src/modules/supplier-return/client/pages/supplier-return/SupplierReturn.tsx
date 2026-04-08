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

interface ReturnListItem {
  id: string;
  returnNumber: string;
  grnNumber: string | null;
  supplierName: string | null;
  status: string;
  returnDate: string;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'requested', label: 'Requested' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'credit_note_received', label: 'Credit Note Received' },
  { value: 'closed', label: 'Closed' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  pending_approval: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  dispatched: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  acknowledged: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  credit_note_received: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
  closed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  dispatched: 'Dispatched',
  acknowledged: 'Acknowledged',
  credit_note_received: 'Credit Note Received',
  closed: 'Closed',
  rejected: 'Rejected',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
}

const SupplierReturn = () => {
  const { throwError } = useErrorHandler();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);

  const [returns, setReturns] = React.useState<ReturnListItem[]>([]);
  const [count, setCount] = React.useState(0);
  const [filter, setFilter] = React.useState(params.get('filter') || '');
  const [statusFilter, setStatusFilter] = React.useState(params.get('status') || 'all');
  const [sort, setSort] = React.useState(params.get('sort') || 'returnDate');
  const [order, setOrder] = React.useState(params.get('order') || 'desc');
  const [page, setPage] = React.useState(Number(params.get('page')) || 1);
  const [perPage, setPerPage] = React.useState(Number(params.get('perPage')) || 10);
  const [loading, setLoading] = React.useState(false);

  function gotoPage(p: number) {
    if (p < 1 || (count !== 0 && p > Math.ceil(count / perPage))) return;
    const params = new URLSearchParams(window.location.search);
    setPage(p);
    params.set('page', p.toString());
    params.set('perPage', perPage.toString());
    params.set('sort', sort);
    params.set('order', order);
    params.set('filter', filter);
    params.set('status', statusFilter);
    navigate(`${window.location.pathname}?${params.toString()}`);
    setLoading(true);
  }

  function sortBy(column: string) {
    if (sort === column) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(column);
      setOrder('asc');
    }
  }

  function clearFilter() { setFilter(''); }

  function DebouncedInput({ value: initialValue, onChange, debounce = 500, ...props }: { value: string | number; onChange: (value: string | number) => void; debounce?: number } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>) {
    const [value, setValue] = React.useState(initialValue);
    React.useEffect(() => { setValue(initialValue); }, [initialValue]);
    React.useEffect(() => { const t = setTimeout(() => { onChange(value); }, debounce); return () => clearTimeout(t); }, [value]);
    return <Input {...props} value={value} onChange={e => setValue(e.target.value)} className="h-8 px-1 w-60 max-w-sm border-0 focus-visible:ring-0 shadow-none dark:bg-input/0" />;
  }

  useEffect(() => { gotoPage(1); }, [sort, order, filter, statusFilter]);
  useEffect(() => { gotoPage(page); }, [page, perPage]);

  useEffect(() => {
    if (loading) {
      axios.get('/api/modules/supplier-return/return', { params: { page, perPage, sort, order, filter, status: statusFilter } })
        .then(response => { setReturns(response.data.returns || []); setCount(response.data.count || 0); })
        .catch(error => { throwError(error); })
        .finally(() => { setLoading(false); });
    }
  }, [loading]);

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <h1 className="text-2xl font-semibold">Supplier Returns</h1>
      </header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          <div className="flex gap-2 flex-wrap">
            <Authorized roles="ADMIN" permissions="retail.supplier-return.create">
              <Button onClick={() => navigate('/console/modules/supplier-return/return/add')}>
                <Plus /><span className="hidden lg:inline-block">New Return</span>
              </Button>
            </Authorized>
            <div className="ml-auto flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] h-8"><SelectValue placeholder="Filter by status" /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
                </SelectContent>
              </Select>
              <InputGroup>
                <DebouncedInput onChange={value => setFilter(String(value))} placeholder="Search return# or supplier..." type="text" value={filter ?? ''} />
                {filter !== '' ? <X size={20} className="text-muted-foreground cursor-pointer mx-2 hover:text-foreground" onClick={clearFilter} /> : <Search size={20} className="text-muted-foreground mx-2" />}
              </InputGroup>
            </div>
          </div>

          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/20 font-semibold">
                <TableRow>
                  <TableHead className="w-[50px] py-2 text-center">#</TableHead>
                  <TableHead className="w-[160px] py-2"><SortButton column="returnNumber" label="Return Number" sort={sort} order={order} sortBy={sortBy} /></TableHead>
                  <TableHead className="w-[140px] py-2">GRN Number</TableHead>
                  <TableHead className="w-[180px] py-2">Supplier</TableHead>
                  <TableHead className="w-[130px] py-2"><SortButton column="returnDate" label="Return Date" sort={sort} order={order} sortBy={sortBy} /></TableHead>
                  <TableHead className="w-[170px] py-2"><SortButton column="status" label="Status" sort={sort} order={order} sortBy={sortBy} /></TableHead>
                  <TableHead className="w-[80px] py-2 text-center"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No supplier returns found.</TableCell></TableRow>
                )}
                {returns.map((sr, i) => (
                  <TableRow key={sr.id}>
                    <TableCell className="text-center">{(page - 1) * perPage + i + 1}</TableCell>
                    <TableCell className="font-medium">
                      <Link to={`/console/modules/supplier-return/return/${sr.id}`} className="no-underline hover:underline">{sr.returnNumber}</Link>
                    </TableCell>
                    <TableCell>{sr.grnNumber || '-'}</TableCell>
                    <TableCell>{sr.supplierName || '-'}</TableCell>
                    <TableCell>{formatDate(sr.returnDate)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[sr.status] || ''}`}>
                        {STATUS_LABELS[sr.status] || sr.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="secondary" size="sm" onClick={() => navigate(`/console/modules/supplier-return/return/${sr.id}`)}><Eye size={16} /></Button>
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
        <AlertDialogContent>
          <AlertDialogHeader className='flex w-full items-center text-center'>
            <AlertDialogTitle className='flex items-center gap-2'><Loader2 size={16} className="animate-spin" /> Please wait ...</AlertDialogTitle>
            <AlertDialogDescription>Please wait while the data is being processed.</AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default withModuleAuthorization(SupplierReturn, { moduleId: 'supplier-return', moduleName: 'Supplier Returns & Credit Notes' });
