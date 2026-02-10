import ConfirmDialog from '@client/components/console/ConfirmDialog';
import DataPagination from '@client/components/console/DataPagination';
import InputGroup from '@client/components/console/InputGroup';
import SortButton from '@client/components/console/SortButton';
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@client/components/ui/tooltip";
import { useErrorHandler } from '@client/hooks/useErrorHandler';
import axios from 'axios';
import { Download, Info, Loader, Loader2, Pencil, Plus, Save, Search, Upload, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';

import {
  keepPreviousData,
  useQuery
} from '@tanstack/react-query';

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  PaginationState,
  RowData,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';

// Extend ColumnMeta to include custom properties
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    headerClass?: string;
  }
}

import { fetchData } from './documentFetchData';
import { useIsMobile } from '@client/hooks/use-mobile';
import z from 'zod';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@client/components/ui/drawer';
import { Separator } from '@client/components/ui/separator';
import { useForm } from 'react-hook-form';
import { documentFormSchema } from './documentFormSchema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@client/provider/AuthProvider';
import { parse } from 'date-fns';
import DocumentFormDrawer from './DocumentFormDrawer';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@client/components/ui/alert-dialog';
import IndeterminateCheckbox from '@client/components/console/IndeterminateCheckbox';
import { TarnstackHeader } from '@client/components/console/TarnstackHeader';
import { DocumentBulkEdit } from './DocumentBulkEdit';
import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';

interface Document {
  id: string;
  name: string;
  code: string;
  releaseDate: string;
  pages: number;
}

