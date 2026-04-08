import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Switch } from '@client/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { useErrorHandler } from '@client/hooks/useErrorHandler';
import axios from 'axios';
import { Loader2, Save } from 'lucide-react';
import React, { useEffect } from 'react';
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
  timeoutHours: number;
  timeoutAction: string;
}

interface RoleItem {
  id: string;
  name: string;
}

const ApprovalConfig = () => {
  const { throwError } = useErrorHandler();

  const [configs, setConfigs] = React.useState<ApprovalConfigItem[]>([]);
  const [roles, setRoles] = React.useState<RoleItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [savingRow, setSavingRow] = React.useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [configRes, rolesRes] = await Promise.all([
          axios.get('/api/modules/approval-engine/config'),
          axios.get('/api/system/role', { params: { perPage: 100 } }),
        ]);

        if (configRes?.data) {
          const configData = Array.isArray(configRes.data) ? configRes.data : configRes.data.configs || [];
          setConfigs(configData);
        }

        if (rolesRes?.data) {
          const rolesData = Array.isArray(rolesRes.data) ? rolesRes.data : rolesRes.data.roles || [];
          setRoles(rolesData);
        }
      } catch (error) {
        throwError(error as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  function updateConfig(transactionType: string, field: keyof ApprovalConfigItem, value: any) {
    setConfigs((prev) =>
      prev.map((c) =>
        c.transactionType === transactionType ? { ...c, [field]: value } : c
      )
    );
  }

  function saveConfig(transactionType: string) {
    const config = configs.find((c) => c.transactionType === transactionType);
    if (!config) return;

    setSavingRow(transactionType);

    const payload = {
      required: config.required,
      approverRoleId: config.approverRoleId,
      thresholdAmount: config.thresholdAmount,
      timeoutHours: config.timeoutHours,
      timeoutAction: config.timeoutAction,
    };

    axios
      .put(`/api/modules/approval-engine/config/${transactionType}`, payload)
      .then(() => {
        toast.success(`Configuration for ${TRANSACTION_TYPE_LABELS[transactionType] || transactionType} saved successfully`);
      })
      .catch((error) => {
        toast.error(`Failed to save configuration for ${TRANSACTION_TYPE_LABELS[transactionType] || transactionType}`);
      })
      .finally(() => {
        setSavingRow(null);
      });
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
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Approval Configuration</h1>
        </div>
      </header>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/20 font-semibold">
                <TableRow>
                  <TableHead className="py-2">Transaction Type</TableHead>
                  <TableHead className="py-2 w-[100px] text-center">Required</TableHead>
                  <TableHead className="py-2 w-[180px]">Approver Role</TableHead>
                  <TableHead className="py-2 w-[150px]">Threshold Amount</TableHead>
                  <TableHead className="py-2 w-[120px]">Timeout Hours</TableHead>
                  <TableHead className="py-2 w-[160px]">Timeout Action</TableHead>
                  <TableHead className="py-2 w-[80px] text-center"></TableHead>
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
                    <TableCell>
                      <Input
                        type="number"
                        value={config.timeoutHours}
                        onChange={(e) =>
                          updateConfig(config.transactionType, 'timeoutHours', Number(e.target.value))
                        }
                        className="w-full"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={config.timeoutAction}
                        onValueChange={(value) =>
                          updateConfig(config.transactionType, 'timeoutAction', value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select action" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="escalate">Escalate</SelectItem>
                          <SelectItem value="auto_approve">Auto Approve</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        onClick={() => saveConfig(config.transactionType)}
                        disabled={savingRow === config.transactionType}
                      >
                        {savingRow === config.transactionType ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Save size={16} />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {configs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No approval configurations found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(ApprovalConfig, {
  moduleId: 'approval-engine',
  moduleName: 'Approval Engine',
});
