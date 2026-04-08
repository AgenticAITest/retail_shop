import Authorized from '@client/components/auth/Authorized';
import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import ConfirmDialog from '@client/components/console/ConfirmDialog';
import DataPagination from '@client/components/console/DataPagination';
import InputGroup from '@client/components/console/InputGroup';
import SortButton from '@client/components/console/SortButton';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@client/components/ui/alert-dialog';
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@client/components/ui/tooltip";
import { useErrorHandler } from '@client/hooks/useErrorHandler';
import TreeView, { TreeViewItem } from '@client/components/tree-view';
import axios from 'axios';
import { Eye, List, Loader2, Pencil, Plus, Search, TreePine, X } from 'lucide-react';
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

interface CategoryItem {
  id: string;
  name: string;
  level: number;
  parentName: string | null;
  status: string;
}

interface CategoryTreeNode {
  id: string;
  name: string;
  parentId: string | null;
  level: number;
  path: string | null;
  sortOrder: number;
  status: string;
  children: CategoryTreeNode[];
}

function transformToTreeViewItems(nodes: CategoryTreeNode[]): TreeViewItem[] {
  return nodes.map((node) => ({
    id: node.id,
    name: node.name,
    type: 'category',
    children: node.children && node.children.length > 0
      ? transformToTreeViewItems(node.children)
      : undefined,
  }));
}

