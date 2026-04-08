import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import DataPagination from '@client/components/console/DataPagination';
import InputGroup from '@client/components/console/InputGroup';
import SortButton from '@client/components/console/SortButton';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@client/components/ui/alert-dialog';
import { Badge } from '@client/components/ui/badge';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { useErrorHandler } from '@client/hooks/useErrorHandler';
import axios from 'axios';
import { Loader2, Search, X } from 'lucide-react';
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router';

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  purchase_order: 'Purchase Order',
  grn: 'Goods Received Note',
  supplier_return: 'Supplier Return',
  stock_transfer: 'Stock Transfer',
  stock_adjustment: 'Stock Adjustment',
  pos_refund: 'POS Refund',
  pos_discount: 'POS Discount',
};

interface ApprovalHistoryItem {
  id: string;
  transactionType: string;
  transactionId: string;
  requestedBy: string;
  actionedBy: string;
  action: string;
  reason: string | null;
  createdAt: string;
}

function formatTransactionType(type: string): string {
  return TRANSACTION_TYPE_LABELS[type] || type;
}

function truncateUuid(uuid: string): string {
  if (!uuid) return '';
  return uuid.length > 8 ? uuid.substring(0, 8) + '...' : uuid;
}

const ApprovalHistory = () => {
  const { throwError } = useErrorHandler();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);

  const [history, setHistory] = React.useState<ApprovalHistoryItem[]>([]);
  const [count, setCount] = React.useState(0);
  const [filter, setFilter] = React.useState(params.get('filter') || '');
  const [sort, setSort] = React.useState(params.get('sort') || 'createdAt');
  const [order, setOrder] = React.useState(params.get('order') || 'desc');
  const [page, setPage] = React.useState(Number(params.get('page')) || 1);
  const [perPage, setPerPage] = React.useState(Number(params.get('perPage')) || 10);

  const [transactionTypeFilter, setTransactionTypeFilter] = React.useState('all');
  const [actionFilter, setActionFilter] = React.useState('all');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');

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

  useEffect(() => {
    gotoPage(1);
  }, [sort, order, filter, transactionTypeFilter, actionFilter, dateFrom, dateTo]);

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
      if (transactionTypeFilter !== 'all') {
        requestParams.transactionType = transactionTypeFilter;
      }
      if (actionFilter !== 'all') {
        requestParams.action = actionFilter;
      }
      if (dateFrom) {
        requestParams.dateFrom = dateFrom;
      }
      if (dateTo) {
        requestParams.dateTo = dateTo;
      }

      axios
        .get('/api/modules/approval-engine/approval/history', { params: requestParams })
        .then((response) => {
          setHistory(response.data.approvals || []);
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
          <h1 className="text-2xl font-semibold">Approval History</h1>
        </div>
      </header>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Transaction Type</Label>
              <Select value={transactionTypeFilter} onValueChange={setTransactionTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(TRANSACTION_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Action</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
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
                  <TableHead className="w-[50px] py-2 text-center">#</TableHead>
                  <TableHead className="py-2">
                    <SortButton column="transactionType" label="Transaction Type" sort={sort} order={order} sortBy={sortBy} />
                  </TableHead>
                  <TableHead className="py-2">Transaction ID</TableHead>
                  <TableHead className="py-2">
                    <SortButton column="requestedBy" label="Requested By" sort={sort} order={order} sortBy={sortBy} />
                  </TableHead>
                  <TableHead className="py-2">
                    <SortButton column="actionedBy" label="Actioned By" sort={sort} order={order} sortBy={sortBy} />
                  </TableHead>
                  <TableHead className="py-2">Action</TableHead>
                  <TableHead className="py-2">Reason</TableHead>
                  <TableHead className="py-2">
                    <SortButton column="createdAt" label="Date" sort={sort} order={order} sortBy={sortBy} />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item, i) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center">{(page - 1) * perPage + i + 1}</TableCell>
                    <TableCell className="font-medium">
                      {formatTransactionType(item.transactionType)}
                    </TableCell>
                    <TableCell className="font-mono text-sm" title={item.transactionId}>
                      {truncateUuid(item.transactionId)}
                    </TableCell>
                    <TableCell>{item.requestedBy}</TableCell>
                    <TableCell>{item.actionedBy}</TableCell>
                    <TableCell>
                      {item.action === 'approved' ? (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-transparent">
                          Approved
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Rejected</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={item.reason || ''}>
                      {item.reason || '-'}
                    </TableCell>
                    <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {history.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No approval history found.
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

export default withModuleAuthorization(ApprovalHistory, {
  moduleId: 'approval-engine',
  moduleName: 'Approval Engine',
});
