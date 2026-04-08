import Breadcrumbs, {
  createBreadcrumbItems,
  useBreadcrumbs
} from "@client/components/console/Breadcrumbs";
import { withModuleAuthorization } from "@client/components/auth/withModuleAuthorization";
import { Button } from "@client/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@client/components/ui/card";
import { Input } from "@client/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@client/components/ui/table";
import { Badge } from "@client/components/ui/badge";
import axios from "axios";
import { ArrowLeft, ArrowRight, CheckCircle2, Download, FileUp, Loader2, RotateCcw, Upload, XCircle } from "lucide-react";
import React, { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: ImportError[];
}

function parseCSV(text: string): string[][] {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  return lines.map((line) => line.split(",").map((cell) => cell.trim()));
}

const SupplierImport = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const { items: breadcrumbs } = useBreadcrumbs(
    createBreadcrumbItems([
      {
        label: "Suppliers",
        onClick: () => navigate("/console/modules/supplier-management/supplier"),
      },
      {
        label: "Import",
      },
    ])
  );

  async function handleDownloadTemplate() {
    try {
      const response = await axios.get("/api/modules/supplier-management/import/template", {
        responseType: "text",
      });
      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "supplier-import-template.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Template downloaded successfully");
    } catch (error) {
      toast.error("Failed to download template");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = parseCSV(text);
      const dataRows = rows.length > 1 ? rows.length - 1 : 0;
      setTotalRows(dataRows);
      // Show header + first 5 data rows
      setCsvPreview(rows.slice(0, 6));
    };
    reader.readAsText(selected);
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await axios.post(
        "/api/modules/supplier-management/import/import",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setResult(response.data);
      setStep(3);
      toast.success("Import completed");
    } catch (error) {
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  }

  function handleRestart() {
    setStep(1);
    setFile(null);
    setCsvPreview([]);
    setTotalRows(0);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <>
      <Breadcrumbs items={breadcrumbs} />

      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Import Suppliers</h1>
        </div>
      </header>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">

          {/* Step Indicator */}
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={step === 1 ? "default" : "secondary"}>1. Download Template</Badge>
            <span className="text-muted-foreground">&rarr;</span>
            <Badge variant={step === 2 ? "default" : "secondary"}>2. Upload File</Badge>
            <span className="text-muted-foreground">&rarr;</span>
            <Badge variant={step === 3 ? "default" : "secondary"}>3. Results</Badge>
          </div>

          {/* Step 1: Download Template */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 1: Download CSV Template</CardTitle>
                <CardDescription>
                  Download the CSV template file, fill in your supplier data, then upload it in the next step.
                  The template includes all required columns with sample data to guide you.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex gap-2">
                  <Button onClick={handleDownloadTemplate}>
                    <Download size={16} className="mr-2" />
                    Download CSV Template
                  </Button>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => setStep(2)}>
                    Next
                    <ArrowRight size={16} className="ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Upload File */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 2: Upload CSV File</CardTitle>
                <CardDescription>
                  Select your filled CSV file to upload. A preview of the first 5 rows will be shown before importing.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="max-w-md"
                />

                {csvPreview.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">
                      Total data rows: <span className="font-semibold">{totalRows}</span>
                    </p>
                    <div className="bg-card overflow-hidden rounded-lg border overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-muted/20 font-semibold">
                          <TableRow>
                            {csvPreview[0]?.map((header, i) => (
                              <TableHead key={i} className="py-2 whitespace-nowrap">{header}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {csvPreview.slice(1).map((row, rowIndex) => (
                            <TableRow key={rowIndex}>
                              {row.map((cell, cellIndex) => (
                                <TableCell key={cellIndex} className="whitespace-nowrap">{cell}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ArrowLeft size={16} className="mr-2" />
                    Back
                  </Button>
                  <Button onClick={handleImport} disabled={!file || importing}>
                    {importing ? (
                      <>
                        <Loader2 size={16} className="mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload size={16} className="mr-2" />
                        Import
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Results */}
          {step === 3 && result && (
            <Card>
              <CardHeader>
                <CardTitle>Step 3: Import Results</CardTitle>
                <CardDescription>
                  Review the results of your import below.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex gap-4 flex-wrap">
                  <div className="flex items-center gap-2 rounded-lg border p-4 min-w-[160px]">
                    <CheckCircle2 size={20} className="text-green-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Imported</p>
                      <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border p-4 min-w-[160px]">
                    <FileUp size={20} className="text-yellow-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Skipped</p>
                      <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border p-4 min-w-[160px]">
                    <XCircle size={20} className="text-red-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Errors</p>
                      <p className="text-2xl font-bold text-red-600">{result.errors.length}</p>
                    </div>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-lg font-semibold">Error Details</h3>
                    <div className="bg-card overflow-hidden rounded-lg border">
                      <Table>
                        <TableHeader className="bg-muted/20 font-semibold">
                          <TableRow>
                            <TableHead className="w-[80px] py-2">Row #</TableHead>
                            <TableHead className="w-[150px] py-2">Field</TableHead>
                            <TableHead className="py-2">Error Message</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.errors.map((err, i) => (
                            <TableRow key={i}>
                              <TableCell>{err.row}</TableCell>
                              <TableCell className="font-medium">{err.field}</TableCell>
                              <TableCell className="text-red-600">{err.message}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                <div className="flex justify-between flex-wrap gap-2">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleRestart}>
                      <RotateCcw size={16} className="mr-2" />
                      Import Another
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/console/modules/supplier-management/supplier")}>
                      <ArrowLeft size={16} className="mr-2" />
                      Back to Suppliers
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(SupplierImport, {
  moduleId: "supplier-management",
  moduleName: "Supplier Management",
});
