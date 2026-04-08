import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import Breadcrumbs, { createBreadcrumbItems, useBreadcrumbs } from "@client/components/console/Breadcrumbs";
import { withModuleAuthorization } from "@client/components/auth/withModuleAuthorization";
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { Textarea } from '@client/components/ui/textarea';
import axios from "axios";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
  sourceLocationId: z.string().min(1, "Source location required"),
  destLocationId: z.string().min(1, "Destination location required"),
  notes: z.string().optional().nullable(),
  items: z.array(z.object({
    productId: z.string().min(1), skuCode: z.string(), productName: z.string(),
    requestedQty: z.coerce.number().int().min(1), uom: z.string().default('pcs'),
  })).min(1, "At least one item required"),
});

interface LocationOpt { id: string; code: string; name: string }
interface ProductOpt { id: string; skuCode: string; name: string }

const TransferAdd = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [locations, setLocations] = useState<LocationOpt[]>([]);
  const [products, setProducts] = useState<ProductOpt[]>([]);

  const { items: breadcrumbs } = useBreadcrumbs(createBreadcrumbItems([
    { label: "Transfer List", onClick: () => navigate("/console/modules/transfer/transfer") },
    { label: "New Transfer" },
  ]));

  const form = useForm({ resolver: zodResolver(formSchema as any), mode: "onSubmit", defaultValues: {
    sourceLocationId: "", destLocationId: "", notes: "", items: [] as any[],
  }});

  const { control, handleSubmit, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  useEffect(() => {
    axios.get('/api/modules/location-management/location', { params: { perPage: 1000 } })
      .then(r => setLocations((r.data.locations || []).filter((l: any) => l.status === 'active')))
      .catch(() => {});
    axios.get('/api/modules/product-catalog/product', { params: { perPage: 1000, status: 'active' } })
      .then(r => setProducts((r.data.products || []).map((p: any) => ({ id: p.id, skuCode: p.skuCode, name: p.name }))))
      .catch(() => {});
  }, []);

  function addProduct(p: ProductOpt) {
    if (fields.some((f: any) => f.productId === p.id)) { toast.error('Product already added'); return; }
    append({ productId: p.id, skuCode: p.skuCode, productName: p.name, requestedQty: 1, uom: 'pcs' });
  }

  function onSubmit(values: any) {
    if (values.sourceLocationId === values.destLocationId) { toast.error('Source and destination must differ'); return; }
    setIsLoading(true);
    axios.post("/api/modules/transfer/transfer", values)
      .then(() => { navigate("/console/modules/transfer/transfer"); toast.success("Transfer created."); })
      .catch(err => toast.error(err.response?.data?.error || "Failed to create transfer."))
      .finally(() => setIsLoading(false));
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <h1 className="text-2xl font-semibold">New Transfer</h1>
        <div className="ml-auto px-4"><Breadcrumbs items={breadcrumbs} loading={isLoading} /></div>
      </header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2">
          <div className="bg-card rounded-lg border p-6 w-full">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source Location <span className="text-red-500">*</span></Label>
                  <Controller name="sourceLocationId" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                      <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.code} - {l.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )} />
                  {errors.sourceLocationId && <p className="text-sm text-red-500">{(errors.sourceLocationId as any).message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Destination Location <span className="text-red-500">*</span></Label>
                  <Controller name="destLocationId" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                      <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.code} - {l.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Notes</Label>
                  <Controller name="notes" control={control} render={({ field }) => (
                    <Textarea {...field} value={field.value || ''} placeholder="Transfer notes..." rows={2} />
                  )} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Transfer Items</h3>
                  <Select onValueChange={(val) => { const p = products.find(x => x.id === val); if (p) addProduct(p); }}>
                    <SelectTrigger className="w-[250px]"><SelectValue placeholder="Add product..." /></SelectTrigger>
                    <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.skuCode} - {p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {errors.items && typeof errors.items === 'object' && 'message' in errors.items && (
                  <p className="text-sm text-red-500">{(errors.items as any).message}</p>
                )}
                {fields.length > 0 && (
                  <div className="bg-card overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader className="bg-muted/20">
                        <TableRow>
                          <TableHead className="w-[200px]">Product</TableHead>
                          <TableHead className="w-[100px]">SKU</TableHead>
                          <TableHead className="w-[100px]">Quantity</TableHead>
                          <TableHead className="w-[60px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fields.map((field, idx) => (
                          <TableRow key={field.id}>
                            <TableCell>{(field as any).productName}</TableCell>
                            <TableCell className="text-muted-foreground">{(field as any).skuCode}</TableCell>
                            <TableCell>
                              <Controller name={`items.${idx}.requestedQty`} control={control} render={({ field: f }) => (
                                <Input type="number" min={1} className="h-8 w-20" {...f} onChange={e => f.onChange(Number(e.target.value))} />
                              )} />
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(idx)}>
                                <Trash2 size={14} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button type="submit" disabled={fields.length === 0 || isLoading}>Create Transfer</Button>
                <Button type="button" variant="outline" onClick={() => navigate("/console/modules/transfer/transfer")}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(TransferAdd, { moduleId: 'transfer', moduleName: 'Inter-Shop Transfers' });
