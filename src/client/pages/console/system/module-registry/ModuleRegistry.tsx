import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@client/components/ui/card';
import { Badge } from '@client/components/ui/badge';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Switch } from '@client/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import Breadcrumbs from '@client/components/console/Breadcrumbs';
import DataPagination from '@client/components/data-pagination';
import { Plus, Search, Edit, Trash2, Package, ExternalLink, BookOpen, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';

interface ModuleRegistry {
  id: string;
  moduleId: string;
  moduleName: string;
  description?: string;
  version: string;
  category: string;
  isActive: boolean;
  repositoryUrl?: string;
  documentationUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const ModuleRegistry: React.FC = () => {
  const navigate = useNavigate();
  const [modules, setModules] = useState<ModuleRegistry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  const breadcrumbItems = [
    { label: 'Console', href: '/console' },
    { label: 'System', href: '/console/system' },
    { label: 'Module Registry', href: '/console/system/module-registry' },
  ];

  useEffect(() => {
    fetchModules();
  }, [pagination.page, pagination.limit, searchTerm, categoryFilter, statusFilter]);

  const fetchModules = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (searchTerm) params.append('search', searchTerm);
      if (categoryFilter) params.append('category', categoryFilter);
      if (statusFilter) params.append('isActive', statusFilter);

      const response = await axios.get(`/api/system/module-registry?${params}`);
      
      setModules(response.data.data);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination.total,
        totalPages: response.data.pagination.totalPages,
      }));

      // Extract unique categories for filter dropdown
      const uniqueCategories = [...new Set(response.data.data.map((module: ModuleRegistry) => module.category))] as string[];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching modules:', error);
      toast.error('Failed to fetch modules');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchModules();
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('');
    setStatusFilter('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await axios.put(`/api/system/module-registry/${id}`, {
        isActive: !currentStatus,
      });

      toast.success(`Module ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchModules();
    } catch (error) {
      console.error('Error updating module status:', error);
      toast.error('Failed to update module status');
    }
  };

  const handleDelete = async (id: string, moduleName: string) => {
    if (!confirm(`Are you sure you want to delete "${moduleName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await axios.delete(`/api/system/module-registry/${id}`);
      toast.success('Module deleted successfully');
      fetchModules();
    } catch (error) {
      console.error('Error deleting module:', error);
      toast.error('Failed to delete module');
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return (
      <Badge variant={isActive ? 'default' : 'secondary'}>
        {isActive ? 'Active' : 'Inactive'}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 px-2">
        <Breadcrumbs items={breadcrumbItems} />
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-2">
      {/* <Breadcrumbs items={breadcrumbItems} /> */}
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Package className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Module Registry</h1>
            <p className="text-muted-foreground">
              Manage registered modules in the system
            </p>
          </div>
        </div>
        <Button onClick={() => navigate('/console/system/module-registry/add')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Module
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="h-5 w-5" />
            <span>Search & Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search modules..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={categoryFilter || "all"} onValueChange={(value) => setCategoryFilter(value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end space-x-2">
              <Button onClick={handleSearch}>
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
              <Button variant="outline" onClick={handleClearFilters}>
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modules List */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Modules ({pagination.total})</CardTitle>
        </CardHeader>
        <CardContent>
          {modules.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Modules Found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || categoryFilter || statusFilter
                  ? 'No modules match your current filters.'
                  : 'No modules have been added yet.'}
              </p>
              <Button onClick={() => navigate('/console/system/module-registry/add')}>
                <Plus className="mr-2 h-4 w-4" />
                Add First Module
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {modules.map((module) => (
                <div
                  key={module.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-semibold text-lg">{module.moduleName}</h3>
                      {getStatusBadge(module.isActive)}
                      <Badge variant="outline">{module.category}</Badge>
                      <Badge variant="outline">v{module.version}</Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-2">
                      {module.description || 'No description available'}
                    </p>
                    
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      <span>ID: {module.moduleId}</span>
                      <span>Created: {new Date(module.createdAt).toLocaleDateString()}</span>
                      {module.repositoryUrl && (
                        <a
                          href={module.repositoryUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>Repository</span>
                        </a>
                      )}
                      {module.documentationUrl && (
                        <a
                          href={module.documentationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"
                        >
                          <BookOpen className="h-3 w-3" />
                          <span>Docs</span>
                        </a>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor={`toggle-${module.id}`} className="text-sm">
                        {module.isActive ? 'Active' : 'Inactive'}
                      </Label>
                      <Switch
                        id={`toggle-${module.id}`}
                        checked={module.isActive}
                        onCheckedChange={() => handleToggleStatus(module.id, module.isActive)}
                      />
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/console/system/module-registry/${module.id}/edit`)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(module.id, module.moduleName)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {modules.length > 0 && (
        <DataPagination
          page={pagination.page}
          perPage={pagination.limit}
          count={pagination.total}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
};

export default ModuleRegistry;