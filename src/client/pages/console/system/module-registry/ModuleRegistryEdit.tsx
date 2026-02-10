import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import axios from 'axios';
import { Button } from '@client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@client/components/ui/card';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Textarea } from '@client/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Switch } from '@client/components/ui/switch';
import Breadcrumbs from '@client/components/console/Breadcrumbs';
import { ArrowLeft, Save, Package } from 'lucide-react';
import { toast } from 'sonner';

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

const ModuleRegistryEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [formData, setFormData] = useState({
    moduleId: '',
    moduleName: '',
    description: '',
    version: '',
    category: '',
    isActive: true,
    repositoryUrl: '',
    documentationUrl: '',
  });

  const breadcrumbItems = [
    { label: 'Module Registry', href: '/console/system/module-registry' },
    { label: 'Edit', href: `/console/system/module-registry/${id}/edit` },
  ];

  const categories = [
    'Business Logic',
    'Integration',
    'UI Component',
    'Utility',
    'Authentication',
    'Data Management',
    'Communication',
    'Analytics',
    'Sample',
    'Custom'
  ];

  useEffect(() => {
    if (id) {
      fetchModule();
    }
  }, [id]);

  const fetchModule = async () => {
    try {
      setFetchLoading(true);
      const response = await axios.get(`/api/system/module-registry/${id}`);
      const module: ModuleRegistry = response.data;
      
      setFormData({
        moduleId: module.moduleId,
        moduleName: module.moduleName,
        description: module.description || '',
        version: module.version,
        category: module.category,
        isActive: module.isActive,
        repositoryUrl: module.repositoryUrl || '',
        documentationUrl: module.documentationUrl || '',
      });
    } catch (error) {
      console.error('Error fetching module:', error);
      toast.error('Failed to fetch module details');
      navigate('/console/system/module-registry');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.moduleId.trim() || !formData.moduleName.trim() || !formData.version.trim() || !formData.category) {
      toast.error('Module ID, Module Name, Version, and Category are required');
      return;
    }

    try {
      setLoading(true);
      await axios.put(`/api/system/module-registry/${id}`, formData);
      toast.success('Module updated successfully');
      navigate('/console/system/module-registry');
    } catch (error: any) {
      console.error('Error updating module:', error);
      if (error.response?.status === 409) {
        toast.error('Module ID already exists. Please choose a different ID.');
      } else {
        toast.error('Failed to update module');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  if (fetchLoading) {
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
      
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/console/system/module-registry')}
        >
          <ArrowLeft className="mr-0 h-4 w-4" />
        </Button>
        <Package className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Edit Module</h1>
          <p className="text-muted-foreground">
            Update module information in the registry
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="moduleId">Module ID *</Label>
                <Input
                  id="moduleId"
                  value={formData.moduleId}
                  onChange={(e) => handleInputChange('moduleId', e.target.value)}
                  placeholder="e.g., user-management, order-processing"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Unique identifier for the module (kebab-case recommended)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="moduleName">Module Name *</Label>
                <Input
                  id="moduleName"
                  value={formData.moduleName}
                  onChange={(e) => handleInputChange('moduleName', e.target.value)}
                  placeholder="e.g., User Management, Order Processing"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe what this module does and its main features"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="version">Version *</Label>
                <Input
                  id="version"
                  value={formData.version}
                  onChange={(e) => handleInputChange('version', e.target.value)}
                  placeholder="e.g., 1.0.0, 2.1.3"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="repositoryUrl">Repository URL</Label>
                <Input
                  id="repositoryUrl"
                  type="url"
                  value={formData.repositoryUrl}
                  onChange={(e) => handleInputChange('repositoryUrl', e.target.value)}
                  placeholder="https://github.com/your-org/module-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="documentationUrl">Documentation URL</Label>
                <Input
                  id="documentationUrl"
                  type="url"
                  value={formData.documentationUrl}
                  onChange={(e) => handleInputChange('documentationUrl', e.target.value)}
                  placeholder="https://docs.your-org.com/modules/module-name"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => handleInputChange('isActive', checked)}
              />
              <Label htmlFor="isActive">Module is active and registered for authorization</Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/console/system/module-registry')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 mr-2 border-b-2 border-white"></div>
                Updating...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Update Module
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ModuleRegistryEdit;