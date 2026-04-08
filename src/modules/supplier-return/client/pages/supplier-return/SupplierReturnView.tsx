import Authorized from '@client/components/auth/Authorized';
import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import Breadcrumbs, { createBreadcrumbItems, useBreadcrumbs } from '@client/components/console/Breadcrumbs';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from '@client/components/ui/alert-dialog';
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { Textarea } from '@client/components/ui/textarea';
import axios from 'axios';
import { Check, ClipboardList, Download, Package, Send, ShieldCheck, ThumbsUp, Truck, X, CreditCard, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

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

const LIFECYCLE_STAGES = ['requested', 'pending_approval', 'approved', 'dispatched', 'acknowledged', 'credit_note_received', 'closed'];

const REASON_LABELS: Record<string, string> = {
  defective: 'Defective', damaged: 'Damaged', expired: 'Expired',
  excess: 'Excess Stock', wrong_item: 'Wrong Item',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const SupplierReturnView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [sr, setSr] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showCreditNoteDialog, setShowCreditNoteDialog] = useState(false);
  const [creditNoteNumber, setCreditNoteNumber] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDate, setCreditDate] = useState(new Date().toISOString().split('T')[0]);
  const [creditNotes, setCreditNotes] = useState('');
  const [isReplacement, setIsReplacement] = useState(false);

  const { items: breadcrumbs, updateItem } = useBreadcrumbs(
    createBreadcrumbItems([
      { label: "Returns List", onClick: () => navigate("/console/modules/supplier-return/return") },
      { label: "View Return" },
    ])
  );

  function loadReturn() {
    setLoading(true);
    axios.get(`/api/modules/supplier-return/return/${id}`)
      .then(res => { setSr(res.data); updateItem(1, { label: res.data.returnNumber }); })
      .catch(() => { toast.error("Failed to load supplier return."); navigate("/console/modules/supplier-return/return"); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadReturn(); }, [id]);

  function transitionStatus(targetStatus: string, extra?: any) {
    setTransitioning(true);
    axios.put(`/api/modules/supplier-return/return/${id}/status`, { status: targetStatus, ...extra })
      .then(() => {
        toast.success(`Status updated to ${STATUS_LABELS[targetStatus] || targetStatus}.`);
        loadReturn();
      })
      .catch(err => { toast.error(err.response?.data?.error || "Failed to update status."); })
      .finally(() => setTransitioning(false));
  }

  function handleReject() {
    transitionStatus('rejected', { rejectionReason });
    setShowRejectDialog(false);
    setRejectionReason('');
  }

  function handleCreateCreditNote() {
    if (!creditNoteNumber || !creditAmount || !creditDate) {
      toast.error("Please fill in all required credit note fields.");
      return;
    }

    axios.post('/api/modules/supplier-return/credit-note', {
      supplierReturnId: id,
      creditNoteNumber,
      amount: parseFloat(creditAmount),
      creditDate,
      notes: creditNotes || null,
      isReplacement,
    })
      .then(() => {
        toast.success("Credit note recorded successfully.");
        setShowCreditNoteDialog(false);
        setCreditNoteNumber('');
        setCreditAmount('');
        setCreditNotes('');
        setIsReplacement(false);
        loadReturn();
      })
      .catch(err => {
        toast.error(err.response?.data?.error || "Failed to record credit note.");
      });
  }

  async function handleDownloadPdf() {
    try {
      const { generateReturnPdf } = await import('../../lib/generateReturnPdf');
      generateReturnPdf(sr);
    } catch (err) {
      toast.error("Failed to generate PDF.");
    }
  }

  if (loading || !sr) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  const currentStageIndex = LIFECYCLE_STAGES.indexOf(sr.status);
  const isRejected = sr.status === 'rejected';

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <h1 className="text-2xl font-semibold">Supplier Returns</h1>
        <div className="ml-auto px-4"><Breadcrumbs items={breadcrumbs} loading={loading} /></div>
      </header>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">

          {/* Status Timeline */}
          {!isRejected && (
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between overflow-x-auto gap-1">
                {LIFECYCLE_STAGES.map((stage, idx) => {
                  const isCompleted = idx < currentStageIndex;
                  const isCurrent = idx === currentStageIndex;
                  return (
                    <div key={stage} className="flex items-center flex-1 min-w-0">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 ${
                          isCompleted ? 'bg-green-500 border-green-500 text-white'
                          : isCurrent ? 'bg-blue-500 border-blue-500 text-white'
                          : 'bg-muted border-muted-foreground/30 text-muted-foreground'
                        }`}>
                          {isCompleted ? <Check size={14} /> : idx + 1}
                        </div>
                        <span className={`text-[10px] mt-1 text-center whitespace-nowrap ${isCurrent ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}>
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
            </div>
          )}

          {/* Rejected Banner */}
          {isRejected && (
            <div className="bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800 p-4">
              <h3 className="font-medium text-red-700 dark:text-red-300">Return Rejected</h3>
              {sr.rejectionReason && <p className="text-sm mt-1 text-red-600 dark:text-red-400">{sr.rejectionReason}</p>}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            {sr.status === 'requested' && (
              <Authorized roles="ADMIN" permissions="retail.supplier-return.transition">
                <Button onClick={() => transitionStatus('pending_approval')} disabled={transitioning}>
                  <ClipboardList size={16} className="mr-1" /> Submit for Approval
                </Button>
                <Button variant="outline" onClick={() => transitionStatus('approved')} disabled={transitioning}>
                  <ShieldCheck size={16} className="mr-1" /> Approve (Skip)
                </Button>
                <Button variant="destructive" onClick={() => setShowRejectDialog(true)} disabled={transitioning}>
                  <X size={16} className="mr-1" /> Reject
                </Button>
              </Authorized>
            )}
            {sr.status === 'pending_approval' && (
              <Authorized roles="ADMIN" permissions="retail.supplier-return.transition">
                <Button onClick={() => transitionStatus('approved')} disabled={transitioning}>
                  <ShieldCheck size={16} className="mr-1" /> Approve
                </Button>
                <Button variant="destructive" onClick={() => setShowRejectDialog(true)} disabled={transitioning}>
                  <X size={16} className="mr-1" /> Reject
                </Button>
              </Authorized>
            )}
            {sr.status === 'approved' && (
              <Authorized roles="ADMIN" permissions="retail.supplier-return.transition">
                <Button onClick={() => transitionStatus('dispatched')} disabled={transitioning}>
                  <Truck size={16} className="mr-1" /> Mark Dispatched
                </Button>
              </Authorized>
            )}
            {sr.status === 'dispatched' && (
              <Authorized roles="ADMIN" permissions="retail.supplier-return.transition">
                <Button onClick={() => transitionStatus('acknowledged')} disabled={transitioning}>
                  <ThumbsUp size={16} className="mr-1" /> Mark Acknowledged
                </Button>
              </Authorized>
            )}
            {sr.status === 'acknowledged' && (
              <Authorized roles="ADMIN" permissions="retail.supplier-return.transition">
                <Button onClick={() => setShowCreditNoteDialog(true)} disabled={transitioning}>
                  <CreditCard size={16} className="mr-1" /> Record Credit Note
                </Button>
                <Button variant="outline" onClick={() => transitionStatus('closed')} disabled={transitioning}>
                  <Lock size={16} className="mr-1" /> Close (No Credit)
                </Button>
              </Authorized>
            )}
            {sr.status === 'credit_note_received' && (
              <Authorized roles="ADMIN" permissions="retail.supplier-return.transition">
                <Button onClick={() => setShowCreditNoteDialog(true)} disabled={transitioning}>
                  <CreditCard size={16} className="mr-1" /> Add Credit Note
                </Button>
                <Button variant="outline" onClick={() => transitionStatus('closed')} disabled={transitioning}>
                  <Lock size={16} className="mr-1" /> Close Return
                </Button>
              </Authorized>
            )}
            <Button variant="outline" onClick={handleDownloadPdf}>
              <Download size={16} className="mr-1" /> Download PDF
            </Button>
          </div>

          {/* Return Header */}
          <div className="bg-card rounded-lg border p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-muted-foreground">Return Number</Label>
                <p className="font-semibold text-lg">{sr.returnNumber}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <p><span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[sr.status] || ''}`}>{STATUS_LABELS[sr.status]}</span></p>
              </div>
              <div>
                <Label className="text-muted-foreground">GRN</Label>
                <p><Link to={`/console/modules/grn/grn/${sr.grnId}`} className="text-blue-600 hover:underline">{sr.grn?.grnNumber || '-'}</Link></p>
              </div>
              <div>
                <Label className="text-muted-foreground">Purchase Order</Label>
                <p><Link to={`/console/modules/purchase-order/po/${sr.purchaseOrderId}`} className="text-blue-600 hover:underline">{sr.purchaseOrder?.poNumber || '-'}</Link></p>
              </div>
              <div>
                <Label className="text-muted-foreground">Supplier</Label>
                <p>{sr.supplier?.name || '-'} ({sr.supplier?.code || ''})</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Location</Label>
                <p>{sr.location?.name || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Return Date</Label>
                <p>{formatDate(sr.returnDate)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Created By</Label>
                <p>{sr.createdByUser?.fullname || sr.createdByUser?.username || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Created At</Label>
                <p>{formatDateTime(sr.createdAt)}</p>
              </div>
              {sr.dispatchedAt && (
                <div>
                  <Label className="text-muted-foreground">Dispatched At</Label>
                  <p>{formatDateTime(sr.dispatchedAt)}</p>
                </div>
              )}
              {sr.acknowledgedAt && (
                <div>
                  <Label className="text-muted-foreground">Acknowledged At</Label>
                  <p>{formatDateTime(sr.acknowledgedAt)}</p>
                </div>
              )}
              {sr.closedAt && (
                <div>
                  <Label className="text-muted-foreground">Closed At</Label>
                  <p>{formatDateTime(sr.closedAt)}</p>
                </div>
              )}
              {sr.notes && (
                <div className="md:col-span-3">
                  <Label className="text-muted-foreground">Notes</Label>
                  <p>{sr.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Return Items */}
          <div className="bg-card rounded-lg border">
            <div className="p-4 border-b"><h3 className="font-medium">Return Items</h3></div>
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead className="w-[50px] text-center">#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sr.items || []).map((item: any, i: number) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center">{i + 1}</TableCell>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell className="text-muted-foreground">{item.skuCode}</TableCell>
                    <TableCell className="text-right font-medium">{item.returnQuantity}</TableCell>
                    <TableCell>{item.uom}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                        {REASON_LABELS[item.reasonCode] || item.reasonCode}
                      </span>
                    </TableCell>
                    <TableCell>{item.reasonNotes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Credit Notes Section */}
          {(sr.creditNotes || []).length > 0 && (
            <div className="bg-card rounded-lg border">
              <div className="p-4 border-b"><h3 className="font-medium">Credit Notes</h3></div>
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead className="w-[50px] text-center">#</TableHead>
                    <TableHead>Credit Note #</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Recorded By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sr.creditNotes.map((cn: any, i: number) => (
                    <TableRow key={cn.id}>
                      <TableCell className="text-center">{i + 1}</TableCell>
                      <TableCell className="font-medium">{cn.creditNoteNumber}</TableCell>
                      <TableCell className="text-right font-medium">
                        {Number(cn.amount).toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}
                      </TableCell>
                      <TableCell>{formatDate(cn.creditDate)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${cn.isReplacement ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'}`}>
                          {cn.isReplacement ? 'Replacement' : 'Credit'}
                        </span>
                      </TableCell>
                      <TableCell>{cn.notes || '-'}</TableCell>
                      <TableCell>{cn.createdByUser?.fullname || cn.createdByUser?.username || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Supplier Return</AlertDialogTitle>
            <AlertDialogDescription>Provide a reason for rejecting this return request.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <Textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="Reason for rejection..." rows={3} />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Reject</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Credit Note Dialog */}
      <AlertDialog open={showCreditNoteDialog} onOpenChange={setShowCreditNoteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Record Credit Note</AlertDialogTitle>
            <AlertDialogDescription>Record a credit note or replacement receipt from the supplier.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Credit Note Number <span className="text-red-500">*</span></Label>
              <Input value={creditNoteNumber} onChange={e => setCreditNoteNumber(e.target.value)} placeholder="Supplier's credit note number" />
            </div>
            <div className="space-y-2">
              <Label>Amount (IDR) <span className="text-red-500">*</span></Label>
              <Input type="number" min={0} step="0.01" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Credit Date <span className="text-red-500">*</span></Label>
              <Input type="date" value={creditDate} onChange={e => setCreditDate(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isReplacement" checked={isReplacement} onChange={e => setIsReplacement(e.target.checked)} className="rounded border-gray-300" />
              <Label htmlFor="isReplacement">This is a replacement receipt (not a monetary credit)</Label>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={creditNotes} onChange={e => setCreditNotes(e.target.value)} placeholder="Additional details..." rows={2} />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateCreditNote}>Record Credit Note</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default withModuleAuthorization(SupplierReturnView, { moduleId: 'supplier-return', moduleName: 'Supplier Returns & Credit Notes' });
