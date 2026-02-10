import Breadcrumbs from '@client/components/console/Breadcrumbs';
import ModuleConfirmDialog from '@client/components/console/ModuleConfirmDialog';
import { Badge } from '@client/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@client/components/ui/card';
import { Label } from '@client/components/ui/label';
import { Switch } from '@client/components/ui/switch';
import axios from 'axios';
import { AlertCircle, CheckCircle, Settings, Shield, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface RegisteredModule {
  moduleId: string;
  moduleName: string;
  description: string;
  version: string;
  category: string;
  isAuthorized: boolean;
}

const ModuleAuthorization: React.FC = () => {
  const [registeredModules, setRegisteredModules] = useState<RegisteredModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    moduleId: string;
    moduleName: string;
    action: 'enable' | 'disable';
    currentState: boolean;
  } | null>(null);

  const breadcrumbItems = [
    { label: 'Console', href: '/console' },
    { label: 'System', href: '/console/system' },
    { label: 'Modules', href: '/console/system/module-authorization' },
  ];

  useEffect(() => {
    fetchRegisteredModules();
  }, []);

  const fetchRegisteredModules = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/system/module-authorization/registered-modules');
      // Ensure response.data is an array
      const modules = Array.isArray(response.data) ? response.data : [];
      setRegisteredModules(modules);
    } catch (error) {
      console.error('Error fetching registered modules:', error);
      toast.error('Failed to fetch registered modules');
      // Set to empty array on error to prevent map error
      setRegisteredModules([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAuthorization = (moduleId: string, moduleName: string, currentState: boolean) => {
    const action = currentState ? 'disable' : 'enable';
    setConfirmDialog({
      moduleId,
      moduleName,
      action,
      currentState
    });
  };

  const handleConfirmToggle = async (tableOption: boolean) => {
    if (!confirmDialog) return;

    try {
      setUpdating(confirmDialog.moduleId);
      const newState = !confirmDialog.currentState;
      
      const requestBody = {
        moduleName: confirmDialog.moduleName,
        isEnabled: newState,
        ...(confirmDialog.action === 'enable' ? 
          { createTables: tableOption } : 
          { deleteTables: tableOption }
        )
      };
      
      await axios.patch(`/api/system/module-authorization/toggle/${confirmDialog.moduleId}`, requestBody);

      // Update local state
      setRegisteredModules(prev =>
        prev.map(module =>
          module.moduleId === confirmDialog.moduleId
            ? { ...module, isAuthorized: newState }
            : module
        )
      );

      let successMessage = `Module "${confirmDialog.moduleName}" ${newState ? 'enabled' : 'disabled'} successfully`;
      if (newState && tableOption) {
        successMessage += ' and tables created';
      } else if (newState && !tableOption) {
        successMessage += ' (no tables created)';
      } else if (!newState && tableOption) {
        successMessage += ' and tables deleted';
      } else if (!newState && !tableOption) {
        successMessage += ' (tables preserved)';
      }

      toast.success(successMessage);

      // reload window to refresh sidebar
      window.location.reload();

      
    } catch (error) {
      console.error('Error toggling modules:', error);
      toast.error('Failed to update modules');
    } finally {
      setUpdating(null);
      setConfirmDialog(null);
    }
  };

  const getStatusIcon = (isAuthorized: boolean) => {
    return isAuthorized ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (isAuthorized: boolean) => {
    return (
      <Badge variant={isAuthorized ? 'default' : 'secondary'}>
        {isAuthorized ? 'Enabled' : 'Disabled'}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
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
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Module Management</h1>
          <p className="text-muted-foreground">
            Manage which modules are accessible for your tenant
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Important Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
            <p className="text-sm">
              <strong>Module Access:</strong> Enabling a module gives users in your tenant access to that module's features and data.
            </p>
          </div>
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
            <p className="text-sm">
              <strong>Permissions:</strong> Module authorization is separate from user permissions. Users still need appropriate permissions (view, create, edit, delete) to perform actions within enabled modules.
            </p>
          </div>
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
            <p className="text-sm">
              <strong>Immediate Effect:</strong> Changes to module authorization take effect immediately. Users may need to refresh their browsers to see newly enabled modules.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Registered Modules</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Enable or disable module access for your tenant. Changes take effect immediately.
          </p>
        </CardHeader>
        <CardContent>
          {!Array.isArray(registeredModules) || registeredModules.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Modules Registered</h3>
              <p className="text-muted-foreground">
                There are no modules registered for authorization at this time.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {registeredModules.map((module) => (
                <div
                  key={module.moduleId}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(module.isAuthorized)}
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-1">
                        <h3 className="font-semibold">{module.moduleName}</h3>
                        {getStatusBadge(module.isAuthorized)}
                        <Badge variant="outline">{module.category}</Badge>
                        <Badge variant="outline">v{module.version}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {module.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Module ID: {module.moduleId}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Label
                        htmlFor={`toggle-${module.moduleId}`}
                        className="text-sm font-medium"
                      >
                        {module.isAuthorized ? 'Enabled' : 'Disabled'}
                      </Label>
                      <Switch
                        id={`toggle-${module.moduleId}`}
                        checked={module.isAuthorized}
                        onCheckedChange={() =>
                          handleToggleAuthorization(
                            module.moduleId,
                            module.moduleName,
                            module.isAuthorized
                          )
                        }
                        disabled={updating === module.moduleId}
                      />
                    </div>
                    
                    {updating === module.moduleId && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {confirmDialog && (
        <ModuleConfirmDialog
          open={!!confirmDialog}
          onOpenChange={(open) => !open && setConfirmDialog(null)}
          onConfirm={handleConfirmToggle}
          moduleId={confirmDialog.moduleId}
          moduleName={confirmDialog.moduleName}
          action={confirmDialog.action}
        />
      )}
    </div>
  );
};

export default ModuleAuthorization;