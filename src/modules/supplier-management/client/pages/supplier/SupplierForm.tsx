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
import { Textarea } from "@client/components/ui/textarea";
import { Pencil, Save, X } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import z from "zod";
import { supplierFormSchema } from "./supplierFormSchema";

interface SupplierFormProps {
  form: UseFormReturn<z.infer<typeof supplierFormSchema>>;
  onSubmit?: (values: z.infer<typeof supplierFormSchema>) => void;
  onCancel?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  readonly?: boolean;
}

const SupplierForm = ({ form, onSubmit, onCancel, onEdit, onDelete, readonly = false }: SupplierFormProps) => {
  return (
    <Form {...form}>
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
          name="code"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Code <span className="text-destructive">*</span>
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
          name="npwp"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                NPWP
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
          name="address"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Address
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
          name="paymentTerms"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Payment Terms
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <FormControl>
                  <Input {...field} value={field.value || ''} placeholder="e.g. Net 30" />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          disabled={readonly}
          control={form.control}
          name="leadTimeDays"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Lead Time (Days)
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
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
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        {/* Bank Details Section */}
        <div className="border rounded-lg p-4 space-y-4">
          <h3 className="text-lg font-medium">Bank Details</h3>
          <FormField
            disabled={readonly}
            control={form.control}
            name="bankDetails.bankName"
            render={({ field }) => (
              <FormItem className="grid grid-cols-12 gap-2 items-start">
                <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                  Bank Name
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
            name="bankDetails.accountNumber"
            render={({ field }) => (
              <FormItem className="grid grid-cols-12 gap-2 items-start">
                <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                  Account Number
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
            name="bankDetails.accountHolder"
            render={({ field }) => (
              <FormItem className="grid grid-cols-12 gap-2 items-start">
                <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                  Account Holder
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
        </div>

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

export default SupplierForm;
