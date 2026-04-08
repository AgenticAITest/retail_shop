import Authorized from '@client/components/auth/Authorized';
import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import { Button } from '@client/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { useErrorHandler } from '@client/hooks/useErrorHandler';
import axios from 'axios';
import { format } from 'date-fns';
import { Loader2, Plus } from 'lucide-react';
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router';

interface TaxConfigItem {
  id: string;
  ratePercent: string;
  effectiveDate: string;
  calcMode: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const TaxConfig = () => {
  const { throwError } = useErrorHandler();
  const navigate = useNavigate();

  const [activeConfig, setActiveConfig] = React.useState<TaxConfigItem | null>(null);
  const [allConfigs, setAllConfigs] = React.useState<TaxConfigItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [activeRes, allRes] = await Promise.all([
          axios.get('/api/modules/tax-configuration/config/active').catch(() => null),
          axios.get('/api/modules/tax-configuration/config'),
        ]);

        if (activeRes?.data) {
          setActiveConfig(activeRes.data);
        }

        if (allRes?.data?.configs) {
          setAllConfigs(allRes.data.configs);
        }
      } catch (error) {
        throwError(error as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const historicalConfigs = allConfigs.filter((c) => c.status === 'historical');

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 size={24} className="animate-spin" />
        <span className="ml-2">Loading tax configuration...</span>
      </div>
    );
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">PPN Tax Configuration</h1>
        </div>
      </header>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">

          {/* Current Active Tax Config Card */}
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Current Active Tax Rate</h2>
            {activeConfig ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">PPN Rate</p>
                  <p className="text-3xl font-bold">{activeConfig.ratePercent}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Calculation Mode</p>
                  <p className="text-xl font-semibold capitalize">{activeConfig.calcMode}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Effective Since</p>
                  <p className="text-xl font-semibold">
                    {format(new Date(activeConfig.effectiveDate), 'PPP')}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No active tax configuration found. Create one to get started.</p>
            )}
            <div className="mt-4">
              <Authorized roles="ADMIN" permissions="retail.tax.edit">
                <Button onClick={() => navigate('/console/modules/tax-configuration/config/add')}>
                  <Plus /><span>Update Tax Rate</span>
                </Button>
              </Authorized>
            </div>
          </div>

          {/* Historical Rates Table */}
          {historicalConfigs.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Tax Rate History</h2>
              <div className="bg-card overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/20 font-semibold">
                    <TableRow>
                      <TableHead className="w-[50px] py-2 text-center">#</TableHead>
                      <TableHead className="py-2">Rate (%)</TableHead>
                      <TableHead className="py-2">Calculation Mode</TableHead>
                      <TableHead className="py-2">Effective Date</TableHead>
                      <TableHead className="py-2">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicalConfigs.map((config, i) => (
                      <TableRow key={config.id}>
                        <TableCell className="text-center">{i + 1}</TableCell>
                        <TableCell className="font-medium">{config.ratePercent}%</TableCell>
                        <TableCell className="capitalize">{config.calcMode}</TableCell>
                        <TableCell>{format(new Date(config.effectiveDate), 'PPP')}</TableCell>
                        <TableCell>
                          <span className="text-muted-foreground capitalize">{config.status}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(TaxConfig, {
  moduleId: 'tax-configuration',
  moduleName: 'Tax Configuration'
});
