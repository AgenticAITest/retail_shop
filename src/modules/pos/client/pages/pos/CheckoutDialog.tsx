import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel } from '@client/components/ui/alert-dialog';
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Textarea } from '@client/components/ui/textarea';
import axios from 'axios';
import { Banknote, Check, CreditCard, QrCode, Building2, Loader2, Plus, Trash2, Download, Printer } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCart } from '../../hooks/useCart';

interface CheckoutDialogProps {
  open: boolean;
  onClose: () => void;
  defaultPaymentMethod?: 'cash' | 'card' | 'qris' | 'transfer';
}

interface PaymentLine {
  id: string;
  paymentMethod: 'cash' | 'card' | 'qris' | 'transfer';
  amount: number;
  paymentRef: string;
  amountTendered: number | null;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('id-ID');
}

const PAYMENT_METHODS = [
  { value: 'cash' as const, label: 'Cash', icon: Banknote, shortcut: 'F1' },
  { value: 'card' as const, label: 'Card', icon: CreditCard, shortcut: 'F2' },
  { value: 'qris' as const, label: 'QRIS', icon: QrCode, shortcut: 'F3' },
  { value: 'transfer' as const, label: 'Transfer', icon: Building2, shortcut: 'F4' },
];

export default function CheckoutDialog({ open, onClose, defaultPaymentMethod }: CheckoutDialogProps) {
  const { state, totals, clear } = useCart();
  const [payments, setPayments] = useState<PaymentLine[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'card' | 'qris' | 'transfer'>(defaultPaymentMethod || 'cash');
  const [addAmount, setAddAmount] = useState('');
  const [addRef, setAddRef] = useState('');
  const [addTendered, setAddTendered] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState<any>(null);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.round((totals.grandTotal - totalPaid) * 100) / 100;
  const totalChange = payments.reduce((sum, p) => {
    if (p.paymentMethod === 'cash' && p.amountTendered) {
      return sum + Math.max(0, p.amountTendered - p.amount);
    }
    return sum;
  }, 0);
  const canCheckout = remaining <= 0 && payments.length > 0;

  // Quick amounts for adding payment
  const quickAmounts = remaining > 0 ? [
    remaining,
    Math.ceil(remaining / 10000) * 10000,
    Math.ceil(remaining / 50000) * 50000,
    Math.ceil(remaining / 100000) * 100000,
  ].filter((v, i, a) => a.indexOf(v) === i && v > 0) : [];

  function addPayment() {
    const amount = parseFloat(addAmount) || 0;
    if (amount <= 0) { toast.error('Enter a payment amount'); return; }

    const tendered = selectedMethod === 'cash' ? (parseFloat(addTendered) || amount) : null;
    if (selectedMethod === 'cash' && tendered !== null && tendered < amount) {
      toast.error('Amount tendered must be at least the payment amount');
      return;
    }

    setPayments(prev => [...prev, {
      id: crypto.randomUUID(),
      paymentMethod: selectedMethod,
      amount,
      paymentRef: addRef,
      amountTendered: tendered,
    }]);

    setAddAmount('');
    setAddRef('');
    setAddTendered('');
  }

  function addFullPayment(method: 'cash' | 'card' | 'qris' | 'transfer') {
    if (remaining <= 0) return;
    setSelectedMethod(method);
    if (method !== 'cash') {
      setPayments(prev => [...prev, {
        id: crypto.randomUUID(),
        paymentMethod: method,
        amount: remaining,
        paymentRef: '',
        amountTendered: null,
      }]);
    } else {
      setAddAmount(String(remaining));
      setAddTendered(String(remaining));
    }
  }

  function removePayment(id: string) {
    setPayments(prev => prev.filter(p => p.id !== id));
  }

  function handleCheckout() {
    setLoading(true);

    const payload = {
      locationId: state.locationId,
      items: state.items.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        skuCode: item.skuCode,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxApplicable: item.taxApplicable,
        discountType: item.discount?.type || null,
        discountValue: item.discount?.value || 0,
      })),
      payments: payments.map(p => ({
        paymentMethod: p.paymentMethod,
        amount: p.amount,
        paymentRef: p.paymentRef || null,
        amountTendered: p.amountTendered,
      })),
      transactionDiscount: state.transactionDiscount,
      notes: notes || null,
    };

    axios.post('/api/modules/pos/transaction/checkout', payload)
      .then(async (res) => {
        setCompleted(res.data);
        toast.success('Sale completed!');
        // Auto-print receipt if printer connected
        try {
          const { getPrinterManager } = await import('../../lib/printerManager');
          const pm = getPrinterManager();
          if (pm.getStatus() === 'connected') {
            await pm.printReceipt(res.data);
          }
        } catch {}
      })
      .catch(err => {
        toast.error(err.response?.data?.error || err.response?.data?.message || 'Checkout failed');
      })
      .finally(() => setLoading(false));
  }

  function handleNewSale() {
    clear();
    resetDialog();
    onClose();
  }

  function resetDialog() {
    setCompleted(null);
    setPayments([]);
    setAddAmount('');
    setAddRef('');
    setAddTendered('');
    setNotes('');
  }

  async function handlePrintReceipt() {
    try {
      const { getPrinterManager } = await import('../../lib/printerManager');
      const pm = getPrinterManager();
      if (pm.getStatus() === 'connected') {
        await pm.printReceipt(completed);
        toast.success('Receipt sent to printer');
      } else {
        toast.error('Printer not connected — use Download PDF instead');
      }
    } catch {
      toast.error('Failed to print receipt');
    }
  }

  async function handleDownloadReceipt() {
    try {
      const { generateReceiptPdf } = await import('../../lib/generateReceiptPdf');
      generateReceiptPdf(completed);
    } catch {
      toast.error('Failed to generate receipt');
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v && !completed) { resetDialog(); onClose(); } }}>
      <AlertDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {!completed ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Checkout</AlertDialogTitle>
              <AlertDialogDescription>
                {totals.itemCount} item{totals.itemCount > 1 ? 's' : ''} · Total: <span className="font-bold text-foreground text-lg">Rp {formatCurrency(totals.grandTotal)}</span>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4 py-2">
              {/* Payment Lines Added */}
              {payments.length > 0 && (
                <div className="space-y-2">
                  <Label>Payments Added</Label>
                  <div className="space-y-1">
                    {payments.map((p, i) => {
                      const method = PAYMENT_METHODS.find(m => m.value === p.paymentMethod);
                      const change = p.paymentMethod === 'cash' && p.amountTendered ? Math.max(0, p.amountTendered - p.amount) : 0;
                      return (
                        <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30 text-sm">
                          <span className="font-medium capitalize flex items-center gap-1">
                            {method && <method.icon size={14} />} {p.paymentMethod}
                          </span>
                          <span className="font-bold ml-auto">Rp {formatCurrency(p.amount)}</span>
                          {change > 0 && <span className="text-green-600 text-xs">(change: Rp {formatCurrency(change)})</span>}
                          {p.paymentRef && <span className="text-xs text-muted-foreground">ref: {p.paymentRef}</span>}
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removePayment(p.id)}>
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Remaining Balance */}
              <div className={`rounded-lg p-3 text-center ${remaining > 0 ? 'bg-yellow-50 dark:bg-yellow-950' : 'bg-green-50 dark:bg-green-950'}`}>
                {remaining > 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground">Remaining</p>
                    <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">Rp {formatCurrency(remaining)}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Fully Paid</p>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">Rp {formatCurrency(totals.grandTotal)}</p>
                    {totalChange > 0 && <p className="text-sm text-green-600">Change: Rp {formatCurrency(totalChange)}</p>}
                  </>
                )}
              </div>

              {/* Add Payment Section */}
              {remaining > 0 && (
                <div className="space-y-3 border rounded-lg p-3">
                  <Label>Add Payment</Label>
                  {/* Method buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    {PAYMENT_METHODS.map(pm => (
                      <Button
                        key={pm.value}
                        variant={selectedMethod === pm.value ? 'default' : 'outline'}
                        className="flex flex-col h-14 gap-0.5"
                        onClick={() => setSelectedMethod(pm.value)}
                      >
                        <pm.icon size={16} />
                        <span className="text-[10px]">{pm.label}</span>
                      </Button>
                    ))}
                  </div>

                  {/* Amount */}
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={addAmount}
                      onChange={e => setAddAmount(e.target.value)}
                      placeholder="Amount"
                      className="h-10 text-right font-bold"
                      autoFocus
                    />
                    <Button onClick={addPayment} className="h-10 shrink-0">
                      <Plus size={14} className="mr-1" /> Add
                    </Button>
                  </div>

                  {/* Quick amounts */}
                  <div className="flex gap-1.5 flex-wrap">
                    {quickAmounts.map(amt => (
                      <Button key={amt} variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setAddAmount(String(amt)); if (selectedMethod === 'cash') setAddTendered(String(amt)); }}>
                        Rp {formatCurrency(amt)}
                      </Button>
                    ))}
                  </div>

                  {/* Cash: tendered amount */}
                  {selectedMethod === 'cash' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Amount Tendered (cash)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={addTendered}
                        onChange={e => setAddTendered(e.target.value)}
                        placeholder="Amount tendered by customer"
                        className="h-9"
                      />
                    </div>
                  )}

                  {/* Non-cash: reference */}
                  {selectedMethod !== 'cash' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Reference (optional)</Label>
                      <Input
                        value={addRef}
                        onChange={e => setAddRef(e.target.value)}
                        placeholder={selectedMethod === 'qris' ? 'QRIS ref' : selectedMethod === 'card' ? 'Card last 4 / approval' : 'Transfer ref'}
                        className="h-9"
                      />
                    </div>
                  )}

                  {/* One-click full payment */}
                  <div className="flex gap-1.5 pt-1 border-t">
                    <span className="text-xs text-muted-foreground self-center mr-1">Pay full:</span>
                    {PAYMENT_METHODS.map(pm => (
                      <Button key={pm.value} variant="outline" size="sm" className="h-7 text-xs" onClick={() => addFullPayment(pm.value)}>
                        {pm.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1">
                <Label className="text-xs">Notes (optional)</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." rows={2} />
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading} onClick={() => resetDialog()}>Cancel</AlertDialogCancel>
              <Button onClick={handleCheckout} disabled={!canCheckout || loading} className="min-w-[120px]">
                {loading ? <Loader2 size={16} className="animate-spin mr-1" /> : <Check size={16} className="mr-1" />}
                Complete Sale
              </Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-green-600 flex items-center gap-2">
                <Check size={20} /> Sale Completed
              </AlertDialogTitle>
            </AlertDialogHeader>

            <div className="space-y-3 py-4 text-center">
              <p className="text-sm text-muted-foreground">Transaction ID</p>
              <p className="text-lg font-bold font-mono">{completed.transactionId}</p>

              <div className="flex justify-center gap-6 text-sm">
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-bold">Rp {formatCurrency(parseFloat(completed.totalAmount))}</p>
                </div>
                {completed.payments?.length > 0 && (
                  <div>
                    <p className="text-muted-foreground">Payments</p>
                    {completed.payments.map((p: any, i: number) => (
                      <p key={i} className="font-medium capitalize text-xs">
                        {p.paymentMethod}: Rp {formatCurrency(parseFloat(p.amount))}
                      </p>
                    ))}
                  </div>
                )}
                {completed.totalChange > 0 && (
                  <div>
                    <p className="text-muted-foreground">Change</p>
                    <p className="font-bold text-green-600">Rp {formatCurrency(completed.totalChange)}</p>
                  </div>
                )}
              </div>
            </div>

            <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
              <div className="flex gap-2 w-full">
                <Button variant="outline" onClick={handlePrintReceipt} className="flex-1">
                  <Printer size={16} className="mr-1" /> Print
                </Button>
                <Button variant="outline" onClick={handleDownloadReceipt} className="flex-1">
                  <Download size={16} className="mr-1" /> PDF
                </Button>
              </div>
              <Button onClick={handleNewSale} className="w-full h-12 text-lg" data-testid="pos-new-sale">
                New Sale
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
