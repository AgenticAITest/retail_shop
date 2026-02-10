import Authorized from '@client/components/auth/Authorized';
import ConfirmDialog from '@client/components/console/ConfirmDialog';
import DataPagination from '@client/components/console/DataPagination';
import InputGroup from '@client/components/console/InputGroup';
import SortButton from '@client/components/console/SortButton';
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
import { Loader2, Pencil, Plus, Search, X } from 'lucide-react';
import React, { useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';

interface Tenant {
  id: string;
  code: string;
  name: string;
  description: string;
}

const Tenant = () => {
  const {throwError} = useErrorHandler();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);

  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [count, setCount] = React.useState(0);
  const [filter, setFilter] = React.useState(params.get('filter') || '');
  const [inputValue, setInputValue] = React.useState(params.get('filter') || '');
  const [sort, setSort] = React.useState(params.get('sort') || 'code');
  const [order, setOrder] = React.useState(params.get('order') || 'asc');
  const [page, setPage] = React.useState(Number(params.get('page')) || 1);
  const [perPage, setPerPage] = React.useState(Number(params.get('perPage')) || 10);

  const [loading, setLoading] = React.useState(true);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [selectedTenantId, setSelectedTenantId] = React.useState<string | null>(null);

  // Debounce function for search input
  const debounce = useCallback((func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  }, []);

  // Debounced filter function
  const debouncedFilter = useCallback(
    debounce((value: string) => {
      setFilter(value);
    }, 500),
    [debounce]
  );

  function gotoPage(p: number) {
    console.log("count:", count, "perPage:", perPage, "page:", p );
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
    setInputValue('');
    debouncedFilter('');
  }

  function onDelete(tenantId: string) {
    console.log("Delete tenant with ID:", tenantId);
    setSelectedTenantId(tenantId);
    setConfirmDelete(true);
  }

  function onConfirmDelete() {
    axios
      .delete(`/api/system/tenant/${selectedTenantId}/delete`)
      .then(() => {
        toast.success("Tenant deleted successfully");
        setLoading(true);
      })
      .catch((error) => {
        toast.error("Failed to delete tenant");
      });
  }

  useEffect(() => {
     gotoPage(1);
  }, [sort, order, filter]);

  useEffect(() => {
    gotoPage(page);
  }, [page, perPage]);

  useEffect( () => {
    if (loading) {
      axios.get('/api/system/tenant',{
        params: {
          page,
          perPage,
          sort,
          order,
          filter
        }
      })
      .then(response => {
        //console.log(response.data);
        setTenants(response.data.tenants || []);
        setCount(response.data.count || 0);
      })
      .catch(error => {
        //console.error(error);
        throwError(error);
      })
      .finally(() => {
        setLoading(false);
      });
    }

  }, [loading]);

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4" >
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Tenants</h1>
        </div>
      </header>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          
          <div className="flex  gap-2 ">
            <Authorized roles="SYSADMIN">
              <Button onClick={() => navigate('/console/system/tenant/add')} disabled={loading}>
                <Plus/><span className="hidden lg:inline-block">Add Tenant</span>
              </Button>
            </Authorized>
            <div className="ml-auto flex items-center gap-2">
              <InputGroup>
                <Input
                  placeholder="Search tenants ..."
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    debouncedFilter(e.target.value);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
                  className="h-8 px-1 w-60 max-w-sm border-0 focus-visible:ring-0 shadow-none dark:bg-input/0"
                />
                {inputValue !== '' && (
                  <X size={20} className={`text-muted-foreground cursor-pointer mx-2 hover:text-foreground`} 
                      onClick={clearFilter}/>
                )}
                {inputValue === '' && (
                  <Search size={20} className={`text-muted-foreground mx-2 hover:text-foreground`} />
                )}
              </InputGroup>              
              {/* <Button onClick={applyFilter}>
                <Search/><span className="hidden md:inline-block">Filter</span>
              </Button> */}
            </div>
          </div>
          
          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/20 font-semibold ">
                <TableRow>
                  <TableHead className="w-[50px] py-2 text-center">#</TableHead>
                  <TableHead className="w-[350px] py-2">
                    <SortButton column="code" label="Domain" sort={sort} order={order} sortBy={sortBy} />
                  </TableHead>
                  <TableHead className="w-[350px] py-2">
                    <SortButton column="name" label="Name" sort={sort} order={order} sortBy={sortBy} />
                  </TableHead>
                  <TableHead className="py-2">
                    <SortButton column="description" label="Description" sort={sort} order={order} sortBy={sortBy} />
                  </TableHead>
                  <TableHead className="w-[60px] py-2 text-center"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        <span>Loading tenants...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : tenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      No tenants found
                    </TableCell>
                  </TableRow>
                ) : (
                  tenants.map((tenant, i) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="text-center">{(page - 1) * perPage + i + 1}</TableCell>
                      <TableCell className='font-medium'><Link to={`/console/system/tenant/${tenant.id}`} className='no-underline hover:underline'>{tenant.code}</Link> </TableCell>
                      <TableCell>{tenant.name}</TableCell>
                      <TableCell>{tenant.description}</TableCell>
                      <TableCell className="flex text-center gap-2">
                        <Authorized permissions="system.tenant.view"> 
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="secondary" onClick={() => navigate(`/console/system/tenant/${tenant.id}/edit`)}><Pencil size={20}/></Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit</p>
                            </TooltipContent>
                          </Tooltip>
                        </Authorized>
                        <Authorized roles="SYSADMIN">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="destructive" onClick={() => onDelete(tenant.id)}><X size={20}/></Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete</p>
                          </TooltipContent>
                        </Tooltip>
                        </Authorized>
                      </TableCell>
                    </TableRow>
                  ))
                )}
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
        description='This action cannot be undone. This will permanently delete the tenant and remove all associated data.'
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={onConfirmDelete}
      />
    </>
    
  )
}

export default Tenant