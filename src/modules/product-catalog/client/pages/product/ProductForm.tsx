import { Button } from "@client/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@client/components/ui/form";
import { Input } from "@client/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@client/components/ui/select";
import { Switch } from "@client/components/ui/switch";
import { Textarea } from "@client/components/ui/textarea";
import axios from "axios";
import { Pencil, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { UseFormReturn } from "react-hook-form";
import z from "zod";
import { productFormSchema } from "./productFormSchema";

interface CategoryOption {
  id: string;
  name: string;
}

interface ProductFormProps {
  form: UseFormReturn<z.infer<typeof productFormSchema>>;
  onSubmit?: (values: z.infer<typeof productFormSchema>) => void;
  onCancel?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  readonly?: boolean;
}

const ProductForm = ({ form, onSubmit, onCancel, onEdit, onDelete, readonly = false }: ProductFormProps) => {
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  useEffect(() => {
    axios.get('/api/modules/product-catalog/category', {
      params: { perPage: 1000, sort: 'name', order: 'asc' }
    }).then((response) => {
      setCategories(response.data.categories || []);
    }).catch((error) => {
      console.error("Error fetching categories:", error);
    });
  }, []);

  return (
    <Form {...(form as any)}>
      <form onSubmit={form.handleSubmit(onSubmit ? onSubmit : () => { })} className="space-y-4">
        <FormField
          disabled={readonly}
          control={form.control}
          name="id"
          render={({ field }) => (
            <FormItem hidden>
              <FormControl>
                <Input {...field} hidden />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          disabled={readonly}
          control={form.control}
          name="skuCode"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                SKU Code <span className="text-destructive">*</span>
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          disabled={readonly}
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Name <span className="text-destructive">*</span>
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          disabled={readonly}
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Description
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <FormControl>
                  <Textarea {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          disabled={readonly}
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Category
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <Select
                  disabled={readonly}
                  onValueChange={(val) => field.onChange(val === "__none__" ? null : val)}
                  value={field.value || "__none__"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          disabled={readonly}
          control={form.control}
          name="brand"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Brand
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <FormControl>
                  <Input {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          disabled={readonly}
          control={form.control}
          name="uom"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                UoM
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          disabled={readonly}
          control={form.control}
          name="baseCostPrice"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Base Cost Price
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          disabled={readonly}
          control={form.control}
          name="sellingPrice"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Selling Price
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          disabled={readonly}
          control={form.control}
          name="taxApplicable"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Tax Applicable
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <FormControl>
                  <Switch
                    disabled={readonly}
                    checked={field.value || false}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          disabled={readonly}
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Status
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <Select disabled={readonly} onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="discontinued">Discontinued</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        {!readonly && (
          <div className="flex gap-2 pt-2">
            <Button type="submit">
              <Save size={20} />Save
            </Button>
            <Button type="button" variant="outline" onClick={onCancel ? onCancel : () => { }}>
              <X size={20} />Cancel
            </Button>
          </div>
        )}
        {readonly && (
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onEdit ? onEdit : () => { }}>
              <Pencil size={20} />Edit
            </Button>
            <Button type="button" variant="destructive" onClick={onDelete ? onDelete : () => { }}>
              <X size={20} />Delete
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
};

export default ProductForm;
