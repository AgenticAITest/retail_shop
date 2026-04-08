import { Button } from '@client/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@client/components/ui/card';
import { Input } from '@client/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import axios from 'axios';
import { Loader2, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface ShopLocation {
  id: string;
  code: string;
  name: string;
  syncFrequency: string;
  syncWindows: string;
  bandwidthMode: string;
}

interface Step9Props {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onComplete: (data: ShopLocation[]) => void;
}

const Step9SyncSettings = ({ onNext, onComplete }: Step9Props) => {
  const [locations, setLocations] = useState<ShopLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios
      .get('/api/modules/location-management/location', {
        params: { perPage: 1000, sort: 'name', order: 'asc' },
      })
      .then((response) => {
        const allLocations = response.data.locations || [];
        const shopLocations = allLocations
          .filter((loc: any) => loc.type === 'shop')
          .map((loc: any) => ({
            id: loc.id,
            code: loc.code,
            name: loc.name,
            syncFrequency: loc.syncConfig?.frequency || 'once_daily',
            syncWindows: (loc.syncConfig?.windows || []).join(','),
            bandwidthMode: loc.syncConfig?.bandwidthMode || 'full',
          }));
        setLocations(shopLocations);
      })
      .catch(() => {
        // No locations
      })
      .finally(() => setLoading(false));
  }, []);

  function updateLocation(id: string, field: keyof ShopLocation, value: string) {
    setLocations((prev) =>
      prev.map((loc) => (loc.id === id ? { ...loc, [field]: value } : loc))
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = locations.map((loc) => ({
        locationId: loc.id,
        syncFrequency: loc.syncFrequency,
        syncWindows: loc.syncWindows,
        bandwidthMode: loc.bandwidthMode,
      }));
      await axios.put('/api/modules/tenant-onboarding/onboarding/step/9', {
        locations: payload,
      });
      toast.success('Sync settings saved successfully');
      onComplete(locations);
      onNext();
    } catch {
      toast.error('Failed to save sync settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 size={24} className="animate-spin" />
        <span className="ml-2">Loading shop locations...</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 9: Sync Settings</CardTitle>
        <CardDescription>
          Configure data synchronization settings for each shop location. This determines how frequently
          data is synced between headquarters and each shop.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {locations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No shop-type locations found. Please add shop locations in Step 2 first.
          </div>
        ) : (
          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/20 font-semibold">
                <TableRow>
                  <TableHead className="py-2">Location</TableHead>
                  <TableHead className="py-2 w-[180px]">Sync Frequency</TableHead>
                  <TableHead className="py-2 w-[200px]">Sync Windows</TableHead>
                  <TableHead className="py-2 w-[160px]">Bandwidth Mode</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{loc.code}</span>
                        <span className="text-muted-foreground ml-2">{loc.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={loc.syncFrequency}
                        onValueChange={(value) =>
                          updateLocation(loc.id, 'syncFrequency', value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="once_daily">Once Daily</SelectItem>
                          <SelectItem value="twice_daily">Twice Daily</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={loc.syncWindows}
                        onChange={(e) =>
                          updateLocation(loc.id, 'syncWindows', e.target.value)
                        }
                        placeholder="e.g. 06:00,18:00"
                        className="w-full"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={loc.bandwidthMode}
                        onValueChange={(value) =>
                          updateLocation(loc.id, 'bandwidthMode', value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full">Full</SelectItem>
                          <SelectItem value="compressed">Compressed</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

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

export default Step9SyncSettings;
