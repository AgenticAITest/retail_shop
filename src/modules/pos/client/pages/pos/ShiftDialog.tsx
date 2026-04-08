import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@client/components/ui/alert-dialog';
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Textarea } from '@client/components/ui/textarea';
import { DollarSign, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useShift } from '../../hooks/useShift';

interface ShiftDialogProps {
  mode: 'open' | 'close' | 'cash-drop' | null;
  onClose: () => void;
  locationId: string | null;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('id-ID');
}

export default function ShiftDialog({ mode, onClose, locationId }: ShiftDialogProps) {
  const { openShift, closeShift, cashDrop, summary } = useShift();
  const [loading, setLoading] = useState(false);
  const [openingFloat, setOpeningFloat] = useState('0');
  const [actualCash, setActualCash] = useState('');
  const [varianceReason, setVarianceReason] = useState('');
  const [shiftNotes, setShiftNotes] = useState('');
  const [dropAmount, setDropAmount] = useState('');
  const [dropReason, setDropReason] = useState('');

  const expectedCash = summary?.expectedCash || 0;
  const actualCashNum = parseFloat(actualCash) || 0;
  const variance = actualCashNum - expectedCash;

  async function handleOpenShift() {
    if (!locationId) { toast.error('No location selected'); return; }
    setLoading(true);
    const ok = await openShift(locationId, parseFloat(openingFloat) || 0);
    setLoading(false);
    if (ok) { toast.success('Shift opened'); onClose(); }
    else toast.error('Failed to open shift');
  }

  async function handleCloseShift() {
    setLoading(true);
    const ok = await closeShift(actualCashNum, varianceReason || undefined, shiftNotes || undefined);
    setLoading(false);
    if (ok) { toast.success('Shift closed'); onClose(); }
    else toast.error('Failed to close shift');
  }

  async function handleCashDrop() {
    const amt = parseFloat(dropAmount);
    if (!amt || amt <= 0) { toast.error('Enter amount'); return; }
    if (!dropReason.trim()) { toast.error('Enter reason'); return; }
    setLoading(true);
    const ok = await cashDrop(amt, dropReason);
    setLoading(false);
    if (ok) { toast.success('Cash drop recorded'); setDropAmount(''); setDropReason(''); onClose(); }
    else toast.error('Failed to record cash drop');
  }

  return (
    <AlertDialog open={mode !== null} onOpenChange={(v) => { if (!v) onClose(); }}>
      <AlertDialogContent>
        {mode === 'open' && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2"><DollarSign size={20} /> Open Shift</AlertDialogTitle>
              <AlertDialogDescription>Start a new shift to begin processing sales.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label>Opening Float (Cash in Drawer)</Label>
                <Input type="number" min={0} value={openingFloat} onChange={e => setOpeningFloat(e.target.value)} placeholder="0" className="text-right font-bold" autoFocus />
              </div>
            </div>
            <AlertDialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleOpenShift} disabled={loading}>
                {loading && <Loader2 size={16} className="animate-spin mr-1" />} Open Shift
              </Button>
            </AlertDialogFooter>
          </>
        )}

        {mode === 'close' && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Close Shift</AlertDialogTitle>
              <AlertDialogDescription>Count cash and close the current shift.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 py-2">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Expected Cash:</span><span className="font-bold">Rp {formatCurrency(expectedCash)}</span></div>
              </div>
              <div className="space-y-1">
                <Label>Actual Cash Count</Label>
                <Input type="number" min={0} value={actualCash} onChange={e => setActualCash(e.target.value)} placeholder="0" className="text-right font-bold" autoFocus />
              </div>
              {actualCash && (
                <div className={`rounded-lg p-2 text-center text-sm ${Math.abs(variance) < 0.01 ? 'bg-green-50 dark:bg-green-950' : 'bg-yellow-50 dark:bg-yellow-950'}`}>
                  <span className="text-muted-foreground">Variance: </span>
                  <span className={`font-bold ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Rp {formatCurrency(variance)}
                  </span>
                </div>
              )}
              {Math.abs(variance) > 0.01 && actualCash && (
                <div className="space-y-1">
                  <Label>Variance Reason</Label>
                  <Textarea value={varianceReason} onChange={e => setVarianceReason(e.target.value)} placeholder="Explain the variance..." rows={2} />
                </div>
              )}
              <div className="space-y-1">
                <Label>Notes (optional)</Label>
                <Textarea value={shiftNotes} onChange={e => setShiftNotes(e.target.value)} placeholder="Shift notes..." rows={2} />
              </div>
            </div>
            <AlertDialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleCloseShift} disabled={loading || !actualCash}>
                {loading && <Loader2 size={16} className="animate-spin mr-1" />} Close Shift
              </Button>
            </AlertDialogFooter>
          </>
        )}

        {mode === 'cash-drop' && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Cash Drop</AlertDialogTitle>
              <AlertDialogDescription>Record a mid-shift cash removal from the drawer.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label>Amount</Label>
                <Input type="number" min={0} value={dropAmount} onChange={e => setDropAmount(e.target.value)} placeholder="0" className="text-right font-bold" autoFocus />
              </div>
              <div className="space-y-1">
                <Label>Reason</Label>
                <Input value={dropReason} onChange={e => setDropReason(e.target.value)} placeholder="Reason for cash drop" />
              </div>
            </div>
            <AlertDialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleCashDrop} disabled={loading}>
                {loading && <Loader2 size={16} className="animate-spin mr-1" />} Record Drop
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
