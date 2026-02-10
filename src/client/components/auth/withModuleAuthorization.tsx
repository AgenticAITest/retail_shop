import React from 'react';
import ModuleRouteGuard from './ModuleRouteGuard';

interface WithModuleAuthorizationOptions {
  moduleId: string;
  moduleName: string;
  fallback?: React.ReactNode;
}

export function withModuleAuthorization<P extends object>(
  Component: React.ComponentType<P>,
  options: WithModuleAuthorizationOptions
) {
  const WrappedComponent: React.FC<P> = (props) => {
    return (
      <ModuleRouteGuard
        moduleId={options.moduleId}
        moduleName={options.moduleName}
        fallback={options.fallback}
      >
        <Component {...props} />
      </ModuleRouteGuard>
    );
  };

  WrappedComponent.displayName = `withModuleAuthorization(${Component.displayName || Component.name})`;

  return WrappedComponent;
}