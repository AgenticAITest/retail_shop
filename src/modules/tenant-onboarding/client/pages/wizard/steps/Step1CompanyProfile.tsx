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
import { Textarea } from '@client/components/ui/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { Loader2, Save } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const companyProfileSchema = z.object({
  businessName: z.string().min(1, { error: 'Business name is required' }),
  npwp: z
    .string()
    .min(15, { error: 'NPWP must be 15-16 digits' })
    .max(16, { error: 'NPWP must be 15-16 digits' })
    .regex(/^\d+$/, { error: 'NPWP must contain only digits' }),
  address: z.string().optional(),
  logoUrl: z.string().optional(),
});

type CompanyProfileForm = z.infer<typeof companyProfileSchema>;

interface Step1Props {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onComplete: (data: CompanyProfileForm) => void;
}

const Step1CompanyProfile = ({ onNext, onComplete }: Step1Props) => {
  const [saving, setSaving] = useState(false);

  const form = useForm<CompanyProfileForm>({
    resolver: zodResolver(companyProfileSchema) as any,
    defaultValues: {
      businessName: '',
      npwp: '',
      address: '',
      logoUrl: '',
    },
  });

  async function handleSubmit(values: CompanyProfileForm) {
    setSaving(true);
    try {
      await axios.put('/api/modules/tenant-onboarding/onboarding/step/1', values);
      toast.success('Company profile saved successfully');
      onComplete(values);
      onNext();
    } catch {
      toast.error('Failed to save company profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 1: Company Profile</CardTitle>
        <CardDescription>
          Enter your business details. This information will be used across invoices, receipts, and reports.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="businessName"
              render={({ field }) => (
                <FormItem className="grid grid-cols-12 gap-2 items-start">
                  <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                    Business Name <span className="text-destructive">*</span>
                  </FormLabel>
                  <div className="col-span-12 md:col-span-10 space-y-2">
                    <FormControl>
                      <Input {...field} placeholder="e.g. PT Retail Sejahtera" />
                    </FormControl>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="npwp"
              render={({ field }) => (
                <FormItem className="grid grid-cols-12 gap-2 items-start">
                  <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                    NPWP <span className="text-destructive">*</span>
                  </FormLabel>
                  <div className="col-span-12 md:col-span-10 space-y-2">
                    <FormControl>
                      <Input {...field} placeholder="15-16 digit NPWP number" maxLength={16} />
                    </FormControl>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="grid grid-cols-12 gap-2 items-start">
                  <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                    Address
                  </FormLabel>
                  <div className="col-span-12 md:col-span-10 space-y-2">
                    <FormControl>
                      <Textarea {...field} value={field.value || ''} placeholder="Business address" />
                    </FormControl>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem className="grid grid-cols-12 gap-2 items-start">
                  <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                    Logo URL
                  </FormLabel>
                  <div className="col-span-12 md:col-span-10 space-y-2">
                    <FormControl>
                      <Input {...field} value={field.value || ''} placeholder="https://example.com/logo.png" />
                    </FormControl>
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

export default Step1CompanyProfile;
