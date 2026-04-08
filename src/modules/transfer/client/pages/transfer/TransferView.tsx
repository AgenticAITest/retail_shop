import Authorized from '@client/components/auth/Authorized';
import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import Breadcrumbs, { createBreadcrumbItems, useBreadcrumbs } from '@client/components/console/Breadcrumbs';
import { Button } from '@client/components/ui/button';
import { Label } from '@client/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import axios from 'axios';
import { Check, ClipboardList, Download, Package, ShieldCheck, Truck, PackageCheck, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

const STATUS_LABELS: Record<string, string> = {
  requested: 'Requested', pending_approval: 'Pending Approval', approved: 'Approved',
  picking: 'Picking', dispatched: 'Dispatched', received: 'Received', closed: 'Closed',
};
const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  pending_approval: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  picking: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  dispatched: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  received: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
  closed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
};
const LIFECYCLE = ['requested', 'pending_approval', 'approved', 'picking', 'dispatched', 'received', 'closed'];

function formatDate(d: string | null) { return d ? new Date(d).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'; }
function formatDateTime(d: string | null) { return d ? new Date(d).toLocaleString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'; }

const TransferView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [t, setT] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);

  const { items: breadcrumbs, updateItem } = useBreadcrumbs(createBreadcrumbItems([
    { label: "Transfer List", onClick: () => navigate("/console/modules/transfer/transfer") },
    { label: "View Transfer" },
  ]));

  function loadTransfer() {
    setLoading(true);
    axios.get(`/api/modules/transfer/transfer/${id}`)
      .then(r => { setT(r.data); updateItem(1, { label: r.data.transferNumber }); })
      .catch(() => { toast.error("Failed to load."); navigate("/console/modules/transfer/transfer"); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadTransfer(); }, [id]);

  function transitionStatus(targetStatus: string, extra?: any) {
    setTransitioning(true);
    axios.put(`/api/modules/transfer/transfer/${id}/status`, { status: targetStatus, ...extra })
      .then(() => { toast.success(`Status updated to ${STATUS_LABELS[targetStatus]}.`); loadTransfer(); })
      .catch(err => toast.error(err.response?.data?.error || "Failed to update."))
      .finally(() => setTransitioning(false));
  }

  async function handleDownloadPdf() {
    try {
      const { generateTransferPdf } = await import('../../lib/generateTransferPdf');
      generateTransferPdf(t);
    } catch { toast.error("Failed to generate PDF."); }
  }

  if (loading || !t) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  const currentIdx = LIFECYCLE.indexOf(t.status);

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <h1 className="text-2xl font-semibold">Inter-Shop Transfers</h1>
        <div className="ml-auto px-4"><Breadcrumbs items={breadcrumbs} loading={loading} /></div>
      </header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          {/* Timeline */}
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center justify-between overflow-x-auto gap-1">
              {LIFECYCLE.map((stage, idx) => {
                const done = idx < currentIdx; const curr = idx === currentIdx;
                return (
                  <div key={stage} className="flex items-center flex-1 min-w-0">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 ${done ? 'bg-green-500 border-green-500 text-white' : curr ? 'bg-blue-500 border-blue-500 text-white' : 'bg-muted border-muted-foreground/30 text-muted-foreground'}`}>
                        {done ? <Check size={14} /> : idx + 1}
                      </div>
                      <span className={`text-[10px] mt-1 text-center whitespace-nowrap ${curr ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}>{STATUS_LABELS[stage]}</span>
                    </div>
                    {idx < LIFECYCLE.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${done ? 'bg-green-500' : 'bg-muted-foreground/20'}`} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <Authorized roles="ADMIN" permissions="retail.transfer.transition">
              {t.status === 'requested' && <>
                <Button onClick={() => transitionStatus('pending_approval')} disabled={transitioning}><ClipboardList size={16} className="mr-1" /> Submit for Approval</Button>
                <Button variant="outline" onClick={() => transitionStatus('approved')} disabled={transitioning}><ShieldCheck size={16} className="mr-1" /> Approve (Skip)</Button>
              </>}
              {t.status === 'pending_approval' && <Button onClick={() => transitionStatus('approved')} disabled={transitioning}><ShieldCheck size={16} className="mr-1" /> Approve</Button>}
              {t.status === 'approved' && <Button onClick={() => transitionStatus('picking')} disabled={transitioning}><Package size={16} className="mr-1" /> Start Picking</Button>}
              {t.status === 'picking' && <Button onClick={() => transitionStatus('dispatched')} disabled={transitioning}><Truck size={16} className="mr-1" /> Dispatch</Button>}
              {t.status === 'dispatched' && <Button onClick={() => transitionStatus('received')} disabled={transitioning}><PackageCheck size={16} className="mr-1" /> Receive</Button>}
              {t.status === 'received' && <Button onClick={() => transitionStatus('closed')} disabled={transitioning}><Lock size={16} className="mr-1" /> Close</Button>}
            </Authorized>
            <Button variant="outline" onClick={handleDownloadPdf}><Download size={16} className="mr-1" /> Download PDF</Button>
          </div>

          {/* Header */}
          <div className="bg-card rounded-lg border p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><Label className="text-muted-foreground">Transfer Number</Label><p className="font-semibold text-lg">{t.transferNumber}</p></div>
              <div><Label className="text-muted-foreground">Status</Label><p><span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[t.status]}`}>{STATUS_LABELS[t.status]}</span></p></div>
              <div><Label className="text-muted-foreground">From</Label><p>{t.sourceLocation?.name || '-'} ({t.sourceLocation?.code || ''})</p></div>
              <div><Label className="text-muted-foreground">To</Label><p>{t.destLocation?.name || '-'} ({t.destLocation?.code || ''})</p></div>
              <div><Label className="text-muted-foreground">Requested By</Label><p>{t.requestedByUser?.fullname || '-'}</p></div>
              <div><Label className="text-muted-foreground">Created</Label><p>{formatDateTime(t.createdAt)}</p></div>
              {t.approvedAt && <div><Label className="text-muted-foreground">Approved</Label><p>{formatDateTime(t.approvedAt)} by {t.approvedByUser?.fullname || '-'}</p></div>}
              {t.dispatchedAt && <div><Label className="text-muted-foreground">Dispatched</Label><p>{formatDateTime(t.dispatchedAt)}</p></div>}
              {t.receivedAt && <div><Label className="text-muted-foreground">Received</Label><p>{formatDateTime(t.receivedAt)}</p></div>}
              {t.notes && <div className="md:col-span-3"><Label className="text-muted-foreground">Notes</Label><p>{t.notes}</p></div>}
            </div>
          </div>

          {/* Items */}
          <div className="bg-card rounded-lg border">
            <div className="p-4 border-b"><h3 className="font-medium">Transfer Items</h3></div>
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead className="w-[50px] text-center">#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Requested</TableHead>
                  <TableHead className="text-right">Picked</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Discrepancy</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(t.items || []).map((item: any, i: number) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center">{i + 1}</TableCell>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell className="text-muted-foreground">{item.skuCode}</TableCell>
                    <TableCell className="text-right">{item.requestedQty}</TableCell>
                    <TableCell className="text-right">{item.pickedQty || '-'}</TableCell>
                    <TableCell className="text-right">{item.receivedQty || '-'}</TableCell>
                    <TableCell className={`text-right ${item.discrepancyQty < 0 ? 'text-red-600' : item.discrepancyQty > 0 ? 'text-yellow-600' : ''}`}>
                      {item.discrepancyQty || '-'}
                    </TableCell>
                    <TableCell>{item.discrepancyReason || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(TransferView, { moduleId: 'transfer', moduleName: 'Inter-Shop Transfers' });
