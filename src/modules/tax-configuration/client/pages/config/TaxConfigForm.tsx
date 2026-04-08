import { Button } from "@client/components/ui/button";
import { Calendar } from "@client/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@client/components/ui/form";
import { Input } from "@client/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@client/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@client/components/ui/select";
import { cn } from "@client/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Save, X } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import z from "zod";
import { taxConfigFormSchema } from "./taxConfigFormSchema";

interface TaxConfigFormProps {
  form: UseFormReturn<z.infer<typeof taxConfigFormSchema>>;
  onSubmit?: (values: z.infer<typeof taxConfigFormSchema>) => void;
  onCancel?: () => void;
}

const TaxConfigForm = ({ form, onSubmit, onCancel }: TaxConfigFormProps) => {

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit ? onSubmit : () => { })} className="space-y-4">
        <FormField
          control={form.control}
          name="ratePercent"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                PPN Rate (%) <span className="text-destructive">*</span>
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <FormControl>
                  <Input type="number" step="0.01" min="0" max="100" {...field} />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="effectiveDate"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Effective Date <span className="text-destructive">*</span>
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      captionLayout="dropdown"
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="calcMode"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Calculation Mode <span className="text-destructive">*</span>
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select calculation mode" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="inclusive">Inclusive (price includes tax)</SelectItem>
                    <SelectItem value="exclusive">Exclusive (tax added on top)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <div className="flex gap-2 pt-2">
          <Button type="submit">
            <Save size={20} />Save
          </Button>
          <Button type="button" variant="outline" onClick={onCancel ? onCancel : () => { }}>
            <X size={20} />Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default TaxConfigForm;
