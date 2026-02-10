import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import ConfirmDialog from '@client/components/console/ConfirmDialog';
import DataPagination from '@client/components/console/DataPagination';
import InputGroup from '@client/components/console/InputGroup';
import SortButton from '@client/components/console/SortButton';
import StatusBadge from '@client/components/StatusBadge';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@client/components/ui/alert-dialog';
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@client/components/ui/tooltip";
import { useErrorHandler } from '@client/hooks/useErrorHandler';
import axios from 'axios';
import { Loader2, Pencil, Plus, Search, X } from 'lucide-react';
import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';

interface Employee {
  id: string;
  empNo: string;
  bio: {
    name: string;
    birthDate: string;
    gender: string;
  };
  department: {
    name: string;
  };
  status: string;
}

const Employee = () => {
  const { throwError } = useErrorHandler();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);

  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [count, setCount] = React.useState(0);
  const [filter, setFilter] = React.useState(params.get('filter') || '');
  const [status, setStatus] = React.useState(params.get('status') || '');
  const [sort, setSort] = React.useState(params.get('sort') || 'empNo');
  const [order, setOrder] = React.useState(params.get('order') || 'asc');
  const [page, setPage] = React.useState(Number(params.get('page')) || 1);
  const [perPage, setPerPage] = React.useState(Number(params.get('perPage')) || 10);

  const [loading, setLoading] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string | null>(null);

  function gotoPage(p: number) {
    console.log("count:", count, "perPage:", perPage, "page:", p);
    if (p < 1 || (count !== 0 && p > Math.ceil(count / perPage))) return;
    const params = new URLSearchParams(window.location.search);
    setPage(p);
    params.set('page', p.toString());
    params.set('perPage', perPage.toString());
    params.set('sort', sort);
    params.set('order', order);
    params.set('filter', filter);
    params.set('status', status);
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
    //gotoPage(1);
  }

  // A typical debounced input react component
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
        className="h-8 px-1 md:w-55 max-w-sm border-0 focus-visible:ring-0 shadow-none dark:bg-input/0" />
    )
  }

  function onDelete(employeeId: string) {
    console.log("Delete employee with ID:", employeeId);
    setSelectedEmployeeId(employeeId);
    setConfirmDelete(true);
  }

  function onConfirmDelete() {
    axios
      .delete(`/api/modules/demo-module/employee/${selectedEmployeeId}/delete`)
      .then(() => {
        toast.success("Employee deleted successfully");
        setLoading(true);
      })
      .catch((error) => {
        toast.error("Failed to delete employee");
      });
  }

  useEffect(() => {
    gotoPage(1);
  }, [sort, order, filter, status]);

  useEffect(() => {
    gotoPage(page);
  }, [page, perPage]);

  useEffect(() => {
    if (loading) {
      axios.get('/api/modules/demo-module/employee', {
        params: {
          page,
          perPage,
          sort,
          order,
          filter,
          status
        }
      })
        .then(response => {
          console.log(response.data);
          setEmployees(response.data.employees || []);
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
          <h1 className="text-2xl font-semibold">Employees</h1>
        </div>
      </header>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">

          <div className="flex grid grid-cols-6 gap-2">
            <div className="col-span-1">
              <Button onClick={() => navigate('/console/modules/demo-module/employee/add')}>
                <Plus /><span className="hidden lg:inline-block">Add Employee</span>
              </Button>
            </div>
            <div className="flex gap-2 col-span-5 md:col-span-3 md:col-start-4 justify-end">
              <InputGroup>
                {/* <Input
                  placeholder="Search employees ..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
                  className="h-8 px-1 w-60 max-w-sm border-0 focus-visible:ring-0 shadow-none dark:bg-input/0"
                /> */}
                <DebouncedInput
                  onChange={value => setFilter(String(value))}
                  placeholder={`Search by employee no / name`}
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
              {/* <Button onClick={applyFilter}>
                <Search/><span className="hidden md:inline-block">Filter</span>
              </Button> */}

              {/* dropdown for status filter */}
              <Select value={status || "all"} onValueChange={v => setStatus(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Status</SelectLabel>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/20 font-semibold ">
                <TableRow>
                  <TableHead className="w-[50px] py-2 text-center">#</TableHead>
                  <TableHead className="w-[250px] py-2">
                    <SortButton column="empNo" label="Employee No" sort={sort} order={order} sortBy={sortBy} />
                  </TableHead>
                  <TableHead className="w-[350px] py-2">
                    <SortButton column="employee.name" label="Name" sort={sort} order={order} sortBy={sortBy} />
                  </TableHead>
                  <TableHead className="w-[150px] py-2">
                    <SortButton column="employee.birthDate" label="Birth Date" sort={sort} order={order} sortBy={sortBy} />
                  </TableHead>
                  <TableHead className="w-[120px] py-2">
                    <SortButton column="employee.gender" label="Gender" sort={sort} order={order} sortBy={sortBy} />
                  </TableHead>
                  <TableHead className="py-2">
                    <SortButton column="department.name" label="Department" sort={sort} order={order} sortBy={sortBy} />
                  </TableHead>
                  <TableHead className="w-[120px] py-2">
                    <SortButton column="status" label="Status" sort={sort} order={order} sortBy={sortBy} />
                  </TableHead>
                  <TableHead className="w-[60px] py-2 text-center"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee, i) => (
                  <TableRow key={employee.id}>
                    <TableCell className="text-center">{(page - 1) * perPage + i + 1}</TableCell>
                    <TableCell className='font-medium'>
                      <Link to={`/console/modules/demo-module/employee/${employee.id}`} className='no-underline hover:underline'>
                        {employee.empNo}
                      </Link>
                    </TableCell>
                    <TableCell>{employee.bio.name}</TableCell>
                    <TableCell>{employee.bio.birthDate}</TableCell>
                    <TableCell>{employee.bio.gender}</TableCell>
                    <TableCell>{employee.department.name}</TableCell>
                    <TableCell><StatusBadge status={employee.status} /></TableCell>
                    <TableCell className="flex text-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="secondary" onClick={() => navigate(`/console/modules/demo-module/employee/${employee.id}/edit`)}><Pencil size={20} /></Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="destructive" onClick={() => onDelete(employee.id)}><X size={20} /></Button>
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
        description='This action cannot be undone. This will permanently delete the employee and remove all associated data.'
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

  )
}

export default withModuleAuthorization(Employee, {
  moduleId: 'demo-module',
  moduleName: 'Demo Module'
});