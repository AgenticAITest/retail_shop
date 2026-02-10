import { Button } from "@client/components/ui/button";
import { Calendar } from "@client/components/ui/calendar";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@client/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@client/components/ui/form";
import { Input } from "@client/components/ui/input";
import { Label } from "@client/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@client/components/ui/popover";
import { cn } from "@client/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { format } from "date-fns";
import { BrushCleaning, CalendarIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { documentBulkEditFormSchema } from "./documentFormSchema";

type BulkEditForm = z.infer<typeof documentBulkEditFormSchema>;

interface DocumentBulkEditProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rowSelection: Record<string, boolean>;
  selectedDocuments: any[];
  onSuccess?: () => void;
}

export function DocumentBulkEdit({ open, onOpenChange, rowSelection, selectedDocuments, onSuccess }: DocumentBulkEditProps) {
  const navigate = useNavigate();

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const ids = useMemo(() => Object.keys(rowSelection).filter(id => rowSelection[id]), [rowSelection]);

  const form = useForm<BulkEditForm>({
    resolver: zodResolver(documentBulkEditFormSchema),
    defaultValues: {
      ids,
      releaseDate: undefined,
      pages: undefined,
    },
  });

  const handleResetReleaseDate = () => {
    form.setValue("releaseDate", undefined);
  };

  // Sync ids if selection changes
  useEffect(() => {
    form.setValue("ids", ids);
  }, [ids]);

  const onSubmit = async (values: BulkEditForm) => {
    try {
      await axios.put("/api/modules/demo-module/document/edit", values).then(() => {
        // navigate("/console/modules/demo-module/document");
        toast.success("Documents have been updated.");

        // Reset form values
        form.setValue("releaseDate", undefined);
        form.setValue("pages", undefined);
      })
        .catch((error) => {
          console.error("Error updating documents:", error);
          toast.error("Failed to update documents.");
        })
        .finally(() => {
          // setIsLoading(false);
          onOpenChange(false);
          onSuccess?.();
        });
    } catch (error) {
      console.error("Error updating documents:", error);
      toast.error("Failed to update documents.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[1000]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Edit Documents</DialogTitle>
          <DialogDescription>
            Update release date and/or pages for selected documents.
          </DialogDescription>
        </DialogHeader>
        <Form {...form} >
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-12">
              <Label className="col-span-12 md:col-span-3">Selected IDs</Label>
              <div className="flex flex-wrap col-span-12 md:col-span-9 gap-1 text-xs mt-1">
                {/* {ids.length === 0 && <span className="text-muted-foreground">No documents selected.</span>}
                {ids.map(id => (
                  <span key={id} className="bg-muted px-2 py-1 rounded">{id}</span>
                ))} */}

                {selectedDocuments.length === 0 && (
                  <span className="text-muted-foreground">No documents selected.</span>
                )}
                {selectedDocuments.map(doc => (
                  <span key={doc.id} className="bg-muted px-2 py-1 rounded flex flex-col md:flex-row md:items-center gap-1">
                    <span className="font-medium">{doc.name}</span>
                  </span>
                ))}
              </div>
            </div>

            <FormField
              control={form.control}
              name="releaseDate"
              render={({ field }) => (
                <FormItem className="grid grid-cols-12 gap-2 items-start">
                  <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-3">
                    Release Date
                  </FormLabel>
                  <div className="col-span-12 md:col-span-9 space-y-2">

                    <Popover modal={true} open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
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
                      <PopoverContent className="w-auto p-0 z-[2000]" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(e) => { field.onChange(e); setIsCalendarOpen(false); }}
                          captionLayout="dropdown"
                        />
                        <div className="p-2">
                          <Button type="button" variant="ghost" onClick={handleResetReleaseDate}>
                            Clear Date
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pages"
              render={({ field }) => (
                <FormItem className="grid grid-cols-12 gap-2 items-start">
                  <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-3">
                    Pages
                  </FormLabel>
                  <div className="col-span-12 md:col-span-9 space-y-2">
                    <FormControl >
                      <Input
                        className="w-full"
                        type="number" {...field}
                        min={0}
                        value={field.value ?? ""}
                        onChange={e => {
                          const val = e.target.value;
                          field.onChange(val === "" ? undefined : Number(val));
                        }}
                        onKeyDown={e => {
                          if (
                            e.key === "e" ||
                            e.key === "E" ||
                            e.key === "+" ||
                            e.key === "-"
                          ) {
                            e.preventDefault();
                          }
                        }}
                      />

                      {/* <Input id="pages" ref={pagesRef} {...field} /> */}

                      {/* <Input className="w-full" type="number" {...field} 
                          min={0}
                          onChange={e => field.onChange(Number(e.target.value))} /> */}
                    </FormControl>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />


            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting || ids.length === 0}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}