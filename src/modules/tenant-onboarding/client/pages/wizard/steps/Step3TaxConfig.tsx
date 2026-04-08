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
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { Loader2, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const taxConfigSchema = z.object({
  ratePercent: z
    .number({ error: 'Rate is required' })
    .min(0, { error: 'Rate must be 0 or higher' })
    .max(100, { error: 'Rate must be 100 or lower' }),
  calcMode: z.string().min(1, { error: 'Calculation mode is required' }),
});

type TaxConfigForm = z.infer<typeof taxConfigSchema>;

interface ExistingTaxConfig {
  ratePercent: string;
  calcMode: string;
}

interface Step3Props {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onComplete: (data: TaxConfigForm) => void;
}

const Step3TaxConfig = ({ onNext, onComplete }: Step3Props) => {
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [existingConfig, setExistingConfig] = useState<ExistingTaxConfig | null>(null);

  const form = useForm<TaxConfigForm>({
    resolver: zodResolver(taxConfigSchema) as any,
    defaultValues: {
      ratePercent: 11,
      calcMode: 'inclusive',
    },
  });

  useEffect(() => {
    axios
      .get('/api/modules/tax-configuration/config/active')
      .then((response) => {
        if (response.data) {
          setExistingConfig(response.data);
          form.reset({
            ratePercent: Number(response.data.ratePercent) || 11,
            calcMode: response.data.calcMode || 'inclusive',
          });
        }
      })
      .catch(() => {
        // No existing config
      })
      .finally(() => setLoadingExisting(false));
  }, []);

  async function handleSubmit(values: TaxConfigForm) {
    setSaving(true);
    try {
      await axios.put('/api/modules/tenant-onboarding/onboarding/step/3', values);
      toast.success('Tax configuration saved successfully');
      onComplete(values);
      onNext();
    } catch {
      toast.error('Failed to save tax configuration');
    } finally {
      setSaving(false);
    }
  }

  if (loadingExisting) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 size={24} className="animate-spin" />
        <span className="ml-2">Loading tax configuration...</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 3: Tax Configuration</CardTitle>
        <CardDescription>
          Configure PPN (Value Added Tax) settings for your business.
          {existingConfig && (
            <span className="block mt-1 text-green-600 font-medium">
              Existing configuration found - values pre-filled below.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                      <Input
                        type="number"
                        step="0.1"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        placeholder="e.g. 11"
                      />
                    </FormControl>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select calculation mode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="inclusive">Inclusive (tax included in price)</SelectItem>
                        <SelectItem value="exclusive">Exclusive (tax added on top)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={saving}>
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
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default Step3TaxConfig;
