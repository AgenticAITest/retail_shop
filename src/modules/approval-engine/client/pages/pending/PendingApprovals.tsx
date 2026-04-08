import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import ConfirmDialog from '@client/components/console/ConfirmDialog';
import DataPagination from '@client/components/console/DataPagination';
import InputGroup from '@client/components/console/InputGroup';
import SortButton from '@client/components/console/SortButton';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@client/components/ui/alert-dialog';
import { Badge } from '@client/components/ui/badge';
import { Button } from '@client/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@client/components/ui/dialog';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { Textarea } from '@client/components/ui/textarea';
import { useErrorHandler } from '@client/hooks/useErrorHandler';
import axios from 'axios';
import { Check, Loader2, Search, X, XCircle } from 'lucide-react';
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  purchase_order: 'Purchase Order',
  grn: 'Goods Received Note',
  supplier_return: 'Supplier Return',
  stock_transfer: 'Stock Transfer',
  stock_adjustment: 'Stock Adjustment',
  pos_refund: 'POS Refund',
  pos_discount: 'POS Discount',
};

interface PendingApprovalItem {
  id: string;
  transactionType: string;
  transactionId: string;
  requestedBy: string;
  requestedAt: string;
}

function formatTransactionType(type: string): string {
  return TRANSACTION_TYPE_LABELS[type] || type;
}

function truncateUuid(uuid: string): string {
  if (!uuid) return '';
  return uuid.length > 8 ? uuid.substring(0, 8) + '...' : uuid;
}

function formatAge(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMinutes > 0) return `${diffMinutes}m ago`;
  return 'Just now';
}

const PendingApprovals = () => {
  const { throwError } = useErrorHandler();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);

  const [approvals, setApprovals] = React.useState<PendingApprovalItem[]>([]);
  const [count, setCount] = React.useState(0);
  const [filter, setFilter] = React.useState(params.get('filter') || '');
  const [sort, setSort] = React.useState(params.get('sort') || 'requestedAt');
  const [order, setOrder] = React.useState(params.get('order') || 'desc');
  const [page, setPage] = React.useState(Number(params.get('page')) || 1);
  const [perPage, setPerPage] = React.useState(Number(params.get('perPage')) || 10);

  const [loading, setLoading] = React.useState(false);

  // Approve dialog
  const [confirmApproveOpen, setConfirmApproveOpen] = React.useState(false);
  const [selectedApprovalId, setSelectedApprovalId] = React.useState<string | null>(null);

  // Reject dialog
  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState('');

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

  function onApprove(approvalId: string) {
    setSelectedApprovalId(approvalId);
    setConfirmApproveOpen(true);
  }

  function onConfirmApprove() {
    if (!selectedApprovalId) return;
    axios
      .post(`/api/modules/approval-engine/approval/${selectedApprovalId}/approve`)
      .then(() => {
        toast.success('Approval granted successfully');
        setLoading(true);
      })
      .catch(() => {
        toast.error('Failed to approve');
      })
      .finally(() => {
        setConfirmApproveOpen(false);
        setSelectedApprovalId(null);
      });
  }

  function onReject(approvalId: string) {
    setSelectedApprovalId(approvalId);
    setRejectReason('');
    setRejectDialogOpen(true);
  }

  function onConfirmReject() {
    if (!selectedApprovalId || !rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    axios
      .post(`/api/modules/approval-engine/approval/${selectedApprovalId}/reject`, {
        reason: rejectReason.trim(),
      })
      .then(() => {
        toast.success('Approval rejected successfully');
        setLoading(true);
      })
      .catch(() => {
        toast.error('Failed to reject');
      })
      .finally(() => {
        setRejectDialogOpen(false);
        setSelectedApprovalId(null);
        setRejectReason('');
      });
  }

  function clearFilter() {
    setFilter('');
  }

  useEffect(() => {
    gotoPage(1);
  }, [sort, order, filter]);

  useEffect(() => {
    gotoPage(page);
  }, [page, perPage]);

  useEffect(() => {
    if (loading) {
      axios
        .get('/api/modules/approval-engine/approval/pending', {
          params: { page, perPage, sort, order, filter },
        })
        .then((response) => {
          setApprovals(response.data.approvals || []);
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
          <h1 className="text-2xl font-semibold">
            Pending Approvals{' '}
            {count > 0 && (
              <Badge variant="secondary" className="ml-2 text-sm">
                {count}
              </Badge>
            )}
          </h1>
        </div>
      </header>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          <div className="flex gap-2">
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
                    <SortButton column="requestedAt" label="Requested At" sort={sort} order={order} sortBy={sortBy} />
                  </TableHead>
                  <TableHead className="py-2">Age</TableHead>
                  <TableHead className="py-2 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvals.map((item, i) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center">{(page - 1) * perPage + i + 1}</TableCell>
                    <TableCell className="font-medium">
                      {formatTransactionType(item.transactionType)}
                    </TableCell>
                    <TableCell className="font-mono text-sm" title={item.transactionId}>
                      {truncateUuid(item.transactionId)}
                    </TableCell>
                    <TableCell>{item.requestedBy}</TableCell>
                    <TableCell>
                      {new Date(item.requestedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatAge(item.requestedAt)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => onApprove(item.id)}
                        >
                          <Check size={16} className="mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onReject(item.id)}
                        >
                          <XCircle size={16} className="mr-1" /> Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {approvals.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No pending approvals found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <DataPagination count={count} perPage={perPage} page={page} gotoPage={gotoPage} />
        </div>
      </div>

      <ConfirmDialog
        title="Confirm Approval"
        description="Are you sure you want to approve this transaction? This action cannot be undone."
        open={confirmApproveOpen}
        onOpenChange={setConfirmApproveOpen}
        onConfirm={onConfirmApprove}
      />

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Approval</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this transaction.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="mt-2"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirmReject}
              disabled={!rejectReason.trim()}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

export default withModuleAuthorization(PendingApprovals, {
  moduleId: 'approval-engine',
  moduleName: 'Approval Engine',
});
