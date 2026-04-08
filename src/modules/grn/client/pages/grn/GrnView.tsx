import Authorized from '@client/components/auth/Authorized';
import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import Breadcrumbs, { createBreadcrumbItems, useBreadcrumbs } from '@client/components/console/Breadcrumbs';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from '@client/components/ui/alert-dialog';
import { Button } from '@client/components/ui/button';
import { Label } from '@client/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { Textarea } from '@client/components/ui/textarea';
import axios from 'axios';
import { Check, ClipboardCheck, Download, Eye, PackageCheck, RotateCcw, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  quality_inspection: 'Quality Inspection',
  accepted: 'Accepted',
  stock_updated: 'Stock Updated',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  quality_inspection: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  accepted: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  stock_updated: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
};

const LIFECYCLE_STAGES = ['draft', 'quality_inspection', 'accepted', 'stock_updated'];

const REJECTION_LABELS: Record<string, string> = {
  defective: 'Defective', damaged: 'Damaged', expired: 'Expired',
  wrong_item: 'Wrong Item', short_quantity: 'Short Quantity', other: 'Other',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const GrnView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [grn, setGrn] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [showQiDialog, setShowQiDialog] = useState(false);
  const [qualityNotes, setQualityNotes] = useState('');
  const [qualityPassed, setQualityPassed] = useState(true);

  const { items: breadcrumbs, updateItem } = useBreadcrumbs(
    createBreadcrumbItems([
      { label: "GRN List", onClick: () => navigate("/console/modules/grn/grn") },
      { label: "View GRN" },
    ])
  );

  function loadGrn() {
    setLoading(true);
    axios.get(`/api/modules/grn/grn/${id}`)
      .then(res => { setGrn(res.data); updateItem(1, { label: res.data.grnNumber }); })
      .catch(() => { toast.error("Failed to load GRN."); navigate("/console/modules/grn/grn"); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadGrn(); }, [id]);

  function transitionStatus(targetStatus: string, extra?: any) {
    setTransitioning(true);
    axios.put(`/api/modules/grn/grn/${id}/status`, { status: targetStatus, ...extra })
      .then(res => {
        const msg = res.data.message || `Status updated to ${STATUS_LABELS[targetStatus] || targetStatus}.`;
        toast.success(msg);
        loadGrn();
      })
      .catch(err => { toast.error(err.response?.data?.error || "Failed to update status."); })
      .finally(() => setTransitioning(false));
  }

  function handleQiAccept() {
    transitionStatus('accepted', { qualityCheckPassed: qualityPassed, qualityNotes });
    setShowQiDialog(false);
    setQualityNotes('');
  }

  async function handleDownloadPdf() {
    try {
      const { generateGrnPdf } = await import('../../lib/generateGrnPdf');
      generateGrnPdf(grn);
    } catch (err) {
      toast.error("Failed to generate PDF.");
    }
  }

  if (loading || !grn) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  const currentStageIndex = LIFECYCLE_STAGES.indexOf(grn.status);

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <h1 className="text-2xl font-semibold">Goods Received Notes</h1>
        <div className="ml-auto px-4"><Breadcrumbs items={breadcrumbs} loading={loading} /></div>
      </header>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">

          {/* Status Timeline */}
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

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            {grn.status === 'draft' && (
              <>
                <Button onClick={() => transitionStatus('quality_inspection')} disabled={transitioning}>
                  <ClipboardCheck size={16} className="mr-1" /> Send to QI
                </Button>
                <Button variant="outline" onClick={() => transitionStatus('accepted')} disabled={transitioning}>
                  <ShieldCheck size={16} className="mr-1" /> Accept (Skip QI)
                </Button>
              </>
            )}
            {grn.status === 'quality_inspection' && (
              <>
                <Button onClick={() => setShowQiDialog(true)} disabled={transitioning}>
                  <Check size={16} className="mr-1" /> Mark Accepted
                </Button>
                <Button variant="outline" onClick={() => transitionStatus('draft')} disabled={transitioning}>
                  <RotateCcw size={16} className="mr-1" /> Back to Draft
                </Button>
              </>
            )}
            {grn.status === 'accepted' && (
              <Button onClick={() => transitionStatus('stock_updated')} disabled={transitioning}>
                <PackageCheck size={16} className="mr-1" /> Update Stock
              </Button>
            )}
            <Button variant="outline" onClick={handleDownloadPdf}>
              <Download size={16} className="mr-1" /> Download PDF
            </Button>
          </div>

          {/* GRN Header */}
          <div className="bg-card rounded-lg border p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-muted-foreground">GRN Number</Label>
                <p className="font-semibold text-lg">{grn.grnNumber}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <p><span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[grn.status] || ''}`}>{STATUS_LABELS[grn.status]}</span></p>
              </div>
              <div>
                <Label className="text-muted-foreground">Purchase Order</Label>
                <p><Link to={`/console/modules/purchase-order/po/${grn.purchaseOrderId}`} className="text-blue-600 hover:underline">{grn.purchaseOrder?.poNumber || '-'}</Link></p>
              </div>
              <div>
                <Label className="text-muted-foreground">Supplier</Label>
                <p>{grn.purchaseOrder?.supplier?.name || '-'} ({grn.purchaseOrder?.supplier?.code || ''})</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Location</Label>
                <p>{grn.location?.name || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Created By</Label>
                <p>{grn.createdByUser?.fullname || grn.createdByUser?.username || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Received Date</Label>
                <p>{formatDate(grn.receivedDate)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Delivery Note Ref</Label>
                <p>{grn.deliveryNoteRef || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Invoice Ref</Label>
                <p>{grn.invoiceRef || '-'}</p>
              </div>
              {grn.notes && (
                <div className="md:col-span-3">
                  <Label className="text-muted-foreground">Notes</Label>
                  <p>{grn.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Quality Inspection Section */}
          {grn.qualityCheckPassed !== null && grn.qualityCheckPassed !== undefined && (
            <div className={`rounded-lg border p-4 ${grn.qualityCheckPassed ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'}`}>
              <h3 className="font-medium">Quality Inspection</h3>
              <div className="mt-2 text-sm space-y-1">
                <p><span className="text-muted-foreground">Result:</span> <span className={`font-medium ${grn.qualityCheckPassed ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>{grn.qualityCheckPassed ? 'Passed' : 'Failed'}</span></p>
                {grn.qualityNotes && <p><span className="text-muted-foreground">Notes:</span> {grn.qualityNotes}</p>}
              </div>
            </div>
          )}

          {/* Line Items */}
          <div className="bg-card rounded-lg border">
            <div className="p-4 border-b"><h3 className="font-medium">Received Items</h3></div>
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead className="w-[50px] text-center">#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Prev Rcvd</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Accepted</TableHead>
                  <TableHead className="text-right">Rejected</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Expiry</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(grn.items || []).map((item: any, i: number) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center">{i + 1}</TableCell>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell className="text-muted-foreground">{item.skuCode}</TableCell>
                    <TableCell className="text-right">{item.orderedQuantity}</TableCell>
                    <TableCell className="text-right">{item.previouslyReceivedQuantity}</TableCell>
                    <TableCell className="text-right font-medium">{item.receivedQuantity}</TableCell>
                    <TableCell className="text-right text-green-600">{item.acceptedQuantity}</TableCell>
                    <TableCell className="text-right text-red-600">{item.rejectedQuantity > 0 ? item.rejectedQuantity : '-'}</TableCell>
                    <TableCell>{item.rejectionReasonCode ? (REJECTION_LABELS[item.rejectionReasonCode] || item.rejectionReasonCode) : '-'}</TableCell>
                    <TableCell>{item.batchNumber || '-'}</TableCell>
                    <TableCell>{item.expiryDate ? formatDate(item.expiryDate) : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Quality Inspection Dialog */}
      <AlertDialog open={showQiDialog} onOpenChange={setShowQiDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quality Inspection Result</AlertDialogTitle>
            <AlertDialogDescription>Record the quality inspection outcome for this GRN.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-4">
              <Button variant={qualityPassed ? 'default' : 'outline'} onClick={() => setQualityPassed(true)} type="button">
                <Check size={16} className="mr-1" /> Passed
              </Button>
              <Button variant={!qualityPassed ? 'destructive' : 'outline'} onClick={() => setQualityPassed(false)} type="button">
                Rejected
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={qualityNotes} onChange={e => setQualityNotes(e.target.value)} placeholder="Quality inspection notes..." rows={3} />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleQiAccept}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default withModuleAuthorization(GrnView, { moduleId: 'grn', moduleName: 'Goods Received Note' });
