import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@client/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Minus, Pause, Percent, Plus, ShoppingCart, Tag, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '../../hooks/useCart';

interface CartPanelProps {
  onCheckout: () => void;
  onHold?: () => void;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('id-ID');
}

export default function CartPanel({ onCheckout, onHold }: CartPanelProps) {
  const { state, totals, updateQuantity, removeItem, setItemDiscount, setTransactionDiscount, clear } = useCart();

  return (
    <div className="flex flex-col h-full border-l bg-card">
      {/* Cart Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <ShoppingCart size={18} />
          <h2 className="font-semibold">Cart</h2>
          {totals.itemCount > 0 && (
            <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5 font-medium">
              {totals.itemCount}
            </span>
          )}
        </div>
        {state.items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground hover:text-destructive h-8">
            <X size={14} className="mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Cart Items (scrollable) */}
      <div className="flex-1 overflow-y-auto">
        {state.items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ShoppingCart size={40} className="mb-2 opacity-30" />
            <p className="text-sm">Cart is empty</p>
            <p className="text-xs">Add products to get started</p>
          </div>
        )}

        {state.items.map(item => (
          <div key={item.id} className="flex flex-col p-3 border-b last:border-b-0">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight truncate">{item.productName}</p>
                <p className="text-xs text-muted-foreground">{item.skuCode} · Rp {formatCurrency(item.unitPrice)}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.id)}>
                <Trash2 size={16} />
              </Button>
            </div>

            <div className="flex items-center justify-between mt-2">
              {/* Quantity Controls */}
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                  <Minus size={16} />
                </Button>
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={e => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                  className="h-10 w-16 text-center px-1"
                />
                <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                  <Plus size={16} />
                </Button>
              </div>

              {/* Item Discount */}
              <ItemDiscountPopover
                discount={item.discount}
                onApply={(discount) => setItemDiscount(item.id, discount)}
              />

              {/* Line Total */}
              <span className="text-sm font-bold whitespace-nowrap">
                Rp {formatCurrency(item.quantity * item.unitPrice - (item.discount ? (item.discount.type === 'percent' ? item.quantity * item.unitPrice * item.discount.value / 100 : Math.min(item.discount.value * item.quantity, item.quantity * item.unitPrice)) : 0))}
              </span>
            </div>

            {item.discount && item.discount.value > 0 && (
              <p className="text-xs text-green-600 mt-1">
                Discount: {item.discount.type === 'percent' ? `${item.discount.value}%` : `Rp ${formatCurrency(item.discount.value)}/item`}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Cart Footer (sticky) */}
      <div className="border-t bg-card p-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>Rp {formatCurrency(totals.subtotal)}</span>
        </div>

        {(totals.itemDiscountTotal > 0 || totals.transactionDiscountAmount > 0) && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Discount</span>
            <span>-Rp {formatCurrency(totals.itemDiscountTotal + totals.transactionDiscountAmount)}</span>
          </div>
        )}

        {totals.taxAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax (PPN)</span>
            <span>Rp {formatCurrency(totals.taxAmount)}</span>
          </div>
        )}

        <div className="flex justify-between text-xl font-bold pt-2 border-t">
          <span>Total</span>
          <span>Rp {formatCurrency(totals.grandTotal)}</span>
        </div>

        {/* Transaction Discount */}
        <TransactionDiscountButton
          discount={state.transactionDiscount}
          onApply={setTransactionDiscount}
        />

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {onHold && (
            <Button
              variant="outline"
              className="h-12"
              disabled={state.items.length === 0}
              onClick={onHold}
              data-testid="pos-hold-button"
            >
              <Pause size={16} className="mr-1" /> Hold
            </Button>
          )}
          <Button
            className="flex-1 h-12 text-lg font-bold"
            disabled={state.items.length === 0}
            onClick={onCheckout}
            data-testid="pos-pay-button"
          >
            Pay
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Item Discount Popover
// ============================================================

function ItemDiscountPopover({
  discount,
  onApply,
}: {
  discount: { type: 'percent' | 'fixed'; value: number } | null;
  onApply: (d: { type: 'percent' | 'fixed'; value: number } | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'percent' | 'fixed'>(discount?.type || 'percent');
  const [value, setValue] = useState(String(discount?.value || ''));

  function handleApply() {
    const v = parseFloat(value);
    if (!v || v <= 0) {
      onApply(null);
    } else {
      onApply({ type, value: v });
    }
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground">
          <Tag size={14} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 max-w-[90vw] p-3" align="end">
        <p className="text-sm font-medium mb-2">Item Discount</p>
        <div className="flex gap-2 mb-2">
          <Select value={type} onValueChange={(v: 'percent' | 'fixed') => setType(v)}>
            <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">%</SelectItem>
              <SelectItem value="fixed">Rp</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" min={0} value={value} onChange={e => setValue(e.target.value)} className="h-8" placeholder="0" />
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 h-8" onClick={handleApply}>Apply</Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => { onApply(null); setOpen(false); }}>Clear</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// Transaction Discount Button
// ============================================================

function TransactionDiscountButton({
  discount,
  onApply,
}: {
  discount: { type: 'percent' | 'fixed'; value: number } | null;
  onApply: (d: { type: 'percent' | 'fixed'; value: number } | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'percent' | 'fixed'>(discount?.type || 'percent');
  const [value, setValue] = useState(String(discount?.value || ''));

  function handleApply() {
    const v = parseFloat(value);
    if (!v || v <= 0) {
      onApply(null);
    } else {
      onApply({ type, value: v });
    }
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full h-8">
          <Percent size={14} className="mr-1" />
          {discount ? `Transaction Discount: ${discount.type === 'percent' ? `${discount.value}%` : `Rp ${formatCurrency(discount.value)}`}` : 'Add Transaction Discount'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 max-w-[90vw] p-3">
        <p className="text-sm font-medium mb-2">Transaction Discount</p>
        <div className="flex gap-2 mb-2">
          <Select value={type} onValueChange={(v: 'percent' | 'fixed') => setType(v)}>
            <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">%</SelectItem>
              <SelectItem value="fixed">Rp</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" min={0} value={value} onChange={e => setValue(e.target.value)} className="h-8" placeholder="0" />
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 h-8" onClick={handleApply}>Apply</Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => { onApply(null); setOpen(false); }}>Clear</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
