import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import { Button } from '@client/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@client/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Badge } from '@client/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import axios from 'axios';
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Location { id: string; name: string; code: string; }
interface ParsedProduct {
  name: string; categoryName: string; sku: string; price: number; cost: number;
  trackInventory: boolean; stock: number; isVariantParent: boolean;
  variants: { attribute: string; sku: string; price: number; stock: number }[];
}
interface ParseResult {
  categories: { name: string }[];
  products: ParsedProduct[];
  modifiersSkipped: number;
  warnings: string[];
}
interface ImportSummary {
  batchId: string; categoriesCreated: number; productsCreated: number;
  variantsCreated: number; barcodesCreated: number; stockEntries: number;
  modifiersSkipped: number; warnings: string[];
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

const MokaImport = () => {
  const [step, setStep] = useState<Step>('upload');
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState('');
  const [csvData, setCsvData] = useState('');
  const [fileName, setFileName] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState('');
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    axios.get('/api/modules/location-management/location', { params: { perPage: 1000 } })
      .then((r) => setLocations(r.data.data ?? r.data ?? []))
      .catch(() => {});
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setCsvData(ev.target?.result as string ?? '');
    reader.readAsText(file);
  };

  const handleParse = async () => {
    setError('');
    if (!csvData) { setError('Please select a CSV file first.'); return; }
    if (!locationId) { setError('Please select a target location.'); return; }
    setParsing(true);
    try {
      const { data } = await axios.post('/api/modules/moka-migration/migration/parse', { csvData });
      setParseResult(data);
      setStep('preview');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Parse failed';
      setError(msg);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    setError('');
    setStep('importing');
    try {
      const { data } = await axios.post('/api/modules/moka-migration/migration/import', {
        csvData, targetLocationId: locationId, fileName,
      });
      setSummary(data);
      setStep('done');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Import failed';
      setError(msg);
      setStep('preview');
    }
  };

  const handleReset = () => {
    setStep('upload'); setCsvData(''); setFileName(''); setParseResult(null);
    setSummary(null); setError(''); setLocationId('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">MokaPOS CSV Import</h1>
        <p className="text-muted-foreground mt-1">Import products and opening stock from a MokaPOS Items export.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(['upload', 'preview', 'done'] as const).map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-muted-foreground">→</span>}
            <span className={step === s || (step === 'importing' && s === 'preview')
              ? 'font-semibold text-primary' : 'text-muted-foreground capitalize'}
            >
              {i + 1}. {s === 'upload' ? 'Upload' : s === 'preview' ? 'Preview' : 'Done'}
            </span>
          </span>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Step 1: Upload ─────────────────────────────────────────────────── */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Select CSV file and target location</CardTitle>
            <CardDescription>
              Export your items from MokaPOS → Menu → Product → Export. Both English and Indonesian column headers are supported.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Location</label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger data-testid="location-select">
                  <SelectValue placeholder="Select a location..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name} ({l.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">MokaPOS CSV File</label>
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileRef.current?.click()}
                data-testid="csv-drop-zone"
              >
                <FileUp className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                {fileName
                  ? <p className="font-medium">{fileName}</p>
                  : <p className="text-muted-foreground">Click to select a CSV file</p>}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileChange}
                  data-testid="csv-file-input"
                />
              </div>
            </div>

            <Button
              onClick={handleParse}
              disabled={parsing || !csvData || !locationId}
              data-testid="parse-btn"
            >
              {parsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {parsing ? 'Parsing...' : 'Parse CSV'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Preview ────────────────────────────────────────────────── */}
      {step === 'preview' && parseResult && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Categories', value: parseResult.categories.length },
              { label: 'Products', value: parseResult.products.filter(p => !p.isVariantParent).length },
              { label: 'Variant Products', value: parseResult.products.filter(p => p.isVariantParent).length },
              { label: 'Modifiers Skipped', value: parseResult.modifiersSkipped },
            ].map(({ label, value }) => (
              <Card key={label}>
                <CardContent className="pt-4">
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {parseResult.warnings.length > 0 && (
            <div className="flex gap-2 rounded-md border border-yellow-400 bg-yellow-50 p-3 text-sm text-yellow-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">{parseResult.warnings.length} warning(s):</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {parseResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Product Preview (first 20)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parseResult.products.slice(0, 20).map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.categoryName || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{p.sku || '(auto)'}</TableCell>
                      <TableCell>{p.price.toLocaleString('id-ID')}</TableCell>
                      <TableCell>{p.isVariantParent ? p.variants.reduce((s, v) => s + v.stock, 0) : p.stock}</TableCell>
                      <TableCell>
                        {p.isVariantParent
                          ? <Badge variant="secondary">{p.variants.length} variants</Badge>
                          : <Badge variant="outline">Regular</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {parseResult.products.length > 20 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        … and {parseResult.products.length - 20} more products
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button onClick={handleImport} data-testid="import-btn">
              <Upload className="mr-2 h-4 w-4" />
              Import {parseResult.products.length} products
            </Button>
            <Button variant="outline" onClick={handleReset}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ── Importing spinner ──────────────────────────────────────────────── */}
      {step === 'importing' && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">Importing data…</p>
            <p className="text-muted-foreground text-sm">This may take a moment for large files.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Done ──────────────────────────────────────────────────── */}
      {step === 'done' && summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: 'Categories', value: summary.categoriesCreated },
                { label: 'Products', value: summary.productsCreated },
                { label: 'Variants', value: summary.variantsCreated },
                { label: 'Barcodes', value: summary.barcodesCreated },
                { label: 'Stock Entries', value: summary.stockEntries },
                { label: 'Modifiers Skipped', value: summary.modifiersSkipped },
              ].map(({ label, value }) => (
                <div key={label} className="rounded border p-3">
                  <p className="text-xl font-bold">{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            {summary.warnings.length > 0 && (
              <div className="flex gap-2 rounded-md border border-yellow-400 bg-yellow-50 p-3 text-sm text-yellow-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium mb-1">{summary.warnings.length} warning(s):</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {summary.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">Batch ID: {summary.batchId}</p>
            <Button onClick={handleReset} variant="outline">Import Another File</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default withModuleAuthorization(MokaImport, { moduleId: 'moka-migration', moduleName: 'MokaPOS Migration' });
