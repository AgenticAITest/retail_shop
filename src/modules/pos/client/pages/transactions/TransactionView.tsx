import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import Authorized from '@client/components/auth/Authorized';
import Breadcrumbs, { createBreadcrumbItems, useBreadcrumbs } from '@client/components/console/Breadcrumbs';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from '@client/components/ui/alert-dialog';
import { Button } from '@client/components/ui/button';
import { Label } from '@client/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { Textarea } from '@client/components/ui/textarea';
import axios from 'axios';
import { Ban, Download, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  voided: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(amount: string | number): string {
  return Number(amount).toLocaleString('id-ID', { style: 'currency', currency: 'IDR' });
}

const TransactionView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [txn, setTxn] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  const { items: breadcrumbs, updateItem } = useBreadcrumbs(
    createBreadcrumbItems([
      { label: "Transaction History", onClick: () => navigate("/console/modules/pos/transaction") },
      { label: "View Transaction" },
    ])
  );

  function loadTransaction() {
    setLoading(true);
    axios.get(`/api/modules/pos/transaction/${id}`)
      .then(res => { setTxn(res.data); updateItem(1, { label: res.data.transactionId }); })
      .catch(() => { toast.error("Failed to load transaction."); navigate("/console/modules/pos/transaction"); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadTransaction(); }, [id]);

  async function handleReprintReceipt() {
    try {
      const res = await axios.post(`/api/modules/pos/transaction/${id}/reprint`);
      toast.success('Reprint logged');
      // Try thermal print, fall back to PDF
      try {
        const { getPrinterManager } = await import('../../lib/printerManager');
        const pm = getPrinterManager();
        if (pm.getStatus() === 'connected') {
          await pm.printReceipt(res.data);
          toast.success('Receipt sent to printer');
          return;
        }
      } catch {}
      // Fallback: PDF download
      const { generateReceiptPdf } = await import('../../lib/generateReceiptPdf');
      generateReceiptPdf(res.data);
    } catch {
      toast.error('Failed to reprint receipt');
    }
  }

  async function handleDownloadPdf() {
    try {
      const { generateReceiptPdf } = await import('../../lib/generateReceiptPdf');
      generateReceiptPdf(txn);
    } catch {
      toast.error('Failed to generate PDF');
    }
  }

  function handleVoid() {
    if (!voidReason.trim()) { toast.error("Please provide a void reason."); return; }
    setVoiding(true);
    axios.post(`/api/modules/pos/transaction/${id}/void`, { voidReason })
      .then(() => { toast.success("Transaction voided."); loadTransaction(); setShowVoidDialog(false); setVoidReason(''); })
      .catch(err => toast.error(err.response?.data?.error || "Failed to void transaction."))
      .finally(() => setVoiding(false));
  }

  if (loading || !txn) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <h1 className="text-2xl font-semibold">Transaction Detail</h1>
        <div className="ml-auto px-4"><Breadcrumbs items={breadcrumbs} loading={loading} /></div>
      </header>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">

          {/* Void Banner */}
          {txn.status === 'voided' && (
            <div className="bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800 p-4">
              <h3 className="font-medium text-red-700 dark:text-red-300">Transaction Voided</h3>
              <p className="text-sm mt-1 text-red-600 dark:text-red-400">Reason: {txn.voidReason || '-'}</p>
              <p className="text-sm text-red-600 dark:text-red-400">Voided by: {txn.voidedByUser?.fullname || txn.voidedByUser?.username || '-'} on {formatDate(txn.voidedAt)}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            {txn.status === 'completed' && (
              <Authorized roles="ADMIN" permissions="pos.transaction.void">
                <Button variant="destructive" onClick={() => setShowVoidDialog(true)}>
                  <Ban size={16} className="mr-1" /> Void Transaction
                </Button>
              </Authorized>
            )}
            <Button variant="outline" onClick={handleReprintReceipt}>
              <Printer size={16} className="mr-1" /> Reprint Receipt
            </Button>
            <Button variant="outline" onClick={handleDownloadPdf}>
              <Download size={16} className="mr-1" /> Download PDF
            </Button>
          </div>

          {/* Transaction Header */}
          <div className="bg-card rounded-lg border p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-muted-foreground">Transaction ID</Label>
                <p className="font-semibold text-lg font-mono">{txn.transactionId}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <p><span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize ${STATUS_COLORS[txn.status] || ''}`}>{txn.status}</span></p>
              </div>
              <div>
                <Label className="text-muted-foreground">Location</Label>
                <p>{txn.location?.name || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Cashier</Label>
                <p>{txn.cashier?.fullname || txn.cashier?.username || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Payment</Label>
                {(txn.payments || []).length > 0 ? (
                  <div className="space-y-0.5">
                    {txn.payments.map((p: any, i: number) => (
                      <p key={i} className="text-sm capitalize">{p.paymentMethod}: {formatCurrency(p.amount)}</p>
                    ))}
                  </div>
                ) : (
                  <p className="capitalize">{txn.paymentMethod || '-'}</p>
                )}
              </div>
              <div>
                <Label className="text-muted-foreground">Date</Label>
                <p>{formatDate(txn.completedAt || txn.createdAt)}</p>
              </div>
              {txn.changeAmount && parseFloat(txn.changeAmount) > 0 && (
                <div>
                  <Label className="text-muted-foreground">Change</Label>
                  <p className="text-green-600 font-medium">{formatCurrency(txn.changeAmount)}</p>
                </div>
              )}
              {txn.notes && (
                <div className="md:col-span-3">
                  <Label className="text-muted-foreground">Notes</Label>
                  <p>{txn.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Totals Summary */}
          <div className="bg-card rounded-lg border p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Subtotal</p>
                <p className="text-lg font-semibold">{formatCurrency(txn.subtotal)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Discount</p>
                <p className="text-lg font-semibold text-green-600">-{formatCurrency(txn.discountAmount)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tax (PPN)</p>
                <p className="text-lg font-semibold">{formatCurrency(txn.taxAmount)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{formatCurrency(txn.totalAmount)}</p>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-card rounded-lg border">
            <div className="p-4 border-b"><h3 className="font-medium">Items</h3></div>
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead className="w-[50px] text-center">#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(txn.items || []).map((item: any, i: number) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center">{i + 1}</TableCell>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell className="text-muted-foreground">{item.skuCode}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right text-green-600">{parseFloat(item.discountAmount) > 0 ? `-${formatCurrency(item.discountAmount)}` : '-'}</TableCell>
                    <TableCell className="text-right">{parseFloat(item.taxAmount) > 0 ? formatCurrency(item.taxAmount) : '-'}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.lineTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Payments Breakdown */}
          {(txn.payments || []).length > 0 && (
            <div className="bg-card rounded-lg border">
              <div className="p-4 border-b"><h3 className="font-medium">Payments</h3></div>
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead className="w-[50px] text-center">#</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Tendered</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txn.payments.map((p: any, i: number) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-center">{i + 1}</TableCell>
                      <TableCell className="capitalize font-medium">{p.paymentMethod}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(p.amount)}</TableCell>
                      <TableCell className="text-right">{p.amountTendered ? formatCurrency(p.amountTendered) : '-'}</TableCell>
                      <TableCell className="text-right text-green-600">{p.changeAmount && parseFloat(p.changeAmount) > 0 ? formatCurrency(p.changeAmount) : '-'}</TableCell>
                      <TableCell>{p.paymentRef || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Void Dialog */}
      <AlertDialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Transaction</AlertDialogTitle>
            <AlertDialogDescription>This will void the transaction and restore inventory. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label>Reason for voiding</Label>
            <Textarea value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="Reason..." rows={3} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={voiding}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoid} disabled={voiding} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Void Transaction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default withModuleAuthorization(TransactionView, { moduleId: 'pos', moduleName: 'Point of Sale' });
