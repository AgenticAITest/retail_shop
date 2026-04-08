import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { AlertCircle } from 'lucide-react';

const ReorderSuggestions = () => {
  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Reorder Suggestions</h1>
        </div>
      </header>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-blue-800 dark:text-blue-200">Coming Soon</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Reorder suggestions will be available once the Inventory Management module is implemented.
                This feature will analyze stock levels against minimum thresholds and recommend purchase orders
                to replenish low-stock items.
              </p>
            </div>
          </div>

          <div className="bg-card overflow-hidden rounded-lg border opacity-50">
            <Table>
              <TableHeader className="bg-muted/20 font-semibold">
                <TableRow>
                  <TableHead className="py-2">Product</TableHead>
                  <TableHead className="py-2">SKU</TableHead>
                  <TableHead className="py-2">Current Stock</TableHead>
                  <TableHead className="py-2">Min Threshold</TableHead>
                  <TableHead className="py-2">Suggested Qty</TableHead>
                  <TableHead className="py-2">Preferred Supplier</TableHead>
                  <TableHead className="py-2">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No data available. Inventory module is required.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(ReorderSuggestions, {
  moduleId: 'purchase-order',
  moduleName: 'Purchase Order'
});
