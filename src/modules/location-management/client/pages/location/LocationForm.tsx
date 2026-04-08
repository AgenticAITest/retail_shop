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
import { locationFormSchema } from "./locationFormSchema";

interface LocationOption {
  id: string;
  name: string;
  code: string;
}

interface LocationFormProps {
  form: UseFormReturn<z.infer<typeof locationFormSchema>>;
  onSubmit?: (values: z.infer<typeof locationFormSchema>) => void;
  onCancel?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  readonly?: boolean;
}

const LocationForm = ({ form, onSubmit, onCancel, onEdit, onDelete, readonly = false }: LocationFormProps) => {
  const [parentLocations, setParentLocations] = useState<LocationOption[]>([]);
  const watchType = form.watch("type");

  useEffect(() => {
    axios.get('/api/modules/location-management/location', {
      params: { perPage: 1000, sort: 'name', order: 'asc' }
    }).then((response) => {
      setParentLocations(response.data.locations || []);
    }).catch((error) => {
      console.error("Error fetching parent locations:", error);
    });
  }, []);

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
          name="type"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Type <span className="text-destructive">*</span>
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <Select disabled={readonly} onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="shop">Shop</SelectItem>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                    <SelectItem value="distribution_center">Distribution Center</SelectItem>
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
          name="parentId"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Parent Location
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <Select
                  disabled={readonly}
                  onValueChange={(val) => field.onChange(val === "__none__" ? null : val)}
                  value={field.value || "__none__"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent location" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {parentLocations
                      .filter((loc) => loc.id !== form.getValues("id"))
                      .map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.code} - {loc.name}
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
          name="city"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                City
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
          name="province"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Province
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
          name="phone"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Phone
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
          name="timezone"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Timezone
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

        {/* Sync Config section - only shown when type is "shop" */}
        {watchType === 'shop' && (
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="text-lg font-medium">Sync Configuration</h3>
            <FormField
              disabled={readonly}
              control={form.control}
              name="syncConfig.frequency"
              render={({ field }) => (
                <FormItem className="grid grid-cols-12 gap-2 items-start">
                  <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                    Frequency
                  </FormLabel>
                  <div className="col-span-12 md:col-span-10 space-y-2">
                    <Select disabled={readonly} onValueChange={field.onChange} value={field.value || 'once_daily'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="once_daily">Once Daily</SelectItem>
                        <SelectItem value="twice_daily">Twice Daily</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
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
              name="syncConfig.windows"
              render={({ field }) => (
                <FormItem className="grid grid-cols-12 gap-2 items-start">
                  <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                    Windows
                  </FormLabel>
                  <div className="col-span-12 md:col-span-10 space-y-2">
                    <FormControl>
                      <Input
                        disabled={readonly}
                        placeholder="e.g. 06:00,18:00"
                        value={(field.value || []).join(',')}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val ? val.split(',').map(s => s.trim()) : []);
                        }}
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
              name="syncConfig.bandwidthMode"
              render={({ field }) => (
                <FormItem className="grid grid-cols-12 gap-2 items-start">
                  <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                    Bandwidth Mode
                  </FormLabel>
                  <div className="col-span-12 md:col-span-10 space-y-2">
                    <Select disabled={readonly} onValueChange={field.onChange} value={field.value || 'full'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select bandwidth mode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="full">Full</SelectItem>
                        <SelectItem value="compressed">Compressed</SelectItem>
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
              name="syncConfig.manualSyncEnabled"
              render={({ field }) => (
                <FormItem className="grid grid-cols-12 gap-2 items-start">
                  <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                    Manual Sync Enabled
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
              name="syncConfig.autoSyncOnReconnect"
              render={({ field }) => (
                <FormItem className="grid grid-cols-12 gap-2 items-start">
                  <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                    Auto Sync on Reconnect
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
          </div>
        )}

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

export default LocationForm;
