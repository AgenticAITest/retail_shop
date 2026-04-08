import Authorized from '@client/components/auth/Authorized';
import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import Breadcrumbs, { createBreadcrumbItems, useBreadcrumbs } from '@client/components/console/Breadcrumbs';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from '@client/components/ui/alert-dialog';
import { Button } from '@client/components/ui/button';
import { Label } from '@client/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { Textarea } from '@client/components/ui/textarea';
import axios from 'axios';
import { Check, ChevronDown, ChevronUp, Download, FileText, Pencil, Send, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  sent: 'Sent to Supplier',
  partially_received: 'Partially Received',
  fully_received: 'Fully Received',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  pending_approval: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  sent: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  partially_received: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  fully_received: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  closed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const LIFECYCLE_STAGES = ['draft', 'pending_approval', 'approved', 'sent', 'partially_received', 'fully_received', 'closed'];

function formatIDR(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const PurchaseOrderView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [po, setPo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showAmendments, setShowAmendments] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const { items: breadcrumbs, updateItem } = useBreadcrumbs(
    createBreadcrumbItems([
      {
        label: "Purchase Orders",
        onClick: () => navigate("/console/modules/purchase-order/po"),
      },
      { label: "View PO" },
    ])
  );

  function loadPo() {
    setLoading(true);
    axios.get(`/api/modules/purchase-order/po/${id}`)
      .then(res => {
        setPo(res.data);
        updateItem(1, { label: res.data.poNumber });
      })
      .catch(err => {
        console.error("Error loading PO:", err);
        toast.error("Failed to load purchase order.");
        navigate("/console/modules/purchase-order/po");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadPo();
  }, [id]);

  function transitionStatus(targetStatus: string, reason?: string) {
    setTransitioning(true);
    axios.put(`/api/modules/purchase-order/po/${id}/status`, { status: targetStatus, reason })
      .then(res => {
        if (res.status === 202) {
          toast.info("Approval required. Your request has been submitted for review.");
        } else {
          toast.success(`Status updated to ${STATUS_LABELS[targetStatus] || targetStatus}.`);
        }
        loadPo();
      })
      .catch(err => {
        const msg = err.response?.data?.error || "Failed to update status.";
        toast.error(msg);
      })
      .finally(() => setTransitioning(false));
  }

  function handleCancel() {
    if (!cancelReason.trim()) {
      toast.error("Cancellation reason is required.");
      return;
    }
    transitionStatus('cancelled', cancelReason);
    setShowCancelDialog(false);
    setCancelReason('');
  }

  async function handleDownloadPdf() {
    try {
      const { generatePoPdf } = await import('../../lib/generatePoPdf');
      generatePoPdf(po);
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Failed to generate PDF. Ensure jsPDF is installed.");
    }
  }

  if (loading || !po) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const currentStageIndex = LIFECYCLE_STAGES.indexOf(po.status);
  const isCancelled = po.status === 'cancelled';

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Purchase Orders</h1>
        </div>
        <div className="ml-auto px-4">
          <div className="flex items-center gap-2 text-sm">
            <Breadcrumbs items={breadcrumbs} loading={loading} />
          </div>
        </div>
      </header>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">

          {/* Status Timeline */}
          <div className="bg-card rounded-lg border p-4">
            {isCancelled ? (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <X size={20} />
                <span className="font-medium">This purchase order has been cancelled.</span>
                {po.cancellationReason && (
                  <span className="text-sm text-muted-foreground ml-2">Reason: {po.cancellationReason}</span>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between overflow-x-auto gap-1">
                {LIFECYCLE_STAGES.map((stage, idx) => {
                  const isCompleted = idx < currentStageIndex;
                  const isCurrent = idx === currentStageIndex;
                  return (
                    <div key={stage} className="flex items-center flex-1 min-w-0">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 ${
                          isCompleted
                            ? 'bg-green-500 border-green-500 text-white'
                            : isCurrent
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'bg-muted border-muted-foreground/30 text-muted-foreground'
                        }`}>
                          {isCompleted ? <Check size={14} /> : idx + 1}
                        </div>
                        <span className={`text-[10px] mt-1 text-center whitespace-nowrap ${
                          isCurrent ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
                        }`}>
                          {STATUS_LABELS[stage]}
                        </span>
                      </div>
                      {idx < LIFECYCLE_STAGES.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-1 ${isCompleted ? 'bg-green-500' : 'bg-muted-foreground/20'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            {po.status === 'draft' && (
              <Authorized roles="ADMIN" permissions="retail.po.approve">
                <Button onClick={() => transitionStatus('approved')} disabled={transitioning}>
                  <Check size={16} className="mr-1" /> Approve
                </Button>
              </Authorized>
            )}
            {po.status === 'approved' && (
              <Authorized roles="ADMIN" permissions="retail.po.send">
                <Button onClick={() => transitionStatus('sent')} disabled={transitioning}>
                  <Send size={16} className="mr-1" /> Mark as Sent
                </Button>
              </Authorized>
            )}
            {po.status === 'pending_approval' && (
              <>
                <Authorized roles="ADMIN" permissions="retail.po.approve">
                  <Button onClick={() => transitionStatus('approved')} disabled={transitioning}>
                    <Check size={16} className="mr-1" /> Approve
                  </Button>
                </Authorized>
                <Authorized roles="ADMIN" permissions="retail.po.approve">
                  <Button variant="outline" onClick={() => transitionStatus('draft')} disabled={transitioning}>
                    Reject (Back to Draft)
                  </Button>
                </Authorized>
              </>
            )}
            {po.status === 'fully_received' && (
              <Button onClick={() => transitionStatus('closed')} disabled={transitioning}>
                Close PO
              </Button>
            )}
            {(po.status === 'draft' || po.status === 'approved') && (
              <>
                <Authorized roles="ADMIN" permissions="retail.po.edit">
                  <Button variant="outline" onClick={() => navigate(`/console/modules/purchase-order/po/${id}/edit`)}>
                    <Pencil size={16} className="mr-1" /> Edit
                  </Button>
                </Authorized>
                <Authorized roles="ADMIN" permissions="retail.po.delete">
                  <Button variant="destructive" onClick={() => setShowCancelDialog(true)}>
                    <X size={16} className="mr-1" /> Cancel PO
                  </Button>
                </Authorized>
              </>
            )}
            <Button variant="outline" onClick={handleDownloadPdf}>
              <Download size={16} className="mr-1" /> Download PDF
            </Button>
          </div>

          {/* PO Header */}
          <div className="bg-card rounded-lg border p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-muted-foreground">PO Number</Label>
                <p className="font-semibold text-lg">{po.poNumber}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <p>
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[po.status] || ''}`}>
                    {STATUS_LABELS[po.status] || po.status}
                  </span>
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Version</Label>
                <p>v{po.version}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Supplier</Label>
                <p>{po.supplier?.name || '-'} ({po.supplier?.code || ''})</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Delivery Location</Label>
                <p>{po.location?.name || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Created By</Label>
                <p>{po.createdByUser?.fullname || po.createdByUser?.username || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Order Date</Label>
                <p>{formatDate(po.orderDate)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Expected Delivery</Label>
                <p>{formatDate(po.expectedDeliveryDate)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Tax Rate</Label>
                <p>{po.taxRatePercent ? `${po.taxRatePercent}% (${po.taxCalcMode})` : 'N/A'}</p>
              </div>
              {po.notes && (
                <div className="md:col-span-3">
                  <Label className="text-muted-foreground">Notes</Label>
                  <p>{po.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-card rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="font-medium">Line Items</h3>
            </div>
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead className="w-[50px] text-center">#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Disc %</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(po.items || []).map((item: any, i: number) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center">{i + 1}</TableCell>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell className="text-muted-foreground">{item.skuCode}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{item.receivedQuantity}</TableCell>
                    <TableCell className="text-right font-medium">{item.quantity - item.receivedQuantity}</TableCell>
                    <TableCell className="text-right">{formatIDR(item.unitPrice)}</TableCell>
                    <TableCell className="text-right">{item.discountPercent}%</TableCell>
                    <TableCell className="text-right">{formatIDR(item.taxAmount)}</TableCell>
                    <TableCell className="text-right font-medium">{formatIDR(item.lineTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end p-4 border-t">
              <div className="w-72 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>{formatIDR(po.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount:</span>
                  <span className="text-red-600">-{formatIDR(po.discountAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax (PPN):</span>
                  <span>{formatIDR(po.taxAmount)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold text-base">
                  <span>Total:</span>
                  <span>{formatIDR(po.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Amendment History */}
          {po.amendments && po.amendments.length > 0 && (
            <div className="bg-card rounded-lg border">
              <button
                className="w-full flex items-center justify-between p-4 text-left"
                onClick={() => setShowAmendments(!showAmendments)}
              >
                <h3 className="font-medium">Amendment History ({po.amendments.length})</h3>
                {showAmendments ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {showAmendments && (
                <div className="border-t">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow>
                        <TableHead>Version</TableHead>
                        <TableHead>Changed By</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {po.amendments.map((amendment: any) => (
                        <TableRow key={amendment.id}>
                          <TableCell>v{amendment.version}</TableCell>
                          <TableCell>{amendment.changedByUser?.fullname || amendment.changedBy}</TableCell>
                          <TableCell>{amendment.changeReason || '-'}</TableCell>
                          <TableCell>{formatDateTime(amendment.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {/* Cancellation Info */}
          {isCancelled && po.cancelledByUser && (
            <div className="bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800 p-4">
              <h3 className="font-medium text-red-800 dark:text-red-200">Cancellation Details</h3>
              <div className="mt-2 text-sm space-y-1">
                <p><span className="text-muted-foreground">Cancelled by:</span> {po.cancelledByUser.fullname || po.cancelledByUser.username}</p>
                <p><span className="text-muted-foreground">Cancelled at:</span> {formatDateTime(po.cancelledAt)}</p>
                <p><span className="text-muted-foreground">Reason:</span> {po.cancellationReason}</p>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Cancel Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Please provide a reason for cancellation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason <span className="text-red-500">*</span></Label>
            <Textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Enter cancellation reason..."
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default withModuleAuthorization(PurchaseOrderView, {
  moduleId: 'purchase-order',
  moduleName: 'Purchase Order'
});
