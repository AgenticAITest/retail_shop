import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import Breadcrumbs, { createBreadcrumbItems, useBreadcrumbs } from '@client/components/console/Breadcrumbs';
import { Label } from '@client/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(a: string | number | null) {
  if (a === null || a === undefined) return '-';
  return `Rp ${Number(a).toLocaleString('id-ID')}`;
}

const ShiftView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [shift, setShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const { items: breadcrumbs } = useBreadcrumbs(
    createBreadcrumbItems([
      { label: "Shift History", onClick: () => navigate("/console/modules/pos/shift") },
      { label: "Shift Detail" },
    ])
  );

  useEffect(() => {
    setLoading(true);
    axios.get(`/api/modules/pos/shift/${id}`)
      .then(r => setShift(r.data))
      .catch(() => { toast.error('Failed to load shift'); navigate('/console/modules/pos/shift'); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !shift) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  const variance = shift.variance ? Number(shift.variance) : 0;

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <h1 className="text-2xl font-semibold">Shift Detail</h1>
        <div className="ml-auto px-4"><Breadcrumbs items={breadcrumbs} loading={loading} /></div>
      </header>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">

          {/* Shift Header */}
          <div className="bg-card rounded-lg border p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <p><span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize ${shift.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{shift.status}</span></p>
              </div>
              <div>
                <Label className="text-muted-foreground">Cashier</Label>
                <p>{shift.cashier?.fullname || shift.cashier?.username || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Location</Label>
                <p>{shift.location?.name || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Opened</Label>
                <p>{formatDate(shift.openedAt)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Closed</Label>
                <p>{formatDate(shift.closedAt)}</p>
              </div>
              {shift.closedByUser && (
                <div>
                  <Label className="text-muted-foreground">Closed By</Label>
                  <p>{shift.closedByUser.fullname || shift.closedByUser.username}</p>
                </div>
              )}
              {shift.notes && (
                <div className="md:col-span-3">
                  <Label className="text-muted-foreground">Notes</Label>
                  <p>{shift.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Cash Summary */}
          <div className="bg-card rounded-lg border p-6">
            <h3 className="font-medium mb-4">Cash Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Opening Float</p>
                <p className="text-lg font-semibold">{formatCurrency(shift.openingFloat)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expected Cash</p>
                <p className="text-lg font-semibold">{formatCurrency(shift.expectedCash)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Actual Cash</p>
                <p className="text-lg font-semibold">{formatCurrency(shift.actualCash)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Variance</p>
                <p className={`text-lg font-semibold ${variance > 0 ? 'text-green-600' : variance < 0 ? 'text-red-600' : ''}`}>
                  {formatCurrency(shift.variance)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sales</p>
                <p className="text-lg font-semibold">{shift.summary?.totalSales || 0}</p>
              </div>
            </div>
            {shift.varianceReason && (
              <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-950 rounded text-sm">
                <span className="text-muted-foreground">Variance Reason:</span> {shift.varianceReason}
              </div>
            )}
          </div>

          {/* Cash Drops */}
          {(shift.cashDrops || []).length > 0 && (
            <div className="bg-card rounded-lg border">
              <div className="p-4 border-b"><h3 className="font-medium">Cash Drops</h3></div>
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead className="w-[50px] text-center">#</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shift.cashDrops.map((d: any, i: number) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-center">{i + 1}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(d.amount)}</TableCell>
                      <TableCell>{d.reason || '-'}</TableCell>
                      <TableCell className="text-sm">{formatDate(d.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(ShiftView, { moduleId: 'pos', moduleName: 'Point of Sale' });
