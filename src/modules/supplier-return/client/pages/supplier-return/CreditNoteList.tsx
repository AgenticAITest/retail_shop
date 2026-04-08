import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import DataPagination from '@client/components/console/DataPagination';
import InputGroup from '@client/components/console/InputGroup';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@client/components/ui/alert-dialog';
import { Input } from '@client/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { useErrorHandler } from '@client/hooks/useErrorHandler';
import axios from 'axios';
import { Loader2, Search, X } from 'lucide-react';
import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';

interface CreditNoteItem {
  id: string;
  creditNoteNumber: string;
  amount: string;
  creditDate: string;
  isReplacement: boolean;
  supplierReturnId: string;
  returnNumber: string;
  supplierName: string | null;
  notes: string | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
}

const CreditNoteList = () => {
  const { throwError } = useErrorHandler();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);

  const [creditNotes, setCreditNotes] = React.useState<CreditNoteItem[]>([]);
  const [count, setCount] = React.useState(0);
  const [filter, setFilter] = React.useState(params.get('filter') || '');
  const [page, setPage] = React.useState(Number(params.get('page')) || 1);
  const [perPage, setPerPage] = React.useState(Number(params.get('perPage')) || 10);
  const [loading, setLoading] = React.useState(false);

  function gotoPage(p: number) {
    if (p < 1 || (count !== 0 && p > Math.ceil(count / perPage))) return;
    const params = new URLSearchParams(window.location.search);
    setPage(p);
    params.set('page', p.toString());
    params.set('perPage', perPage.toString());
    params.set('filter', filter);
    navigate(`${window.location.pathname}?${params.toString()}`);
    setLoading(true);
  }

  function clearFilter() { setFilter(''); }

  function DebouncedInput({ value: initialValue, onChange, debounce = 500, ...props }: { value: string | number; onChange: (value: string | number) => void; debounce?: number } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>) {
    const [value, setValue] = React.useState(initialValue);
    React.useEffect(() => { setValue(initialValue); }, [initialValue]);
    React.useEffect(() => { const t = setTimeout(() => { onChange(value); }, debounce); return () => clearTimeout(t); }, [value]);
    return <Input {...props} value={value} onChange={e => setValue(e.target.value)} className="h-8 px-1 w-60 max-w-sm border-0 focus-visible:ring-0 shadow-none dark:bg-input/0" />;
  }

  useEffect(() => { gotoPage(1); }, [filter]);
  useEffect(() => { gotoPage(page); }, [page, perPage]);

  useEffect(() => {
    if (loading) {
      axios.get('/api/modules/supplier-return/credit-note', { params: { page, perPage, filter } })
        .then(response => { setCreditNotes(response.data.creditNotes || []); setCount(response.data.count || 0); })
        .catch(error => { throwError(error); })
        .finally(() => { setLoading(false); });
    }
  }, [loading]);

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <h1 className="text-2xl font-semibold">Credit Notes</h1>
      </header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          <div className="flex gap-2 flex-wrap">
            <div className="ml-auto flex items-center gap-2">
              <InputGroup>
                <DebouncedInput onChange={value => setFilter(String(value))} placeholder="Search CN# or return#..." type="text" value={filter ?? ''} />
                {filter !== '' ? <X size={20} className="text-muted-foreground cursor-pointer mx-2 hover:text-foreground" onClick={clearFilter} /> : <Search size={20} className="text-muted-foreground mx-2" />}
              </InputGroup>
            </div>
          </div>

          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/20 font-semibold">
                <TableRow>
                  <TableHead className="w-[50px] py-2 text-center">#</TableHead>
                  <TableHead className="w-[160px] py-2">Credit Note #</TableHead>
                  <TableHead className="w-[140px] py-2">Return #</TableHead>
                  <TableHead className="w-[180px] py-2">Supplier</TableHead>
                  <TableHead className="w-[120px] py-2 text-right">Amount</TableHead>
                  <TableHead className="w-[120px] py-2">Date</TableHead>
                  <TableHead className="w-[100px] py-2">Type</TableHead>
                  <TableHead className="py-2">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditNotes.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No credit notes found.</TableCell></TableRow>
                )}
                {creditNotes.map((cn, i) => (
                  <TableRow key={cn.id}>
                    <TableCell className="text-center">{(page - 1) * perPage + i + 1}</TableCell>
                    <TableCell className="font-medium">{cn.creditNoteNumber}</TableCell>
                    <TableCell>
                      <Link to={`/console/modules/supplier-return/return/${cn.supplierReturnId}`} className="text-blue-600 hover:underline">{cn.returnNumber}</Link>
                    </TableCell>
                    <TableCell>{cn.supplierName || '-'}</TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(cn.amount).toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}
                    </TableCell>
                    <TableCell>{formatDate(cn.creditDate)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${cn.isReplacement ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'}`}>
                        {cn.isReplacement ? 'Replacement' : 'Credit'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{cn.notes || '-'}</TableCell>
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

export default withModuleAuthorization(CreditNoteList, { moduleId: 'supplier-return', moduleName: 'Supplier Returns & Credit Notes' });
