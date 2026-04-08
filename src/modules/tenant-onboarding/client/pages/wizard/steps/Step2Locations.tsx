import { Button } from '@client/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@client/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@client/components/ui/form';
import { Input } from '@client/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { Textarea } from '@client/components/ui/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const locationSchema = z.object({
  code: z.string().min(1, { error: 'Code is required' }),
  name: z.string().min(1, { error: 'Name is required' }),
  type: z.string().min(1, { error: 'Type is required' }),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  phone: z.string().optional(),
});

type LocationFormValues = z.infer<typeof locationSchema>;

interface ExistingLocation {
  id: string;
  code: string;
  name: string;
  type: string;
  city?: string;
}

interface Step2Props {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onComplete: (data: LocationFormValues[]) => void;
}

const Step2Locations = ({ onNext, onComplete }: Step2Props) => {
  const [existingLocations, setExistingLocations] = useState<ExistingLocation[]>([]);
  const [newLocations, setNewLocations] = useState<LocationFormValues[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema) as any,
    defaultValues: {
      code: '',
      name: '',
      type: '',
      address: '',
      city: '',
      province: '',
      phone: '',
    },
  });

  useEffect(() => {
    axios
      .get('/api/modules/location-management/location', {
        params: { perPage: 1000, sort: 'name', order: 'asc' },
      })
      .then((response) => {
        setExistingLocations(response.data.locations || []);
      })
      .catch(() => {
        // No existing locations
      })
      .finally(() => setLoadingExisting(false));
  }, []);

  function handleAddLocation(values: LocationFormValues) {
    setNewLocations((prev) => [...prev, values]);
    form.reset();
    toast.success('Location added to list');
  }

  function handleRemoveLocation(index: number) {
    setNewLocations((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await axios.put('/api/modules/tenant-onboarding/onboarding/step/2', {
        locations: newLocations,
      });
      toast.success('Locations saved successfully');
      onComplete(newLocations);
      onNext();
    } catch {
      toast.error('Failed to save locations');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 2: Locations</CardTitle>
        <CardDescription>
          Set up your shop, warehouse, and distribution center locations. You can add multiple locations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Existing Locations */}
        {loadingExisting ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            Loading existing locations...
          </div>
        ) : existingLocations.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold mb-2">Existing Locations</h3>
            <div className="bg-card overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/20 font-semibold">
                  <TableRow>
                    <TableHead className="py-2">Code</TableHead>
                    <TableHead className="py-2">Name</TableHead>
                    <TableHead className="py-2">Type</TableHead>
                    <TableHead className="py-2">City</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {existingLocations.map((loc) => (
                    <TableRow key={loc.id}>
                      <TableCell className="font-medium">{loc.code}</TableCell>
                      <TableCell>{loc.name}</TableCell>
                      <TableCell className="capitalize">{loc.type}</TableCell>
                      <TableCell>{loc.city || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}

        {/* Add Location Form */}
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-4">Add New Location</h3>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddLocation)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. SHP-001" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Main Store Jakarta" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type <span className="text-destructive">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
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
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} placeholder="e.g. Jakarta" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="province"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Province</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} placeholder="e.g. DKI Jakarta" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} placeholder="e.g. 021-12345678" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ''} placeholder="Full address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit" variant="outline">
                  <Plus size={16} className="mr-2" />
                  Add to List
                </Button>
              </div>
            </form>
          </Form>
        </div>

        {/* New Locations Table */}
        {newLocations.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">
              Locations to Create ({newLocations.length})
            </h3>
            <div className="bg-card overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/20 font-semibold">
                  <TableRow>
                    <TableHead className="py-2">#</TableHead>
                    <TableHead className="py-2">Code</TableHead>
                    <TableHead className="py-2">Name</TableHead>
                    <TableHead className="py-2">Type</TableHead>
                    <TableHead className="py-2">City</TableHead>
                    <TableHead className="py-2 w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newLocations.map((loc, index) => (
                    <TableRow key={index}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{loc.code}</TableCell>
                      <TableCell>{loc.name}</TableCell>
                      <TableCell className="capitalize">{loc.type.replace('_', ' ')}</TableCell>
                      <TableCell>{loc.city || '-'}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveLocation(index)}
                        >
                          <Trash2 size={14} className="text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Save */}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} className="mr-2" />
                Save & Continue
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default Step2Locations;
