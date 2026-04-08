import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller, useWatch } from "react-hook-form";

import Breadcrumbs, { createBreadcrumbItems, useBreadcrumbs } from "@client/components/console/Breadcrumbs";
import { withModuleAuthorization } from "@client/components/auth/withModuleAuthorization";
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { Textarea } from '@client/components/ui/textarea';
import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { grnFormSchema } from "./grnFormSchema";

interface PoOption {
  id: string;
  poNumber: string;
  status: string;
  supplierName?: string;
}

interface ReceivableItem {
  purchaseOrderItemId: string;
  productId: string;
  skuCode: string;
  productName: string;
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  uom: string;
}

interface LocationOption {
  id: string;
  code: string;
  name: string;
}

const REJECTION_REASONS = [
  { value: 'defective', label: 'Defective' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'expired', label: 'Expired' },
  { value: 'wrong_item', label: 'Wrong Item' },
  { value: 'short_quantity', label: 'Short Quantity' },
  { value: 'other', label: 'Other' },
];

const GrnAdd = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [availablePos, setAvailablePos] = useState<PoOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<string>('');
  const [receivableItems, setReceivableItems] = useState<ReceivableItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const { items: breadcrumbs } = useBreadcrumbs(
    createBreadcrumbItems([
      { label: "GRN List", onClick: () => navigate("/console/modules/grn/grn") },
      { label: "Receive Goods" },
    ])
  );

  const form = useForm({
    resolver: zodResolver(grnFormSchema as any),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
      purchaseOrderId: "",
      locationId: null as string | null,
      receivedDate: new Date().toISOString().split('T')[0],
      deliveryNoteRef: "",
      invoiceRef: "",
      notes: "",
      items: [] as any[],
    },
  });

  const { control, handleSubmit, setValue, formState: { errors } } = form;
  const { fields, replace } = useFieldArray({ control, name: 'items' });
  const watchedItems = useWatch({ control, name: 'items' });

  // Fetch available POs (sent or partially_received)
  useEffect(() => {
    axios.get('/api/modules/purchase-order/po', { params: { perPage: 1000, status: 'sent' } })
      .then(res => {
        const sentPos = (res.data.orders || []).map((po: any) => ({
          id: po.id, poNumber: po.poNumber, status: po.status, supplierName: po.supplierName,
        }));
        // Also fetch partially_received
        return axios.get('/api/modules/purchase-order/po', { params: { perPage: 1000, status: 'partially_received' } })
          .then(res2 => {
            const partialPos = (res2.data.orders || []).map((po: any) => ({
              id: po.id, poNumber: po.poNumber, status: po.status, supplierName: po.supplierName,
            }));
            setAvailablePos([...sentPos, ...partialPos]);
          });
      })
      .catch(console.error);

    axios.get('/api/modules/location-management/location', { params: { perPage: 1000, sort: 'name', order: 'asc' } })
      .then(res => {
        const active = (res.data.locations || []).filter((l: any) => l.status === 'active');
        setLocations(active);
      })
      .catch(console.error);
  }, []);

  // Fetch receivable items when PO changes
  useEffect(() => {
    if (selectedPoId) {
      setLoadingItems(true);
      axios.get(`/api/modules/grn/grn/po/${selectedPoId}/receivable`)
        .then(res => {
          const items = res.data.items || [];
          setReceivableItems(items);
          // Pre-populate form items with receivable data
          const formItems = items.map((item: ReceivableItem) => ({
            purchaseOrderItemId: item.purchaseOrderItemId,
            productId: item.productId,
            skuCode: item.skuCode,
            productName: item.productName,
            orderedQuantity: item.orderedQuantity,
            previouslyReceivedQuantity: item.receivedQuantity,
            remainingQuantity: item.remainingQuantity,
            receivedQuantity: item.remainingQuantity, // Default: receive all remaining
            acceptedQuantity: item.remainingQuantity,
            rejectedQuantity: 0,
            rejectionReasonCode: '',
            rejectionNotes: '',
            batchNumber: '',
            lotNumber: '',
            expiryDate: '',
            uom: item.uom,
          }));
          replace(formItems);
          setValue('purchaseOrderId', selectedPoId);
        })
        .catch(err => {
          console.error("Error fetching receivable items:", err);
          toast.error(err.response?.data?.error || "Failed to fetch receivable items.");
        })
        .finally(() => setLoadingItems(false));
    }
  }, [selectedPoId]);

  // Auto-update acceptedQuantity when receivedQuantity or rejectedQuantity changes
  function handleReceivedChange(index: number, receivedQty: number) {
    setValue(`items.${index}.receivedQuantity`, receivedQty);
    const currentRejected = watchedItems?.[index]?.rejectedQuantity || 0;
    setValue(`items.${index}.acceptedQuantity`, Math.max(0, receivedQty - currentRejected));
  }

  function handleRejectedChange(index: number, rejectedQty: number) {
    setValue(`items.${index}.rejectedQuantity`, rejectedQty);
    const currentReceived = watchedItems?.[index]?.receivedQuantity || 0;
    setValue(`items.${index}.acceptedQuantity`, Math.max(0, currentReceived - rejectedQty));
  }

  function onSubmit(values: any) {
    setIsLoading(true);
    const payload = { ...values };
    if (payload.locationId === '') payload.locationId = null;
    if (payload.deliveryNoteRef === '') payload.deliveryNoteRef = null;
    if (payload.invoiceRef === '') payload.invoiceRef = null;
    if (payload.notes === '') payload.notes = null;

    axios
      .post("/api/modules/grn/grn", payload)
      .then(() => {
        navigate("/console/modules/grn/grn");
        toast.success("Goods received note has been created.");
      })
      .catch((error) => {
        const msg = error.response?.data?.message || error.response?.data?.error || "Failed to create GRN.";
        toast.error(msg);
      })
      .finally(() => { setIsLoading(false); });
  }

  function onCancel() {
    navigate("/console/modules/grn/grn");
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <h1 className="text-2xl font-semibold">Goods Receiving</h1>
        <div className="ml-auto px-4">
          <Breadcrumbs items={breadcrumbs} loading={isLoading} />
        </div>
      </header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          <div className="bg-card rounded-lg border p-6 w-full">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Header Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Purchase Order <span className="text-red-500">*</span></Label>
                  <Select value={selectedPoId} onValueChange={(val) => setSelectedPoId(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select PO to receive against" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePos.map(po => (
                        <SelectItem key={po.id} value={po.id}>
                          {po.poNumber} - {po.supplierName || 'Unknown'} ({po.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.purchaseOrderId && <p className="text-sm text-red-500">{(errors.purchaseOrderId as any).message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Delivery Location</Label>
                  <Controller name="locationId" control={control} render={({ field }) => (
                    <Select value={field.value || ''} onValueChange={(val) => field.onChange(val || null)}>
                      <SelectTrigger><SelectValue placeholder="Select location (optional)" /></SelectTrigger>
                      <SelectContent>
                        {locations.map(l => (<SelectItem key={l.id} value={l.id}>{l.code} - {l.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  )} />
                </div>

                <div className="space-y-2">
                  <Label>Received Date <span className="text-red-500">*</span></Label>
                  <Controller name="receivedDate" control={control} render={({ field }) => (
                    <Input type="date" {...field} />
                  )} />
                  {errors.receivedDate && <p className="text-sm text-red-500">{(errors.receivedDate as any).message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Delivery Note Ref</Label>
                  <Controller name="deliveryNoteRef" control={control} render={({ field }) => (
                    <Input {...field} value={field.value || ''} placeholder="Supplier's delivery note number" />
                  )} />
                </div>

                <div className="space-y-2">
                  <Label>Invoice Ref</Label>
                  <Controller name="invoiceRef" control={control} render={({ field }) => (
                    <Input {...field} value={field.value || ''} placeholder="Supplier's invoice number" />
                  )} />
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Controller name="notes" control={control} render={({ field }) => (
                    <Textarea {...field} value={field.value || ''} placeholder="Additional notes..." rows={2} />
                  )} />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium">Receiving Items</h3>

                {!selectedPoId && (
                  <p className="text-sm text-muted-foreground">Select a purchase order to see receivable items.</p>
                )}

                {loadingItems && <p className="text-sm text-muted-foreground">Loading receivable items...</p>}

                {errors.items && typeof errors.items === 'object' && 'message' in errors.items && (
                  <p className="text-sm text-red-500">{(errors.items as any).message}</p>
                )}

                {fields.length > 0 && (
                  <div className="bg-card overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader className="bg-muted/20">
                        <TableRow>
                          <TableHead className="w-[200px]">Product</TableHead>
                          <TableHead className="w-[80px]">SKU</TableHead>
                          <TableHead className="w-[70px] text-right">Ordered</TableHead>
                          <TableHead className="w-[70px] text-right">Prev Rcvd</TableHead>
                          <TableHead className="w-[70px] text-right">Remaining</TableHead>
                          <TableHead className="w-[80px]">Received</TableHead>
                          <TableHead className="w-[80px]">Accepted</TableHead>
                          <TableHead className="w-[80px]">Rejected</TableHead>
                          <TableHead className="w-[120px]">Reason</TableHead>
                          <TableHead className="w-[100px]">Batch #</TableHead>
                          <TableHead className="w-[100px]">Expiry</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fields.map((field, index) => {
                          const item = watchedItems?.[index];
                          const rejected = item?.rejectedQuantity || 0;
                          return (
                            <TableRow key={field.id}>
                              <TableCell className="font-medium text-sm">{item?.productName}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{item?.skuCode}</TableCell>
                              <TableCell className="text-right">{item?.orderedQuantity}</TableCell>
                              <TableCell className="text-right">{item?.previouslyReceivedQuantity}</TableCell>
                              <TableCell className="text-right font-medium">{item?.remainingQuantity}</TableCell>
                              <TableCell>
                                <Controller name={`items.${index}.receivedQuantity`} control={control} render={({ field: f }) => (
                                  <Input type="number" min={0} max={item?.remainingQuantity} className="h-8 w-20" {...f}
                                    onChange={e => handleReceivedChange(index, Number(e.target.value))} />
                                )} />
                              </TableCell>
                              <TableCell>
                                <Controller name={`items.${index}.acceptedQuantity`} control={control} render={({ field: f }) => (
                                  <Input type="number" min={0} className="h-8 w-20 bg-muted" {...f} readOnly />
                                )} />
                              </TableCell>
                              <TableCell>
                                <Controller name={`items.${index}.rejectedQuantity`} control={control} render={({ field: f }) => (
                                  <Input type="number" min={0} className="h-8 w-20" {...f}
                                    onChange={e => handleRejectedChange(index, Number(e.target.value))} />
                                )} />
                              </TableCell>
                              <TableCell>
                                {rejected > 0 && (
                                  <Controller name={`items.${index}.rejectionReasonCode`} control={control} render={({ field: f }) => (
                                    <Select value={f.value || ''} onValueChange={f.onChange}>
                                      <SelectTrigger className="h-8 w-28"><SelectValue placeholder="Reason" /></SelectTrigger>
                                      <SelectContent>
                                        {REJECTION_REASONS.map(r => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
                                      </SelectContent>
                                    </Select>
                                  )} />
                                )}
                              </TableCell>
                              <TableCell>
                                <Controller name={`items.${index}.batchNumber`} control={control} render={({ field: f }) => (
                                  <Input className="h-8 w-24" {...f} value={f.value || ''} placeholder="Batch" />
                                )} />
                              </TableCell>
                              <TableCell>
                                <Controller name={`items.${index}.expiryDate`} control={control} render={({ field: f }) => (
                                  <Input type="date" className="h-8 w-32" {...f} value={f.value || ''} />
                                )} />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {fields.length > 0 && receivableItems.length === 0 && !loadingItems && selectedPoId && (
                  <p className="text-sm text-muted-foreground">All items for this PO have been fully received.</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button type="submit" disabled={fields.length === 0 || isLoading}>Create GRN</Button>
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(GrnAdd, { moduleId: 'grn', moduleName: 'Goods Received Note' });
