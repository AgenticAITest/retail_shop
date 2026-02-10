import React from 'react';
import { useModuleAuthorization } from '@client/hooks/useModuleAuthorization';
import { Card, CardContent, CardHeader, CardTitle } from '@client/components/ui/card';
import { Button } from '@client/components/ui/button';
import { Shield, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router';

interface ModuleRouteGuardProps {
  moduleId: string;
  moduleName: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ModuleRouteGuard: React.FC<ModuleRouteGuardProps> = ({
  moduleId,
  moduleName,
  children,
  fallback
}) => {
  const { isModuleAuthorized, checkingAuthorization } = useModuleAuthorization();
  const navigate = useNavigate();

  if (checkingAuthorization) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isModuleAuthorized(moduleId)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex justify-center items-center min-h-[400px] p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-full">
                <Shield className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <CardTitle className="flex items-center justify-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span>Module Access Restricted</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              The <strong>{moduleName}</strong> module is not authorized for your tenant.
            </p>
            <p className="text-sm text-muted-foreground">
              Please contact your administrator to request access to this module.
            </p>
            <div className="pt-4">
              <Button
                onClick={() => navigate('/console/dashboard')}
                variant="outline"
                className="w-full"
              >
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default ModuleRouteGuard;