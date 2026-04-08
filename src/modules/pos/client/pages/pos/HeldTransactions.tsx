import { Button } from '@client/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@client/components/ui/sheet';
import axios from 'axios';
import { Pause, Play, ShoppingBag, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useCart } from '../../hooks/useCart';

interface HeldItem {
  id: string;
  customerNote: string | null;
  cartData: any;
  totalAmount: string;
  createdAt: string;
}

function formatCurrency(amount: string | number): string {
  return Number(amount).toLocaleString('id-ID');
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

interface HeldTransactionsProps {
  locationId: string | null;
}

export default function HeldTransactions({ locationId }: HeldTransactionsProps) {
  const { state, addItem, setLocation, setTransactionDiscount, clear } = useCart();
  const [held, setHeld] = useState<HeldItem[]>([]);
  const [open, setOpen] = useState(false);

  const loadHeld = useCallback(async () => {
    try {
      const params = locationId ? `?locationId=${locationId}` : '';
      const res = await axios.get(`/api/modules/pos/transaction/held${params}`);
      setHeld(res.data.held || []);
    } catch {}
  }, [locationId]);

  useEffect(() => { loadHeld(); }, [loadHeld, open]);

  async function handleHold() {
    if (state.items.length === 0) { toast.error('Cart is empty'); return; }
    if (!locationId) { toast.error('No location'); return; }

    try {
      const cartData = {
        items: state.items,
        transactionDiscount: state.transactionDiscount,
      };
      const total = state.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

      await axios.post('/api/modules/pos/transaction/hold', {
        locationId,
        cartData,
        totalAmount: total,
      });

      clear();
      toast.success('Transaction held');
      loadHeld();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to hold');
    }
  }

  async function handleRecall(item: HeldItem) {
    try {
      const res = await axios.post(`/api/modules/pos/transaction/held/${item.id}/recall`);
      const { cartData } = res.data;

      clear();
      if (locationId) setLocation(locationId);
      if (cartData.transactionDiscount) setTransactionDiscount(cartData.transactionDiscount);
      for (const ci of cartData.items || []) {
        addItem({
          productId: ci.productId,
          variantId: ci.variantId,
          skuCode: ci.skuCode,
          productName: ci.productName,
          unitPrice: ci.unitPrice,
          taxApplicable: ci.taxApplicable,
          imageUrl: ci.imageUrl,
        });
      }

      toast.success('Transaction recalled');
      setOpen(false);
      loadHeld();
    } catch {
      toast.error('Failed to recall');
    }
  }

  async function handleRelease(id: string) {
    try {
      await axios.delete(`/api/modules/pos/transaction/held/${id}`);
      toast.success('Held transaction released');
      loadHeld();
    } catch {
      toast.error('Failed to release');
    }
  }

  return (
    <>
      {/* Held Badge + Drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button className="relative flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="pos-held-badge">
            <ShoppingBag size={14} />
            <span>Held</span>
            {held.length > 0 && (
              <span className="absolute -top-1 -right-2 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {held.length}
              </span>
            )}
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full max-w-[350px]">
          <SheetHeader>
            <SheetTitle>Held Transactions ({held.length})</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2 overflow-y-auto max-h-[calc(100vh-120px)]">
            {held.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No held transactions</p>
            )}
            {held.map(item => {
              const itemCount = item.cartData?.items?.length || 0;
              return (
                <div key={item.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{item.customerNote || `${itemCount} item(s)`}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</p>
                    </div>
                    <p className="text-sm font-bold">Rp {formatCurrency(item.totalAmount)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-8" onClick={() => handleRecall(item)}>
                      <Play size={12} className="mr-1" /> Recall
                    </Button>
                    <Button size="sm" variant="destructive" className="h-8" onClick={() => handleRelease(item.id)}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
