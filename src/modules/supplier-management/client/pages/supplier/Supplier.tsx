import Authorized from '@client/components/auth/Authorized';
import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import ConfirmDialog from '@client/components/console/ConfirmDialog';
import DataPagination from '@client/components/console/DataPagination';
import InputGroup from '@client/components/console/InputGroup';
import SortButton from '@client/components/console/SortButton';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@client/components/ui/alert-dialog';
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@client/components/ui/tooltip";
import { useErrorHandler } from '@client/hooks/useErrorHandler';
import axios from 'axios';
import { Eye, Loader2, Pencil, Plus, Search, X } from 'lucide-react';
import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';

interface SupplierItem {
  id: string;
  code: string;
  name: string;
  npwp: string | null;
  paymentTerms: string | null;
  status: string;
}

const Supplier = () => {
  const { throwError } = useErrorHandler();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);

  const [suppliers, setSuppliers] = React.useState<SupplierItem[]>([]);
  const [count, setCount] = React.useState(0);
  const [filter, setFilter] = React.useState(params.get('filter') || '');
  const [sort, setSort] = React.useState(params.get('sort') || 'name');
  const [order, setOrder] = React.useState(params.get('order') || 'asc');
  const [page, setPage] = React.useState(Number(params.get('page')) || 1);
  const [perPage, setPerPage] = React.useState(Number(params.get('perPage')) || 10);

  const [loading, setLoading] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = React.useState<string | null>(null);

  function gotoPage(p: number) {
    if (p < 1 || (count !== 0 && p > Math.ceil(count / perPage))) return;
    const params = new URLSearchParams(window.location.search);
    setPage(p);
    params.set('page', p.toString());
    params.set('perPage', perPage.toString());
    params.set('sort', sort);
    params.set('order', order);
    params.set('filter', filter);
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

  function applyFilter() {
    gotoPage(1);
  }

  function clearFilter() {
    setFilter('');
  }

  function DebouncedInput({
    value: initialValue,
    onChange,
    debounce = 500,
    ...props
  }: {
    value: string | number
    onChange: (value: string | number) => void
    debounce?: number
  } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>) {
    const [value, setValue] = React.useState(initialValue)

    React.useEffect(() => {
      setValue(initialValue)
    }, [initialValue])

    React.useEffect(() => {
      const timeout = setTimeout(() => {
        onChange(value)
      }, debounce)

      return () => clearTimeout(timeout)
    }, [value])

    return (
      <Input
        {...props}
        value={value} onChange={e => setValue(e.target.value)}
        className="h-8 px-1 w-60 max-w-sm border-0 focus-visible:ring-0 shadow-none dark:bg-input/0" />
    )
  }

  function onDelete(supplierId: string) {
    setSelectedSupplierId(supplierId);
    setConfirmDelete(true);
  }

  function onConfirmDelete() {
    axios
      .delete(`/api/modules/supplier-management/supplier/${selectedSupplierId}`)
      .then(() => {
        toast.success("Supplier deleted successfully");
        setLoading(true);
      })
      .catch((error) => {
        toast.error("Failed to delete supplier");
      });
  }

  useEffect(() => {
    gotoPage(1);
  }, [sort, order, filter]);

  useEffect(() => {
    gotoPage(page);
  }, [page, perPage]);

  useEffect(() => {
    if (loading) {
      axios.get('/api/modules/supplier-management/supplier', {
        params: {
          page,
          perPage,
          sort,
          order,
          filter
        }
      })
        .then(response => {
          setSuppliers(response.data.suppliers || []);
          setCount(response.data.count || 0);
        })
        .catch(error => {
          throwError(error);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [loading]);

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Suppliers</h1>
        </div>
      </header>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          <div className="flex gap-2">
            <Authorized roles="ADMIN" permissions="retail.supplier.create">
              <Button onClick={() => navigate('/console/modules/supplier-management/supplier/add')}>
                <Plus /><span className="hidden lg:inline-block">Add Supplier</span>
              </Button>
            </Authorized>
            <div className="ml-auto flex items-center gap-2">
              <InputGroup>
                <DebouncedInput
                  onChange={value => setFilter(String(value))}
                  placeholder={`Search...`}
                  type="text"
                  value={(filter ?? '') as string}
                />
                {filter !== '' && (
                  <X size={20} className={`text-muted-foreground cursor-pointer mx-2 hover:text-foreground`}
                    onClick={clearFilter} />
                )}
                {filter === '' && (
                  <Search size={20} className={`text-muted-foreground mx-2 hover:text-foreground`} />
                )}
              </InputGroup>
            </div>
          </div>

          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/20 font-semibold">
                <TableRow>
                  <TableHead className="w-[50px] py-2 text-center">#</TableHead>
                  <TableHead className="w-[150px] py-2">
                    <SortButton column="code" label="Code" sort={sort} order={order} sortBy={sortBy} />
                  </TableHead>
                  <TableHead className="w-[250px] py-2">
                    <SortButton column="name" label="Name" sort={sort} order={order} sortBy={sortBy} />
                  </TableHead>
                  <TableHead className="w-[150px] py-2">
                    <SortButton column="npwp" label="NPWP" sort={sort} order={order} sortBy={sortBy} />
                  </TableHead>
                  <TableHead className="w-[150px] py-2">
                    <SortButton column="paymentTerms" label="Payment Terms" sort={sort} order={order} sortBy={sortBy} />
                  </TableHead>
                  <TableHead className="w-[100px] py-2">
                    <SortButton column="status" label="Status" sort={sort} order={order} sortBy={sortBy} />
                  </TableHead>
                  <TableHead className="w-[150px] py-2 text-center"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((sup, i) => (
                  <TableRow key={sup.id}>
                    <TableCell className="text-center">{(page - 1) * perPage + i + 1}</TableCell>
                    <TableCell className="font-medium">
                      <Link to={`/console/modules/supplier-management/supplier/${sup.id}`} className="no-underline hover:underline">
                        {sup.code}
                      </Link>
                    </TableCell>
                    <TableCell>{sup.name}</TableCell>
                    <TableCell>{sup.npwp || '-'}</TableCell>
                    <TableCell>{sup.paymentTerms || '-'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${sup.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                        {sup.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="flex text-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="secondary" onClick={() => navigate(`/console/modules/supplier-management/supplier/${sup.id}`)}><Eye size={20} /></Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>View</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="secondary" onClick={() => navigate(`/console/modules/supplier-management/supplier/${sup.id}/edit`)}><Pencil size={20} /></Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="destructive" onClick={() => onDelete(sup.id)}><X size={20} /></Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DataPagination
            count={count}
            perPage={perPage}
            page={page}
            gotoPage={gotoPage}
          />

        </div>
      </div>
      <ConfirmDialog
        title='Confirm Delete'
        description='This action cannot be undone. This will set the supplier status to inactive.'
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={onConfirmDelete}
      />

      <AlertDialog open={loading}>
        <AlertDialogContent>
          <AlertDialogHeader className='flex w-full items-center text-center'>
            <AlertDialogTitle className='flex items-center gap-2'>
              <Loader2 size={16} className="animate-spin" /> Please wait ...
            </AlertDialogTitle>
            <AlertDialogDescription>
              Please wait while the data is being processed.
            </AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default withModuleAuthorization(Supplier, {
  moduleId: 'supplier-management',
  moduleName: 'Supplier Management'
});
