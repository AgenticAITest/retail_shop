import { Button } from '@client/components/ui/button';
import { useAuth } from '@client/provider/AuthProvider';
import axios from 'axios';
import { Clock, LogOut, MapPin, DollarSign, ArrowDownToLine } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useCart } from '../../hooks/useCart';
import { useShift } from '../../hooks/useShift';
import { useBarcodeScanner, playSuccessBeep, playErrorBeep } from '../../hooks/useBarcodeScanner';
import { usePosKeyboard } from '../../hooks/usePosKeyboard';
import { useIdleTimer } from '../../hooks/useIdleTimer';
import ProductGrid from './ProductGrid';
import CartPanel from './CartPanel';
import CheckoutDialog from './CheckoutDialog';
import PrinterStatus from './PrinterStatus';
import SyncStatus from './SyncStatus';
import ShiftDialog from './ShiftDialog';
import HeldTransactions from './HeldTransactions';
import LockScreen from './LockScreen';
import { fullCacheSync } from '../../lib/cacheManager';

interface LocationOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

export default function PosScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const cart = useCart();
  const shift = useShift();

  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<'cash' | 'card' | 'qris' | 'transfer'>('cash');
  const [mobileView, setMobileView] = useState<'products' | 'cart'>('products');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [shiftDialogMode, setShiftDialogMode] = useState<'open' | 'close' | 'cash-drop' | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  // Idle timer — lock after 5 minutes
  useIdleTimer({
    timeout: 5 * 60 * 1000,
    onIdle: () => setIsLocked(true),
    enabled: !isLocked && !showCheckout,
  });

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load locations on mount
  useEffect(() => {
    axios.get('/api/modules/location-management/location', { params: { perPage: 1000, sort: 'name', order: 'asc' } })
      .then(res => {
        const shops = (res.data.locations || []).filter((l: any) => l.status === 'active' && l.type === 'shop');
        setLocations(shops);
        if (shops.length === 1) {
          selectLocation(shops[0]);
        } else if (shops.length > 1) {
          setShowLocationPicker(true);
        }
      })
      .catch(() => toast.error('Failed to load locations'));
  }, []);

  // Load tax config
  useEffect(() => {
    axios.get('/api/modules/tax-configuration/config/active')
      .then(res => {
        const tc = res.data;
        if (tc) cart.setTaxConfig(parseFloat(tc.ratePercent) / 100, tc.calcMode);
      })
      .catch(() => {});
  }, []);

  // Show open shift dialog if no shift open after location selected
  useEffect(() => {
    if (selectedLocation && !shift.loading && !shift.isShiftOpen && !showLocationPicker) {
      setShiftDialogMode('open');
    }
  }, [selectedLocation, shift.loading, shift.isShiftOpen, showLocationPicker]);

  function selectLocation(loc: LocationOption) {
    setSelectedLocation(loc);
    cart.setLocation(loc.id);
    setShowLocationPicker(false);
    // Background cache sync for offline support
    fullCacheSync(loc.id).catch(() => {});
  }

  // Barcode scan handler
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    try {
      const res = await axios.get(`/api/modules/product-catalog/product/barcode-lookup/${encodeURIComponent(barcode)}`);
      const { product: p, variant: v } = res.data;
      if (p && p.status === 'active') {
        let price = parseFloat(p.sellingPrice);
        if (selectedLocation) {
          try {
            const priceRes = await axios.get(`/api/modules/product-catalog/product/${p.id}`);
            const locPrice = priceRes.data.locationPrices?.find((lp: any) => lp.locationId === selectedLocation.id);
            if (locPrice?.sellingPrice) price = parseFloat(locPrice.sellingPrice);
          } catch {}
        }
        cart.addItem({
          productId: p.id, variantId: v?.id || null,
          skuCode: v?.variantSku || p.skuCode,
          productName: p.name + (v?.attributes ? ` (${Object.values(v.attributes).join(', ')})` : ''),
          unitPrice: price, taxApplicable: p.taxApplicable, imageUrl: null,
        });
        playSuccessBeep();
      } else {
        playErrorBeep();
        toast.error('Product not available');
      }
    } catch {
      playErrorBeep();
      toast.error(`Barcode not found: ${barcode}`);
    }
  }, [selectedLocation, cart]);

  useBarcodeScanner({ onScan: handleBarcodeScan, enabled: !showCheckout && !isLocked });

  function openCheckoutWith(method: 'cash' | 'card' | 'qris' | 'transfer') {
    if (cart.state.items.length === 0) return;
    if (!shift.isShiftOpen) { toast.error('Open a shift first'); return; }
    setCheckoutPaymentMethod(method);
    setShowCheckout(true);
  }

  // Hold current cart
  async function handleHold() {
    if (cart.state.items.length === 0) { toast.error('Cart is empty'); return; }
    if (!selectedLocation) { toast.error('No location'); return; }
    try {
      const total = cart.state.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      await axios.post('/api/modules/pos/transaction/hold', {
        locationId: selectedLocation.id,
        cartData: { items: cart.state.items, transactionDiscount: cart.state.transactionDiscount },
        totalAmount: total,
      });
      cart.clear();
      toast.success('Transaction held');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to hold');
    }
  }

  usePosKeyboard({
    onPayCash: () => openCheckoutWith('cash'),
    onPayCard: () => openCheckoutWith('card'),
    onPayQris: () => openCheckoutWith('qris'),
    onPayTransfer: () => openCheckoutWith('transfer'),
    onToggleView: () => setViewMode(v => v === 'grid' ? 'list' : 'grid'),
    onClearCart: () => cart.clear(),
    enabled: !showCheckout && !isLocked,
  });

  const timeStr = currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = currentTime.toLocaleDateString('id-ID', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="flex flex-col h-full">
      {/* Top Bar */}
      <div className="flex items-center justify-between h-12 px-4 border-b bg-card shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <MapPin size={14} className="text-primary" />
            {selectedLocation ? (
              <button onClick={() => setShowLocationPicker(true)} className="hover:underline">
                {selectedLocation.name}
              </button>
            ) : (
              <span className="text-muted-foreground">No location</span>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {user?.fullname || user?.username || 'Cashier'}
          </div>
          {/* Shift Status */}
          {shift.isShiftOpen ? (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-green-600 font-medium">Shift Open</span>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-1.5" onClick={() => setShiftDialogMode('cash-drop')}>
                <ArrowDownToLine size={12} className="mr-0.5" /> Drop
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-1.5" onClick={() => setShiftDialogMode('close')}>
                <DollarSign size={12} className="mr-0.5" /> Close
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => setShiftDialogMode('open')}>
              <DollarSign size={12} className="mr-0.5" /> Open Shift
            </Button>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Held Transactions Badge */}
          <HeldTransactions locationId={selectedLocation?.id || null} />
          <PrinterStatus />
          <SyncStatus locationId={selectedLocation?.id || null} />
          <div className="hidden lg:flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock size={14} />
            <span>{dateStr} {timeStr}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/console/dashboard')} className="h-8">
            <LogOut size={14} className="mr-1" /><span className="hidden sm:inline"> Exit</span>
          </Button>
        </div>
      </div>

      {/* Mobile Tab Toggle (visible below lg) */}
      <div className="flex lg:hidden border-b">
        <button
          className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${mobileView === 'products' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          onClick={() => setMobileView('products')}
        >
          Products
        </button>
        <button
          className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${mobileView === 'cart' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          onClick={() => setMobileView('cart')}
        >
          Cart {cart.totals.itemCount > 0 && `(${cart.totals.itemCount})`}
        </button>
      </div>

      {/* Main Content — side-by-side on lg+, tabbed on mobile */}
      <div className="flex flex-1 overflow-hidden">
        <div className={`flex-1 overflow-hidden ${mobileView === 'cart' ? 'hidden lg:block' : ''}`}>
          <ProductGrid
            locationId={selectedLocation?.id || null}
            viewMode={viewMode}
            onToggleView={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
          />
        </div>
        <div className={`w-full lg:w-[380px] shrink-0 overflow-hidden ${mobileView === 'products' ? 'hidden lg:block' : ''}`}>
          <CartPanel onCheckout={() => openCheckoutWith('cash')} onHold={handleHold} />
        </div>
      </div>

      {/* Dialogs */}
      <CheckoutDialog open={showCheckout} onClose={() => setShowCheckout(false)} defaultPaymentMethod={checkoutPaymentMethod} />
      <ShiftDialog mode={shiftDialogMode} onClose={() => setShiftDialogMode(null)} locationId={selectedLocation?.id || null} />
      <LockScreen visible={isLocked} onUnlock={() => setIsLocked(false)} />

      {/* Location Picker */}
      {showLocationPicker && locations.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg border p-6 w-full max-w-[400px] mx-4 shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Select POS Location</h2>
            <div className="space-y-2">
              {locations.map(loc => (
                <button key={loc.id} onClick={() => selectLocation(loc)} className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent hover:border-primary transition-colors text-left">
                  <MapPin size={18} className="text-primary shrink-0" />
                  <div>
                    <p className="font-medium">{loc.name}</p>
                    <p className="text-xs text-muted-foreground">{loc.code}</p>
                  </div>
                </button>
              ))}
            </div>
            {selectedLocation && (
              <Button variant="outline" className="mt-4 w-full" onClick={() => setShowLocationPicker(false)}>Cancel</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
