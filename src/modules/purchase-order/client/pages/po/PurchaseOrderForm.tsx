import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { Textarea } from '@client/components/ui/textarea';
import axios from 'axios';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useFieldArray, useWatch } from 'react-hook-form';

interface SupplierOption {
  id: string;
  code: string;
  name: string;
}

interface LocationOption {
  id: string;
  code: string;
  name: string;
}

interface SupplierProductOption {
  productId: string;
  productName: string;
  productSkuCode: string;
  supplierPrice: string;
  supplierSku: string | null;
  minOrderQty: number;
}

interface TaxConfigInfo {
  id: string;
  ratePercent: string;
  calcMode: string;
}

function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

interface PurchaseOrderFormProps {
  form: any;
  onSubmit: (values: any) => void;
  onCancel: () => void;
  isEdit?: boolean;
}

const PurchaseOrderForm = ({ form, onSubmit, onCancel, isEdit = false }: PurchaseOrderFormProps) => {
  const { control, handleSubmit, setValue, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [supplierProducts, setSupplierProducts] = useState<SupplierProductOption[]>([]);
  const [taxConfig, setTaxConfig] = useState<TaxConfigInfo | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const watchedSupplierId = useWatch({ control, name: 'supplierId' });
  const watchedItems = useWatch({ control, name: 'items' });

  // Fetch suppliers and locations on mount
  useEffect(() => {
    axios.get('/api/modules/supplier-management/supplier', { params: { perPage: 1000, sort: 'name', order: 'asc' } })
      .then(res => {
        const active = (res.data.suppliers || []).filter((s: any) => s.status === 'active');
        setSuppliers(active);
      })
      .catch(console.error);

    axios.get('/api/modules/location-management/location', { params: { perPage: 1000, sort: 'name', order: 'asc' } })
      .then(res => {
        const active = (res.data.locations || []).filter((l: any) => l.status === 'active');
        setLocations(active);
      })
      .catch(console.error);

    axios.get('/api/modules/tax-configuration/config', { params: { status: 'active' } })
      .then(res => {
        const configs = res.data.configs || res.data;
        const active = Array.isArray(configs) ? configs.find((c: any) => c.status === 'active') : configs;
        if (active) {
          setTaxConfig({ id: active.id, ratePercent: active.ratePercent, calcMode: active.calcMode });
        }
      })
      .catch(console.error);
  }, []);

  // Fetch supplier products when supplier changes
  useEffect(() => {
    if (watchedSupplierId) {
      setLoadingProducts(true);
      axios.get(`/api/modules/supplier-management/supplier/${watchedSupplierId}/products`)
        .then(res => {
          setSupplierProducts(res.data.products || []);
        })
        .catch(console.error)
        .finally(() => setLoadingProducts(false));
    } else {
      setSupplierProducts([]);
    }
  }, [watchedSupplierId]);

  // Calculate line totals and grand total
  const taxRate = taxConfig ? parseFloat(taxConfig.ratePercent) / 100 : 0;
  const calcMode = taxConfig?.calcMode || 'exclusive';

  const lineCalculations = (watchedItems || []).map((item: any) => {
    const qty = Number(item?.quantity) || 0;
    const price = Number(item?.unitPrice) || 0;
    const discPct = Number(item?.discountPercent) || 0;
    const gross = qty * price;
    const disc = gross * (discPct / 100);
    const afterDisc = gross - disc;
    let tax = 0;
    let lineTotal = 0;
    if (calcMode === 'inclusive') {
      tax = afterDisc - afterDisc / (1 + taxRate);
      lineTotal = afterDisc;
    } else {
      tax = afterDisc * taxRate;
      lineTotal = afterDisc + tax;
    }
    return { gross, disc, tax: Math.round(tax * 100) / 100, lineTotal: Math.round(lineTotal * 100) / 100 };
  });

  const subtotal = lineCalculations.reduce((sum: number, lc: any) => sum + (lc.gross - lc.disc), 0);
  const totalTax = lineCalculations.reduce((sum: number, lc: any) => sum + lc.tax, 0);
  const totalDiscount = lineCalculations.reduce((sum: number, lc: any) => sum + lc.disc, 0);
  const grandTotal = lineCalculations.reduce((sum: number, lc: any) => sum + lc.lineTotal, 0);

  function handleProductSelect(index: number, productId: string) {
    const sp = supplierProducts.find(p => p.productId === productId);
    if (sp) {
      setValue(`items.${index}.productId`, sp.productId);
      setValue(`items.${index}.productName`, sp.productName);
      setValue(`items.${index}.skuCode`, sp.productSkuCode);
      setValue(`items.${index}.unitPrice`, parseFloat(sp.supplierPrice));
      setValue(`items.${index}.supplierSku`, sp.supplierSku || '');
    }
  }

  function addLineItem() {
    append({
      productId: '',
      productName: '',
      skuCode: '',
      quantity: 1,
      unitPrice: 0,
      discountPercent: 0,
      uom: 'pcs',
      supplierSku: '',
      notes: '',
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="supplierId">Supplier <span className="text-red-500">*</span></Label>
          <Controller
            name="supplierId"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.code} - {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.supplierId && <p className="text-sm text-red-500">{(errors.supplierId as any).message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="locationId">Delivery Location</Label>
          <Controller
            name="locationId"
            control={control}
            render={({ field }) => (
              <Select value={field.value || ''} onValueChange={(val) => field.onChange(val || null)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.code} - {l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="orderDate">Order Date <span className="text-red-500">*</span></Label>
          <Controller
            name="orderDate"
            control={control}
            render={({ field }) => (
              <Input type="date" {...field} />
            )}
          />
          {errors.orderDate && <p className="text-sm text-red-500">{(errors.orderDate as any).message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="expectedDeliveryDate">Expected Delivery Date</Label>
          <Controller
            name="expectedDeliveryDate"
            control={control}
            render={({ field }) => (
              <Input type="date" {...field} value={field.value || ''} />
            )}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <Textarea {...field} value={field.value || ''} placeholder="Additional notes..." rows={2} />
            )}
          />
        </div>

        {isEdit && (
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="changeReason">Change Reason <span className="text-red-500">*</span></Label>
            <Controller
              name="changeReason"
              control={control}
              render={({ field }) => (
                <Input {...field} value={field.value || ''} placeholder="Reason for this amendment..." />
              )}
            />
            {errors.changeReason && <p className="text-sm text-red-500">{(errors.changeReason as any).message}</p>}
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Line Items</h3>
          <Button type="button" variant="outline" size="sm" onClick={addLineItem} disabled={!watchedSupplierId}>
            <Plus size={16} className="mr-1" /> Add Item
          </Button>
        </div>

        {!watchedSupplierId && (
          <p className="text-sm text-muted-foreground">Select a supplier first to add line items.</p>
        )}

        {errors.items && typeof errors.items === 'object' && 'message' in errors.items && (
          <p className="text-sm text-red-500">{(errors.items as any).message}</p>
        )}

        {fields.length > 0 && (
          <div className="bg-card overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead className="w-[250px]">Product</TableHead>
                  <TableHead className="w-[100px]">SKU</TableHead>
                  <TableHead className="w-[80px]">Qty</TableHead>
                  <TableHead className="w-[120px]">Unit Price</TableHead>
                  <TableHead className="w-[80px]">Disc %</TableHead>
                  <TableHead className="w-[60px]">UOM</TableHead>
                  <TableHead className="w-[120px] text-right">Line Total</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => (
                  <TableRow key={field.id}>
                    <TableCell>
                      <Controller
                        name={`items.${index}.productId`}
                        control={control}
                        render={({ field: f }) => (
                          <Select
                            value={f.value}
                            onValueChange={(val) => {
                              f.onChange(val);
                              handleProductSelect(index, val);
                            }}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              {supplierProducts.map(sp => (
                                <SelectItem key={sp.productId} value={sp.productId}>
                                  {sp.productSkuCode} - {sp.productName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        name={`items.${index}.skuCode`}
                        control={control}
                        render={({ field: f }) => (
                          <span className="text-sm text-muted-foreground">{f.value || '-'}</span>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        name={`items.${index}.quantity`}
                        control={control}
                        render={({ field: f }) => (
                          <Input type="number" min={1} className="h-8 w-20" {...f} onChange={e => f.onChange(Number(e.target.value))} />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        name={`items.${index}.unitPrice`}
                        control={control}
                        render={({ field: f }) => (
                          <Input type="number" min={0} step="0.01" className="h-8 w-28" {...f} onChange={e => f.onChange(Number(e.target.value))} />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        name={`items.${index}.discountPercent`}
                        control={control}
                        render={({ field: f }) => (
                          <Input type="number" min={0} max={100} step="0.1" className="h-8 w-20" {...f} onChange={e => f.onChange(Number(e.target.value))} />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        name={`items.${index}.uom`}
                        control={control}
                        render={({ field: f }) => (
                          <Input className="h-8 w-16" {...f} />
                        )}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatIDR(lineCalculations[index]?.lineTotal || 0)}
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                        <Trash2 size={16} className="text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Totals */}
      {fields.length > 0 && (
        <div className="flex justify-end">
          <div className="w-72 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>{formatIDR(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount:</span>
              <span className="text-red-600">-{formatIDR(totalDiscount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                PPN ({taxConfig ? `${taxConfig.ratePercent}% ${taxConfig.calcMode}` : 'N/A'}):
              </span>
              <span>{formatIDR(totalTax)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold text-base">
              <span>Grand Total:</span>
              <span>{formatIDR(grandTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t">
        <Button type="submit">{isEdit ? 'Update PO' : 'Create PO'}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
};

export default PurchaseOrderForm;
