import { TimePicker24h } from "@client/components/time-picker-24h";
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
import { cn } from "@client/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Pencil, Save, X } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import z from "zod";
import { documentFormSchema } from "./documentFormSchema";
import { useEffect } from "react";

interface DocumentFormProps {
  form: UseFormReturn<z.infer<typeof documentFormSchema>>;
  onSubmit?: (values: z.infer<typeof documentFormSchema>) => void;
  onCancel?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  readonly?: boolean;
}

const DocumentFormDrawer = ({ form, onSubmit, onCancel, onEdit, onDelete, readonly = false }: DocumentFormProps) => {

  useEffect(() => {
    Inputmask({
      mask: ["[A|9]{*}"],
      // jitMasking: true,
    }).mask("code");
  }, []);

  return (
    <Form {...form} >
      <form onSubmit={form.handleSubmit(onSubmit ? onSubmit : () => { })} className="space-y-4">
        <FormField
          disabled={readonly}
          control={form.control}
          name="id"
          render={({ field }) => (
            <FormItem hidden>
              <FormControl >
                <Input {...field} hidden />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          disabled={readonly}
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12">
                Name <span className="text-destructive">*</span>
              </FormLabel>
              <div className="col-span-12 space-y-2">
                <FormControl >
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
          name="code"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12">
                Code <span className="text-destructive">*</span>
              </FormLabel>
              <div className="col-span-12 space-y-2">
                <FormControl >
                  <Input id="code" {...field} />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          disabled={readonly}
          control={form.control}
          name="releaseDate"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12">
                Release Date
              </FormLabel>
              <div className="col-span-12 space-y-2">

                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        disabled={readonly}
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

                {/* <FormControl >
                  <Input {...field} />
                </FormControl> */}
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <FormField
          disabled={readonly}
          control={form.control}
          name="pages"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12">
                Pages <span className="text-destructive">*</span>
              </FormLabel>
              <div className="col-span-12 space-y-2">
                <FormControl >
                  <Input className="w-full" type="number" {...field} 
                    min={0}
                    onChange={e => field.onChange(Number(e.target.value))} />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        {/* {!readonly && (
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
        )} */}

      </form>
    </Form>
  )
}

export default DocumentFormDrawer