const Category = () => {
  const { throwError } = useErrorHandler();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);

  const [viewMode, setViewMode] = React.useState<'list' | 'tree'>('list');
  const [categories, setCategories] = React.useState<CategoryItem[]>([]);
  const [treeData, setTreeData] = React.useState<TreeViewItem[]>([]);
  const [treeLoading, setTreeLoading] = React.useState(false);
  const [count, setCount] = React.useState(0);
  const [filter, setFilter] = React.useState(params.get('filter') || '');
  const [sort, setSort] = React.useState(params.get('sort') || 'name');
  const [order, setOrder] = React.useState(params.get('order') || 'asc');
  const [page, setPage] = React.useState(Number(params.get('page')) || 1);
  const [perPage, setPerPage] = React.useState(Number(params.get('perPage')) || 10);

  const [loading, setLoading] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | null>(null);

  function gotoPage(p: number) {
    if (p < 1 || (count !== 0 && p > Math.ceil(count / perPage))) return;
    const params = new URLSearchParams(window.location.search);
    setPage(p);
    params.set('page', p.toString());
    params.set('perPage', perPage.toString());
    params.set('sort', sort);
    params.set('order', order);
    params.set('filter', filter);
    navigate(`${window.location.pathname}?${params.toString()}`);
    setLoading(true);
  }

  function sortBy(column: string) {
    if (sort === column) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(column);
      setOrder('asc');
    }
  }

  function applyFilter() {
    gotoPage(1);
  }

  function clearFilter() {
    setFilter('');
  }

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

  function onDelete(categoryId: string) {
    setSelectedCategoryId(categoryId);
    setConfirmDelete(true);
  }

  function onConfirmDelete() {
    axios
      .delete(`/api/modules/product-catalog/category/${selectedCategoryId}`)
      .then(() => {
        toast.success("Category deleted successfully");
        setLoading(true);
      })
      .catch((error) => {
        toast.error("Failed to delete category");
      });
  }

  function fetchTreeData() {
    setTreeLoading(true);
    axios.get('/api/modules/product-catalog/category/tree')
      .then((response) => {
        const items = transformToTreeViewItems(response.data);
        setTreeData(items);
      })
      .catch((error) => {
        throwError(error);
      })
      .finally(() => {
        setTreeLoading(false);
      });
  }

  function handleTreeSelectionChange(selectedItems: TreeViewItem[]) {
    if (selectedItems.length === 1) {
      navigate(`/console/modules/product-catalog/category/${selectedItems[0].id}`);
    }
  }

  useEffect(() => {
    if (viewMode === 'tree') {
      fetchTreeData();
    }
  }, [viewMode]);

  useEffect(() => {
    gotoPage(1);
  }, [sort, order, filter]);

  useEffect(() => {
    gotoPage(page);
  }, [page, perPage]);

  useEffect(() => {
    if (loading) {
      axios.get('/api/modules/product-catalog/category', {
        params: {
          page,
          perPage,
          sort,
          order,
          filter
        }
      })
        .then(response => {
          setCategories(response.data.categories || []);
          setCount(response.data.count || 0);
        })
        .catch(error => {
          throwError(error);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [loading]);

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Categories</h1>
        </div>
      </header>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          <div className="flex gap-2">
            <Authorized roles="ADMIN" permissions="retail.product.create">
              <Button onClick={() => navigate('/console/modules/product-catalog/category/add')}>
                <Plus /><span className="hidden lg:inline-block">Add Category</span>
              </Button>
            </Authorized>
            <div className="flex items-center gap-1 rounded-md border">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List size={16} />
                <span className="hidden lg:inline-block ml-1">List View</span>
              </Button>
              <Button
                variant={viewMode === 'tree' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('tree')}
              >
                <TreePine size={16} />
                <span className="hidden lg:inline-block ml-1">Tree View</span>
              </Button>
            </div>
            {viewMode === 'list' && (
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
              </div>
            )}
          </div>

          {viewMode === 'list' && (
            <>
              <div className="bg-card overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/20 font-semibold">
                    <TableRow>
                      <TableHead className="w-[50px] py-2 text-center">#</TableHead>
                      <TableHead className="w-[250px] py-2">
                        <SortButton column="name" label="Name" sort={sort} order={order} sortBy={sortBy} />
                      </TableHead>
                      <TableHead className="w-[100px] py-2">
                        <SortButton column="level" label="Level" sort={sort} order={order} sortBy={sortBy} />
                      </TableHead>
                      <TableHead className="w-[200px] py-2">
                        <SortButton column="parentName" label="Parent" sort={sort} order={order} sortBy={sortBy} />
                      </TableHead>
                      <TableHead className="w-[100px] py-2">
                        <SortButton column="status" label="Status" sort={sort} order={order} sortBy={sortBy} />
                      </TableHead>
                      <TableHead className="w-[100px] py-2 text-center"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((cat, i) => (
                      <TableRow key={cat.id}>
                        <TableCell className="text-center">{(page - 1) * perPage + i + 1}</TableCell>
                        <TableCell className="font-medium">{cat.name}</TableCell>
                        <TableCell>{cat.level}</TableCell>
                        <TableCell>{cat.parentName || '-'}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${cat.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                            {cat.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </TableCell>
                        <TableCell className="flex text-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => navigate(`/console/modules/product-catalog/category/${cat.id}`)}><Eye size={16} /></Button>
                            </TooltipTrigger>
                            <TooltipContent><p>View</p></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => navigate(`/console/modules/product-catalog/category/${cat.id}/edit`)}><Pencil size={16} /></Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Edit</p></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="destructive" size="sm" onClick={() => onDelete(cat.id)}><X size={16} /></Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Delete</p></TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DataPagination
                count={count}
                perPage={perPage}
                page={page}
                gotoPage={gotoPage}
              />
            </>
          )}

          {viewMode === 'tree' && (
            <div className="bg-card rounded-lg border p-4">
              {treeLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin mr-2" />
                  <span>Loading category tree...</span>
                </div>
              ) : treeData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No categories found.
                </div>
              ) : (
                <TreeView
                  data={treeData}
                  title="Categories"
                  showExpandAll
                  showSearch
                  searchPlaceholder="Search categories..."
                  disableContextMenu
                  onSelectionChange={handleTreeSelectionChange}
                />
              )}
            </div>
          )}

        </div>
      </div>
      <ConfirmDialog
        title='Confirm Delete'
        description='This action cannot be undone. This will delete the category.'
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={onConfirmDelete}
      />

      <AlertDialog open={loading}>
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
  );
};

export default withModuleAuthorization(Category, {
  moduleId: 'product-catalog',
  moduleName: 'Product Catalog'
});
