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
import { Switch } from '@client/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import axios from 'axios';
import { Loader2, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  purchase_order: 'Purchase Order',
  grn: 'Goods Received Note',
  supplier_return: 'Supplier Return',
  stock_transfer: 'Stock Transfer',
  stock_adjustment: 'Stock Adjustment',
  pos_refund: 'POS Refund',
  pos_discount: 'POS Discount',
};

interface ApprovalConfigItem {
  transactionType: string;
  required: boolean;
  approverRoleId: string;
  thresholdAmount: number | null;
}

interface RoleItem {
  id: string;
  name: string;
}

interface Step8Props {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onComplete: (data: ApprovalConfigItem[]) => void;
}

const Step8ApprovalRules = ({ onNext, onComplete }: Step8Props) => {
  const [configs, setConfigs] = useState<ApprovalConfigItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      axios.get('/api/modules/approval-engine/config'),
      axios.get('/api/system/role', { params: { perPage: 100 } }),
    ])
      .then(([configRes, rolesRes]) => {
        const configData = Array.isArray(configRes.data)
          ? configRes.data
          : configRes.data.configs || [];
        setConfigs(
          configData.map((c: any) => ({
            transactionType: c.transactionType,
            required: c.required || false,
            approverRoleId: c.approverRoleId || '',
            thresholdAmount: c.thresholdAmount ?? null,
          }))
        );

        const rolesData = Array.isArray(rolesRes.data)
          ? rolesRes.data
          : rolesRes.data.roles || [];
        setRoles(rolesData);
      })
      .catch(() => {
        // Initialize with default transaction types if no config
        const defaults = Object.keys(TRANSACTION_TYPE_LABELS).map((type) => ({
          transactionType: type,
          required: false,
          approverRoleId: '',
          thresholdAmount: null,
        }));
        setConfigs(defaults);
      })
      .finally(() => setLoading(false));
  }, []);

  function updateConfig(transactionType: string, field: keyof ApprovalConfigItem, value: any) {
    setConfigs((prev) =>
      prev.map((c) =>
        c.transactionType === transactionType ? { ...c, [field]: value } : c
      )
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await axios.put('/api/modules/tenant-onboarding/onboarding/step/8', {
        configs,
      });
      toast.success('Approval rules saved successfully');
      onComplete(configs);
      onNext();
    } catch {
      toast.error('Failed to save approval rules');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 size={24} className="animate-spin" />
        <span className="ml-2">Loading approval configuration...</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 8: Approval Rules</CardTitle>
        <CardDescription>
          Configure which transaction types require approval, who can approve them, and the threshold amounts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-card overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/20 font-semibold">
              <TableRow>
                <TableHead className="py-2">Transaction Type</TableHead>
                <TableHead className="py-2 w-[100px] text-center">Required</TableHead>
                <TableHead className="py-2 w-[180px]">Approver Role</TableHead>
                <TableHead className="py-2 w-[150px]">Threshold Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((config) => (
                <TableRow key={config.transactionType}>
                  <TableCell className="font-medium">
                    {TRANSACTION_TYPE_LABELS[config.transactionType] || config.transactionType}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={config.required}
                      onCheckedChange={(checked) =>
                        updateConfig(config.transactionType, 'required', checked)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={config.approverRoleId || ''}
                      onValueChange={(value) =>
                        updateConfig(config.transactionType, 'approverRoleId', value)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={config.thresholdAmount ?? ''}
                      onChange={(e) =>
                        updateConfig(
                          config.transactionType,
                          'thresholdAmount',
                          e.target.value === '' ? null : Number(e.target.value)
                        )
                      }
                      placeholder="Optional"
                      className="w-full"
                    />
                  </TableCell>
                </TableRow>
              ))}
              {configs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No approval configurations found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

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

export default Step8ApprovalRules;
