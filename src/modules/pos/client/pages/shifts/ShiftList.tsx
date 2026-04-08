import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import DataPagination from '@client/components/console/DataPagination';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@client/components/ui/alert-dialog';
import { Button } from '@client/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@client/components/ui/tooltip';
import { useErrorHandler } from '@client/hooks/useErrorHandler';
import axios from 'axios';
import { Eye, Loader2 } from 'lucide-react';
import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(a: string | number | null) {
  if (a === null || a === undefined) return '-';
  return `Rp ${Number(a).toLocaleString('id-ID')}`;
}

const ShiftList = () => {
  const { throwError } = useErrorHandler();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);

  const [shifts, setShifts] = React.useState<any[]>([]);
  const [count, setCount] = React.useState(0);
  const [statusFilter, setStatusFilter] = React.useState(params.get('status') || 'all');
  const [page, setPage] = React.useState(Number(params.get('page')) || 1);
  const [perPage] = React.useState(10);
  const [loading, setLoading] = React.useState(false);

  function gotoPage(p: number) {
    if (p < 1 || (count !== 0 && p > Math.ceil(count / perPage))) return;
    setPage(p);
    const params = new URLSearchParams(window.location.search);
    params.set('page', p.toString());
    params.set('status', statusFilter);
    navigate(`${window.location.pathname}?${params.toString()}`);
    setLoading(true);
  }

  useEffect(() => { gotoPage(1); }, [statusFilter]);
  useEffect(() => { gotoPage(page); }, [page]);

  useEffect(() => {
    if (loading) {
      axios.get('/api/modules/pos/shift', { params: { page, perPage, status: statusFilter } })
        .then(r => { setShifts(r.data.shifts || []); setCount(r.data.count || 0); })
        .catch(throwError)
        .finally(() => setLoading(false));
    }
  }, [loading]);

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <h1 className="text-2xl font-semibold">Shift History</h1>
      </header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          <div className="flex gap-2 flex-wrap">
            <div className="ml-auto flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/20 font-semibold">
                <TableRow>
                  <TableHead className="w-[50px] text-center">#</TableHead>
                  <TableHead>Cashier</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Closed</TableHead>
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No shifts found.</TableCell></TableRow>
                )}
                {shifts.map((s, i) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-center">{(page - 1) * perPage + i + 1}</TableCell>
                    <TableCell>{s.cashierName || '-'}</TableCell>
                    <TableCell>{s.locationName || '-'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize ${STATUS_COLORS[s.status] || ''}`}>{s.status}</span>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(s.openedAt)}</TableCell>
                    <TableCell className="text-sm">{formatDate(s.closedAt)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.openingFloat)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.expectedCash)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.actualCash)}</TableCell>
                    <TableCell className={`text-right font-medium ${s.variance && Number(s.variance) !== 0 ? (Number(s.variance) > 0 ? 'text-green-600' : 'text-red-600') : ''}`}>
                      {s.variance ? formatCurrency(s.variance) : '-'}
                    </TableCell>
                    <TableCell>
                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="secondary" size="sm" onClick={() => navigate(`/console/modules/pos/shift/${s.id}`)}><Eye size={16} /></Button>
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
          <AlertDialogHeader className="flex w-full items-center text-center">
            <AlertDialogTitle className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Please wait...</AlertDialogTitle>
            <AlertDialogDescription>Loading shift data.</AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default withModuleAuthorization(ShiftList, { moduleId: 'pos', moduleName: 'Point of Sale' });
