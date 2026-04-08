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
import { returnFormSchema } from "./returnFormSchema";

interface GrnOption {
  id: string;
  grnNumber: string;
  status: string;
  poNumber?: string;
  supplierName?: string;
}

interface ReturnableItem {
  grnItemId: string;
  productId: string;
  skuCode: string;
  productName: string;
  acceptedQuantity: number;
  alreadyReturned: number;
  returnableQuantity: number;
  uom: string;
}

const REASON_CODES = [
  { value: 'defective', label: 'Defective' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'expired', label: 'Expired' },
  { value: 'excess', label: 'Excess Stock' },
  { value: 'wrong_item', label: 'Wrong Item' },
];

const SupplierReturnAdd = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [availableGrns, setAvailableGrns] = useState<GrnOption[]>([]);
  const [selectedGrnId, setSelectedGrnId] = useState<string>('');
  const [returnableItems, setReturnableItems] = useState<ReturnableItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [grnInfo, setGrnInfo] = useState<any>(null);

  const { items: breadcrumbs } = useBreadcrumbs(
    createBreadcrumbItems([
      { label: "Returns List", onClick: () => navigate("/console/modules/supplier-return/return") },
      { label: "New Return" },
    ])
  );

  const form = useForm({
    resolver: zodResolver(returnFormSchema as any),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
      grnId: "",
      returnDate: new Date().toISOString().split('T')[0],
      notes: "",
      items: [] as any[],
    },
  });

  const { control, handleSubmit, setValue, formState: { errors } } = form;
  const { fields, replace } = useFieldArray({ control, name: 'items' });
  const watchedItems = useWatch({ control, name: 'items' });

  // Fetch available GRNs (accepted or stock_updated)
  useEffect(() => {
    axios.get('/api/modules/grn/grn', { params: { perPage: 1000, status: 'accepted' } })
      .then(res => {
        const acceptedGrns = (res.data.grns || []).map((g: any) => ({
          id: g.id, grnNumber: g.grnNumber, status: g.status, poNumber: g.poNumber,
        }));
        return axios.get('/api/modules/grn/grn', { params: { perPage: 1000, status: 'stock_updated' } })
          .then(res2 => {
            const updatedGrns = (res2.data.grns || []).map((g: any) => ({
              id: g.id, grnNumber: g.grnNumber, status: g.status, poNumber: g.poNumber,
            }));
            setAvailableGrns([...acceptedGrns, ...updatedGrns]);
          });
      })
      .catch(console.error);
  }, []);

  // Fetch returnable items when GRN changes
  useEffect(() => {
    if (selectedGrnId) {
      setLoadingItems(true);
      axios.get(`/api/modules/supplier-return/return/grn/${selectedGrnId}/returnable`)
        .then(res => {
          const items = res.data.items || [];
          setReturnableItems(items);
          setGrnInfo(res.data.grn);
          // Pre-populate form items
          const formItems = items.map((item: ReturnableItem) => ({
            grnItemId: item.grnItemId,
            productId: item.productId,
            skuCode: item.skuCode,
            productName: item.productName,
            acceptedQuantity: item.acceptedQuantity,
            alreadyReturned: item.alreadyReturned,
            returnableQuantity: item.returnableQuantity,
            returnQuantity: 0,
            reasonCode: '',
            reasonNotes: '',
            uom: item.uom,
          }));
          replace(formItems);
          setValue('grnId', selectedGrnId);
        })
        .catch(err => {
          console.error("Error fetching returnable items:", err);
          toast.error(err.response?.data?.error || "Failed to fetch returnable items.");
        })
        .finally(() => setLoadingItems(false));
    }
  }, [selectedGrnId]);

  function onSubmit(values: any) {
    // Filter out items with 0 return quantity
    const itemsToReturn = values.items.filter((item: any) => item.returnQuantity > 0);
    if (itemsToReturn.length === 0) {
      toast.error("At least one item must have a return quantity greater than 0.");
      return;
    }

    // Validate each item has a reason code
    for (const item of itemsToReturn) {
      if (!item.reasonCode) {
        toast.error(`Please select a reason for ${item.productName}.`);
        return;
      }
    }

    setIsLoading(true);
    const payload = {
      grnId: values.grnId,
      returnDate: values.returnDate,
      notes: values.notes || null,
      items: itemsToReturn.map((item: any) => ({
        grnItemId: item.grnItemId,
        productId: item.productId,
        skuCode: item.skuCode,
        productName: item.productName,
        returnQuantity: item.returnQuantity,
        reasonCode: item.reasonCode,
        reasonNotes: item.reasonNotes || null,
        uom: item.uom,
      })),
    };

    axios
      .post("/api/modules/supplier-return/return", payload)
      .then(() => {
        navigate("/console/modules/supplier-return/return");
        toast.success("Supplier return has been created.");
      })
      .catch((error) => {
        const msg = error.response?.data?.message || error.response?.data?.error || "Failed to create supplier return.";
        toast.error(msg);
      })
      .finally(() => { setIsLoading(false); });
  }

  function onCancel() {
    navigate("/console/modules/supplier-return/return");
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <h1 className="text-2xl font-semibold">New Supplier Return</h1>
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
                  <Label>Goods Received Note <span className="text-red-500">*</span></Label>
                  <Select value={selectedGrnId} onValueChange={(val) => setSelectedGrnId(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select GRN to return against" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableGrns.map(grn => (
                        <SelectItem key={grn.id} value={grn.id}>
                          {grn.grnNumber} - PO: {grn.poNumber || 'N/A'} ({grn.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.grnId && <p className="text-sm text-red-500">{(errors.grnId as any).message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Return Date <span className="text-red-500">*</span></Label>
                  <Controller name="returnDate" control={control} render={({ field }) => (
                    <Input type="date" {...field} />
                  )} />
                  {errors.returnDate && <p className="text-sm text-red-500">{(errors.returnDate as any).message}</p>}
                </div>

                {grnInfo && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Supplier</Label>
                      <p className="text-sm font-medium">{grnInfo.supplierName || '-'}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">PO Number</Label>
                      <p className="text-sm font-medium">{grnInfo.poNumber || '-'}</p>
                    </div>
                  </>
                )}

                <div className="space-y-2 md:col-span-2">
                  <Label>Notes</Label>
                  <Controller name="notes" control={control} render={({ field }) => (
                    <Textarea {...field} value={field.value || ''} placeholder="Reason for return, additional details..." rows={2} />
                  )} />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium">Return Items</h3>

                {!selectedGrnId && (
                  <p className="text-sm text-muted-foreground">Select a GRN to see returnable items.</p>
                )}

                {loadingItems && <p className="text-sm text-muted-foreground">Loading returnable items...</p>}

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
                          <TableHead className="w-[80px] text-right">Accepted</TableHead>
                          <TableHead className="w-[80px] text-right">Already Ret.</TableHead>
                          <TableHead className="w-[80px] text-right">Returnable</TableHead>
                          <TableHead className="w-[90px]">Return Qty</TableHead>
                          <TableHead className="w-[130px]">Reason</TableHead>
                          <TableHead className="w-[150px]">Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fields.map((field, index) => {
                          const item = watchedItems?.[index];
                          return (
                            <TableRow key={field.id}>
                              <TableCell className="font-medium text-sm">{item?.productName}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{item?.skuCode}</TableCell>
                              <TableCell className="text-right">{item?.acceptedQuantity}</TableCell>
                              <TableCell className="text-right">{item?.alreadyReturned}</TableCell>
                              <TableCell className="text-right font-medium">{item?.returnableQuantity}</TableCell>
                              <TableCell>
                                <Controller name={`items.${index}.returnQuantity`} control={control} render={({ field: f }) => (
                                  <Input type="number" min={0} max={item?.returnableQuantity} className="h-8 w-20" {...f}
                                    onChange={e => f.onChange(Number(e.target.value))} />
                                )} />
                              </TableCell>
                              <TableCell>
                                {(item?.returnQuantity || 0) > 0 && (
                                  <Controller name={`items.${index}.reasonCode`} control={control} render={({ field: f }) => (
                                    <Select value={f.value || ''} onValueChange={f.onChange}>
                                      <SelectTrigger className="h-8 w-28"><SelectValue placeholder="Reason" /></SelectTrigger>
                                      <SelectContent>
                                        {REASON_CODES.map(r => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
                                      </SelectContent>
                                    </Select>
                                  )} />
                                )}
                              </TableCell>
                              <TableCell>
                                {(item?.returnQuantity || 0) > 0 && (
                                  <Controller name={`items.${index}.reasonNotes`} control={control} render={({ field: f }) => (
                                    <Input className="h-8 w-36" {...f} value={f.value || ''} placeholder="Details..." />
                                  )} />
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {fields.length > 0 && returnableItems.length === 0 && !loadingItems && selectedGrnId && (
                  <p className="text-sm text-muted-foreground">All items for this GRN have been fully returned.</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button type="submit" disabled={fields.length === 0 || isLoading}>Create Return</Button>
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(SupplierReturnAdd, { moduleId: 'supplier-return', moduleName: 'Supplier Returns & Credit Notes' });
