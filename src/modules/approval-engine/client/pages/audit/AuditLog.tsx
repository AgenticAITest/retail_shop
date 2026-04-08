import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import DataPagination from '@client/components/console/DataPagination';
import InputGroup from '@client/components/console/InputGroup';
import SortButton from '@client/components/console/SortButton';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@client/components/ui/alert-dialog';
import { Badge } from '@client/components/ui/badge';
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { useErrorHandler } from '@client/hooks/useErrorHandler';
import axios from 'axios';
import { ChevronDown, ChevronRight, Loader2, Search, X } from 'lucide-react';
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router';

interface AuditLogItem {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  module: string;
  entityType: string;
  entityId: string;
  before: any;
  after: any;
}

function truncateUuid(uuid: string): string {
  if (!uuid) return '';
  return uuid.length > 8 ? uuid.substring(0, 8) + '...' : uuid;
}

function getActionBadgeVariant(action: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (action) {
    case 'create':
      return 'default';
    case 'update':
      return 'secondary';
    case 'delete':
      return 'destructive';
    default:
      return 'outline';
  }
}

const AuditLog = () => {
  const { throwError } = useErrorHandler();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);

  const [logs, setLogs] = React.useState<AuditLogItem[]>([]);
  const [count, setCount] = React.useState(0);
  const [filter, setFilter] = React.useState(params.get('filter') || '');
  const [sort, setSort] = React.useState(params.get('sort') || 'timestamp');
  const [order, setOrder] = React.useState(params.get('order') || 'desc');
  const [page, setPage] = React.useState(Number(params.get('page')) || 1);
  const [perPage, setPerPage] = React.useState(Number(params.get('perPage')) || 10);

  const [moduleFilter, setModuleFilter] = React.useState('');
  const [actionFilter, setActionFilter] = React.useState('all');
  const [userFilter, setUserFilter] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');

  const [expandedRow, setExpandedRow] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  function gotoPage(p: number) {
    if (p < 1 || (count !== 0 && p > Math.ceil(count / perPage))) return;
    const urlParams = new URLSearchParams(window.location.search);
    setPage(p);
    urlParams.set('page', p.toString());
    urlParams.set('perPage', perPage.toString());
    urlParams.set('sort', sort);
    urlParams.set('order', order);
    urlParams.set('filter', filter);
    navigate(`${window.location.pathname}?${urlParams.toString()}`);
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

  function DebouncedInput({
    value: initialValue,
    onChange,
    debounce = 500,
    ...props
  }: {
    value: string | number;
    onChange: (value: string | number) => void;
    debounce?: number;
  } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>) {
    const [value, setValue] = React.useState(initialValue);

    React.useEffect(() => {
      setValue(initialValue);
    }, [initialValue]);

    React.useEffect(() => {
      const timeout = setTimeout(() => {
        onChange(value);
      }, debounce);
      return () => clearTimeout(timeout);
    }, [value]);

    return (
      <Input
        {...props}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 px-1 w-60 max-w-sm border-0 focus-visible:ring-0 shadow-none dark:bg-input/0"
      />
    );
  }

  function clearFilter() {
    setFilter('');
  }

  function toggleRowExpand(id: string) {
    setExpandedRow(expandedRow === id ? null : id);
  }

  useEffect(() => {
    gotoPage(1);
  }, [sort, order, filter, moduleFilter, actionFilter, userFilter, dateFrom, dateTo]);

  useEffect(() => {
    gotoPage(page);
  }, [page, perPage]);

  useEffect(() => {
    if (loading) {
      const requestParams: Record<string, any> = {
        page,
        perPage,
        sort,
        order,
        filter,
      };
      if (moduleFilter) {
        requestParams.module = moduleFilter;
      }
      if (actionFilter !== 'all') {
        requestParams.action = actionFilter;
      }
      if (userFilter) {
        requestParams.user = userFilter;
      }
      if (dateFrom) {
        requestParams.dateFrom = dateFrom;
      }
      if (dateTo) {
        requestParams.dateTo = dateTo;
      }

      axios
        .get('/api/modules/approval-engine/audit-log', { params: requestParams })
        .then((response) => {
          setLogs(response.data.logs || []);
          setCount(response.data.count || 0);
        })
        .catch((error) => {
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
          <h1 className="text-2xl font-semibold">Audit Log</h1>
        </div>
      </header>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Module</Label>
              <Input
                type="text"
                placeholder="Filter by module"
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Action</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">User</Label>
              <Input
                type="text"
                placeholder="Filter by user"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Date From</Label>
              <Input
                type="text"
                placeholder="YYYY-MM-DD"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Date To</Label>
              <Input
                type="text"
                placeholder="YYYY-MM-DD"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px]"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <InputGroup>
                <DebouncedInput
                  onChange={(value) => setFilter(String(value))}
                  placeholder="Search..."
                  type="text"
                  value={(filter ?? '') as string}
                />
                {filter !== '' && (
                  <X
                    size={20}
                    className="text-muted-foreground cursor-pointer mx-2 hover:text-foreground"
                    onClick={clearFilter}
                  />
                )}
                {filter === '' && (
                  <Search size={20} className="text-muted-foreground mx-2 hover:text-foreground" />
                )}
              </InputGroup>
            </div>
          </div>

          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/20 font-semibold">
                <TableRow>
                  <TableHead className="w-[40px] py-2"></TableHead>
                  <TableHead className="w-[50px] py-2 text-center">#</TableHead>
                  <TableHead className="py-2">
                    <SortButton column="timestamp" label="Timestamp" sort={sort} order={order} sortBy={sortBy} />
                  </TableHead>
                  <TableHead className="py-2">
                    <SortButton column="user" label="User" sort={sort} order={order} sortBy={sortBy} />
                  </TableHead>
                  <TableHead className="py-2">Action</TableHead>
                  <TableHead className="py-2">
                    <SortButton column="module" label="Module" sort={sort} order={order} sortBy={sortBy} />
                  </TableHead>
                  <TableHead className="py-2">Entity Type</TableHead>
                  <TableHead className="py-2">Entity ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((item, i) => (
                  <React.Fragment key={item.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleRowExpand(item.id)}
                    >
                      <TableCell className="text-center px-2">
                        {expandedRow === item.id ? (
                          <ChevronDown size={16} className="text-muted-foreground" />
                        ) : (
                          <ChevronRight size={16} className="text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">{(page - 1) * perPage + i + 1}</TableCell>
                      <TableCell>{new Date(item.timestamp).toLocaleString()}</TableCell>
                      <TableCell>{item.user}</TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(item.action)}>
                          {item.action.charAt(0).toUpperCase() + item.action.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.module}</TableCell>
                      <TableCell>{item.entityType}</TableCell>
                      <TableCell className="font-mono text-sm" title={item.entityId}>
                        {truncateUuid(item.entityId)}
                      </TableCell>
                    </TableRow>
                    {expandedRow === item.id && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/10 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Before</h4>
                              <pre className="bg-muted rounded-md p-3 text-xs overflow-auto max-h-[300px]">
                                {item.before
                                  ? JSON.stringify(item.before, null, 2)
                                  : 'N/A'}
                              </pre>
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold mb-2">After</h4>
                              <pre className="bg-muted rounded-md p-3 text-xs overflow-auto max-h-[300px]">
                                {item.after
                                  ? JSON.stringify(item.after, null, 2)
                                  : 'N/A'}
                              </pre>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
                {logs.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No audit log entries found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <DataPagination count={count} perPage={perPage} page={page} gotoPage={gotoPage} />
        </div>
      </div>

      <AlertDialog open={loading}>
        <AlertDialogContent>
          <AlertDialogHeader className="flex w-full items-center text-center">
            <AlertDialogTitle className="flex items-center gap-2">
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

export default withModuleAuthorization(AuditLog, {
  moduleId: 'approval-engine',
  moduleName: 'Approval Engine',
});
