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
import axios from "axios";
import { Pencil, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { UseFormReturn } from "react-hook-form";
import z from "zod";
import { categoryFormSchema } from "./categoryFormSchema";

interface CategoryOption {
  id: string;
  name: string;
}

interface CategoryFormProps {
  form: UseFormReturn<z.infer<typeof categoryFormSchema>>;
  onSubmit?: (values: z.infer<typeof categoryFormSchema>) => void;
  onCancel?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  readonly?: boolean;
}

const CategoryForm = ({ form, onSubmit, onCancel, onEdit, onDelete, readonly = false }: CategoryFormProps) => {
  const [parentCategories, setParentCategories] = useState<CategoryOption[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  useEffect(() => {
    axios.get('/api/modules/product-catalog/category', {
      params: { perPage: 1000, sort: 'name', order: 'asc' }
    }).then((response) => {
      setParentCategories(response.data.categories || []);
      setCategoriesLoaded(true);
    }).catch((error) => {
      console.error("Error fetching parent categories:", error);
      setCategoriesLoaded(true);
    });
  }, []);

  const parentIdValue = form.watch("parentId");

  return (
    <Form {...(form as any)}>
      <form onSubmit={form.handleSubmit(onSubmit ? onSubmit : () => { })} className="space-y-4">
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
          name="parentId"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Parent Category
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <Select
                  key={`parent-select-${categoriesLoaded}-${parentIdValue}`}
                  disabled={readonly}
                  onValueChange={(val) => field.onChange(val === "__none__" ? null : val)}
                  value={field.value || "__none__"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {parentCategories
                      .map((cat) => (
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
          name="sortOrder"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Sort Order
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <FormControl>
                  <Input type="number" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))} />
                </FormControl>
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
            {onEdit && (
              <Button type="button" onClick={onEdit}>
                <Pencil size={20} />Edit
              </Button>
            )}
            {onDelete && (
              <Button type="button" variant="destructive" onClick={onDelete}>
                <X size={20} />Delete
              </Button>
            )}
          </div>
        )}
      </form>
    </Form>
  );
};

export default CategoryForm;
