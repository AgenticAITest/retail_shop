import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import { Button } from '@client/components/ui/button';
import { Badge } from '@client/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@client/components/ui/alert-dialog';
import axios from 'axios';
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Batch {
  id: string;
  fileName: string;
  status: 'pending' | 'completed' | 'rolled_back';
  totalRows: number;
  categoriesCreated: number;
  productsCreated: number;
  variantsCreated: number;
  stockEntries: number;
  modifiersSkipped: number;
  createdAt: string;
  completedAt: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  rolled_back: 'bg-red-100 text-red-800',
};

const MokaHistory = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    axios.get('/api/modules/moka-migration/migration/batches')
      .then((r) => setBatches(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleRollback = async (id: string) => {
    await axios.delete(`/api/modules/moka-migration/migration/batches/${id}`);
    load();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import History</h1>
        <p className="text-muted-foreground mt-1">Review and rollback previous MokaPOS migration batches.</p>
      </div>

      {batches.length === 0 ? (
        <p className="text-muted-foreground">No import batches yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Variants</TableHead>
              <TableHead>Stock Entries</TableHead>
              <TableHead>Imported At</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.fileName}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[b.status] ?? ''}`}>
                    {b.status}
                  </span>
                </TableCell>
                <TableCell>{b.productsCreated}</TableCell>
                <TableCell>{b.variantsCreated}</TableCell>
                <TableCell>{b.stockEntries}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(b.createdAt).toLocaleString('id-ID')}
                </TableCell>
                <TableCell>
                  {b.status === 'completed' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`rollback-${b.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Rollback this import?</AlertDialogTitle>
                          <AlertDialogDescription>
                            All categories, products, variants, barcodes, and stock entries created
                            by this batch will be permanently deleted. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleRollback(b.id)}
                          >
                            Rollback
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default withModuleAuthorization(MokaHistory, { moduleId: 'moka-migration', moduleName: 'MokaPOS Migration' });