const Document = () => {
  const { throwError } = useErrorHandler();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);

  const [activeDrawerId, setActiveDrawerId] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState(params.get('filter') || '');
  const [loading, setLoading] = React.useState(false);
  const [importExport, setImportExport] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirmExport, setConfirmExport] = React.useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = React.useState<string | null>(null);
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({})
  const [confirmBulkDelete, setConfirmBulkDelete] = React.useState(false);
  const [bulkEditOpen, setBulkEditOpen] = React.useState(false);

  function clearFilter() {
    setFilter('');
  }

  function onExport() {
    setConfirmExport(true);
  }

  function onImport() {
    navigate('/console/modules/demo-module/document/import');
  }

  function onDelete(documentId: string) {
    console.log("Delete document with ID:", documentId);
    setActiveDrawerId(null); // close drawer if open
    setSelectedDocumentId(documentId);
    setConfirmDelete(true);
  }

  function onConfirmDelete() {
    setLoading(true);
    setRowSelection(prev => {
      const newSelection = { ...prev };
      if (selectedDocumentId !== null) {
        delete newSelection[selectedDocumentId];
      }
      return newSelection;
    });

    axios
      .delete(`/api/modules/demo-module/document/${selectedDocumentId}/delete`)
      .then(() => {
        toast.success("Document deleted successfully");
        dataQuery.refetch(); // refresh data table
      })
      .catch((error) => {
        toast.error("Failed to delete document");
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function onBulkDelete() {
    console.log("Delete documents with IDs:", Object.keys(rowSelection));
    setActiveDrawerId(null); // close drawer if open
    setConfirmBulkDelete(true);
  }

  function onConfirmBulkDelete() {
    setLoading(true);
    setRowSelection({}); // clear selection
    axios
      .delete(`/api/modules/demo-module/document/delete`, {
        data: {
          ids: Object.keys(rowSelection),
        },
      })
      .then(() => {
        toast.success("Bulk document deleted successfully");
        setPagination(prev => ({ ...prev, pageIndex: 0 })); // reset to first page
        dataQuery.refetch(); // refresh data table
      })
      .catch((error) => {
        toast.error("Failed to bulk delete document");
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function onConfirmExport() {
    setImportExport(true);
    axios
      .get(`/api/modules/demo-module/document/export`)
      .then((data) => {
        const url = window.URL.createObjectURL(new Blob([data.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "documents.csv");
        document.body.appendChild(link);
        link.click();
        toast.success("Document exported successfully");
      })
      .catch((error) => {
        toast.error("Failed to export document");
      })
      .finally(() => {
        setImportExport(false);
      });
  }


  function TableCellViewer({ item }: { item: Document }) {
    const isMobile = useIsMobile();
    // const navigate = useNavigate();

    const { user } = useAuth();
    const [readonly, setReadonly] = React.useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof documentFormSchema>>({
      resolver: zodResolver(documentFormSchema),
      mode: "onSubmit",
      reValidateMode: "onSubmit",
      defaultValues: {
        id: "",
        name: "",
        code: "",
        releaseDate: new Date(),
        pages: 0,
      },
    });

    useEffect(() => {
      axios.get(`/api/modules/demo-module/document/${item.id}`).then((response) => {
        form.setValue("id", response.data.id);
        form.setValue("name", response.data.name);
        form.setValue("code", response.data.code);
        form.setValue("releaseDate", parse(response.data.releaseDate, "yyyy-MM-dd", new Date()));
        form.setValue("pages", response.data.pages);
      });
    }, []);

    function onSubmit(values: z.infer<typeof documentFormSchema>) {
      //console.log(values);
      setIsSubmitting(true);
      setLoading(true);
      axios
        .put(`/api/modules/demo-module/document/${item.id}/edit`, values)
        .then(() => {
          console.log("Document created successfully");
          // navigate("/console/modules/demo-module/document/dt/new");
          toast.success("Document has been updated.");
        })
        .catch((error) => {
          console.error("Error updating document:", error);
          toast.error("Failed to update document.");
        })
        .finally(() => {
          dataQuery.refetch(); // refresh data table
          setActiveDrawerId(null); // Tutup drawer setelah submit
          setIsSubmitting(false);
          setLoading(false);
        });
    }

    return (
      <Drawer open={activeDrawerId === item.id}
        onOpenChange={open => setActiveDrawerId(open ? item.id : null)}
        direction={isMobile ? "bottom" : "right"}>

        <DrawerTrigger asChild>
          {/* <Button variant="default" className="w-fit px-0 text-left"
            onClick={() => { setActiveDrawerId(item.id) }}>
            <Info size={20} />
          </Button> */}
          {/* <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="default" className="w-fit px-0 text-left"
                onClick={() => { setActiveDrawerId(item.id) }}>
                <Info size={20} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Quick View</p>
            </TooltipContent>
          </Tooltip> */}
        </DrawerTrigger>

        <DrawerContent>
          <DrawerHeader className="gap-1">
            <DrawerTitle>{item.name}</DrawerTitle>
            <DrawerDescription>
              {/* {item.code} */}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
            <Separator />
            <DocumentFormDrawer form={form} onSubmit={onSubmit} readonly={readonly} />
          </div>

          <DrawerFooter>
            {!readonly && (
              <>
                <Button type="submit" onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting || form.formState.isSubmitting}>
                  <Save size={20} />Save
                </Button>
                <Button type="button" variant="outline" onClick={() => setReadonly(true)}>
                  <X size={20} />Cancel
                </Button>
              </>
            )}
            {readonly && (
              <>
                <Button type="button" variant="secondary" onClick={() => setReadonly(false)}>
                  <Pencil size={20} />Edit
                </Button>
                <Button variant="destructive" onClick={() => onDelete(item.id)}>
                  <X size={20} />Delete
                </Button>
                <DrawerClose asChild>
                  <Button variant="outline" onClick={() => setActiveDrawerId(null)}>Close</Button>
                  {/* <Button variant="outline">Close</Button> */}
                </DrawerClose>
              </>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  const rerender = React.useReducer(() => ({}), {})[1]
  const columns = React.useMemo<ColumnDef<Document>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <IndeterminateCheckbox
            {...{
              checked: table.getIsAllRowsSelected(),
              indeterminate: table.getIsSomeRowsSelected(),
              onChange: table.getToggleAllRowsSelectedHandler(),
            }}
          />
        ),
        cell: ({ row }) => (
          <div className="px-1">
            <IndeterminateCheckbox
              {...{
                checked: row.getIsSelected(),
                disabled: !row.getCanSelect(),
                indeterminate: row.getIsSomeSelected(),
                onChange: row.getToggleSelectedHandler(),
              }}
            />
          </div>
        ),
      },
      {
        accessorKey: 'name',
        header: 'Name',
        meta: {
          headerClass: 'w-[350px] py-2',
        },
        cell: ({ row }) => {
          return (
            <Link to={`/console/modules/demo-module/document/${row.original.id}`} className='no-underline hover:underline'>
              {row.original.name}
            </Link>
          )
        },
        footer: props => props.column.id,
      },
      {
        accessorFn: row => row.code,
        id: 'code',
        header: 'Code',
        // header: () => <span>Code</span>,
        meta: {
          headerClass: 'w-[350px] py-2',
        },
        cell: info => info.getValue(),
        footer: props => props.column.id,
      },
      {
        accessorKey: 'releaseDate',
        header: () => 'Release Date',
        meta: {
          headerClass: 'py-2',
        },
        cell: info => info.getValue(),
        footer: props => props.column.id,
      },
      {
        accessorKey: 'pages',
        header: 'Pages',
        meta: {
          headerClass: 'py-2',
        },
        cell: info => info.getValue(),
        footer: props => props.column.id,
        enableSorting: false, // disable sorting on this column
      },
    ],
    []
  )

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'code', desc: false } // default: sort by 'code' ascending
  ])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  useEffect(() => {
    setRowSelection({}); // clear selection when page changes
  }, [pagination.pageIndex]);

  const dataQuery = useQuery({
    queryKey: ['data', pagination, sorting, filter],
    queryFn: () => fetchData(pagination, sorting, filter),
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData, // don't have 0 rows flash while changing pages/loading next page
  })

  const defaultData = React.useMemo(() => [], [])

  const table = useReactTable({
    data: dataQuery.data?.rows ?? defaultData,
    columns,
    // pageCount: dataQuery.data?.pageCount ?? -1, //you can now pass in `rowCount` instead of pageCount and `pageCount` will be calculated internally (new in v8.13.0)
    rowCount: dataQuery.data?.rowCount, // new in v8.13.0 - alternatively, just pass in `pageCount` directly
    state: {
      sorting,
      pagination,
      rowSelection,
    },
    getRowId: row => row.id,
    enableRowSelection: true, //enable row selection for all rows
    // enableRowSelection: row => row.original.age > 18, // or enable row selection conditionally per row
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(), //client-side sorting
    onSortingChange: handleSortingChange,
    // onSortingChange: setSorting, //optionally control sorting state in your own scope for easy access
    manualPagination: true, //we're doing manual "server-side" pagination
    // getPaginationRowModel: getPaginationRowModel(), // If only doing manual pagination, you don't need this
    debugTable: false,
  })
  // console.log(table.getState().sorting)

  const pageIndex = table.getState().pagination.pageIndex; // 0-based
  const pageSize = table.getState().pagination.pageSize;
  const totalRows = dataQuery.data?.rowCount ?? 0;
  const start = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  // const end = Math.min((pageIndex + 1) * pageSize, totalRows);
  const selectedDocuments = table.getSelectedRowModel().rows.map(row => row.original);

  // Handler untuk sorting agar selalu pindah ke halaman pertama
  function handleSortingChange(updater: SortingState | ((old: SortingState) => SortingState)) {
    setSorting(updater);
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
  }

  // A typical debounced input react component
  function DebouncedInput({
    value: initialValue,
    onChange,
    debounce = 500,
    ...props
  }: {
    value: string | number
    onChange: (value: string | number) => void
    debounce?: number
  } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>) {
    const [value, setValue] = React.useState(initialValue)

    React.useEffect(() => {
      setValue(initialValue)
    }, [initialValue])

    React.useEffect(() => {
      const timeout = setTimeout(() => {
        onChange(value)
      }, debounce)

      return () => clearTimeout(timeout)
    }, [value])

    return (
      <Input
        {...props}
        value={value} onChange={e => setValue(e.target.value)}
        className="h-8 px-1 w-60 max-w-sm border-0 focus-visible:ring-0 shadow-none dark:bg-input/0" />
    )
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4" >
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Documents</h1>
        </div>
      </header>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">

          <div className="flex gap-2 ">
            <Button variant="default" size="sm" onClick={() => navigate('/console/modules/demo-module/document/add')}>
              <Plus /><span className="hidden lg:inline-block">Add Document</span>
            </Button>
            <Button onClick={onExport} variant="secondary" size="sm">
              <Download /><span className="hidden lg:inline-block">Export</span>
            </Button>
            <Button onClick={onImport} variant="secondary" size="sm">
              <Upload /><span className="hidden lg:inline-block">Import</span>
            </Button>

            <div className="ml-auto flex items-center gap-2">
              <InputGroup>
                <DebouncedInput
                  onChange={value => setFilter(String(value))}
                  placeholder={`Search...`}
                  type="text"
                  value={(filter ?? '') as string}
                />
                {filter !== '' && (
                  <X size={20} className={`text-muted-foreground cursor-pointer mx-2 hover:text-foreground`}
                    onClick={clearFilter} />
                )}
                {filter === '' && (
                  <Search size={20} className={`text-muted-foreground mx-2 hover:text-foreground`} />
                )}
              </InputGroup>

              {/* <Button onClick={applyFilter}>
                <Search/><span className="hidden md:inline-block">Filter</span>
              </Button> */}
            </div>
          </div>

          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/20 font-semibold ">

                {table.getHeaderGroups().map(headerGroup => (
                  <TableRow key={headerGroup.id}>
                    <TableHead className="w-[50px] py-2 text-center">#</TableHead>

                    {headerGroup.headers.map(header => {
                      const headerClass =
                        header.column.columnDef.meta?.headerClass ?? '';

                      return (
                        <TableHead key={header.id} colSpan={header.colSpan}
                          className={`${headerClass}`}
                        >

                          {/* if header id is select, render IndeterminateCheckbox */}
                          {header.id === 'select' && (
                            <div className="p-1">
                              <IndeterminateCheckbox
                                {...{
                                  checked: table.getIsAllPageRowsSelected(),
                                  indeterminate: table.getIsSomePageRowsSelected(),
                                  onChange: table.getToggleAllPageRowsSelectedHandler(),
                                }}
                              />
                            </div>
                          )}

                          {header.id !== 'select' && (
                            <TarnstackHeader header={header} />
                          )}

                        </TableHead>
                      )
                    })}

                    <TableHead className="w-[60px] py-2 text-center"></TableHead>
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row, i) => {
                  return (
                    <TableRow key={row.id}>

                      <TableCell className="text-center">{start + i}</TableCell>

                      {row.getVisibleCells().map(cell => {
                        return (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        )
                      })}

                      <TableCell className="flex text-center gap-2">
                        {/* show table cell drawer */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="default" className="w-fit px-0 text-left"
                              onClick={() => { setActiveDrawerId(row.original.id) }}>
                              <Info size={20} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Quick View</p>
                          </TooltipContent>
                        </Tooltip>
                        {activeDrawerId === row.original.id && (
                          <TableCellViewer item={row.original} />
                        )}

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="secondary" onClick={() => navigate(`/console/modules/demo-module/document/${row.original.id}/edit`)}><Pencil size={20} /></Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="destructive" onClick={() => onDelete(row.original.id)}><X size={20} /></Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <DataPagination
            count={dataQuery.data?.rowCount ?? 0}
            perPage={table.getState().pagination.pageSize}
            page={table.getState().pagination.pageIndex + 1}
            gotoPage={p => table.setPageIndex(p - 1)}
          />

          <div className="flex gap-2 ">
            <Button variant="secondary" size="sm" disabled={Object.keys(rowSelection).length === 0} onClick={() => setBulkEditOpen(true)}>
              <Pencil /><span className="hidden lg:inline-block">Edit Documents</span>
            </Button>
            <Button variant="destructive" size="sm" disabled={Object.keys(rowSelection).length === 0} onClick={() => onBulkDelete()}>
              <X /><span className="hidden lg:inline-block">Delete Documents</span>
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        title='Confirm Delete'
        description='This action cannot be undone. This will permanently delete the document and remove all associated data.'
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={onConfirmDelete}
      />
      <ConfirmDialog
        title='Confirm Bulk Delete'
        description='This action cannot be undone. This will permanently delete the documents and remove all associated data.'
        open={confirmBulkDelete}
        onOpenChange={setConfirmBulkDelete}
        onConfirm={onConfirmBulkDelete}
      />
      <ConfirmDialog
        title='Confirm Export'
        description='Exporting documents may take a while. Do you want to proceed?'
        open={confirmExport}
        onOpenChange={setConfirmExport}
        onConfirm={onConfirmExport}
      />

      <DocumentBulkEdit
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        rowSelection={rowSelection}
        selectedDocuments={selectedDocuments}
        onSuccess={() => dataQuery.refetch()}
      />

      <AlertDialog open={dataQuery.isFetching || loading}>
        <AlertDialogContent>
          <AlertDialogHeader className='flex w-full items-center text-center'>
            <AlertDialogTitle className='flex items-center gap-2'>
              <Loader2 size={16} className="animate-spin" /> Please wait ...
            </AlertDialogTitle>
            <AlertDialogDescription>
              Please wait while the data is being processed.
            </AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default withModuleAuthorization(Document, {
  moduleId: 'demo-module',
  moduleName: 'Demo Module'
});