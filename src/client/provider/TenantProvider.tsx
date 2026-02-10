import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import axios from 'axios';

interface TenantInfo {
  id: string;
  code: string;
  name: string;
  description?: string;
  schemaName: string;
  isActive: boolean;
  settings?: {
    timezone?: string;
    locale?: string;
    theme?: string;
    features?: string[];
  };
}

interface TenantContextType {
  tenant: TenantInfo | null;
  loading: boolean;
  error: string | null;
  switchTenant: (tenantCode: string) => Promise<void>;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};

interface TenantProviderProps {
  children: React.ReactNode;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
  const { user, token } = useAuth();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTenantInfo = async () => {
    if (!token || !user) {
      setTenant(null);
      setLoading(false);
      return;
    }

    // Extract tenant code from user's activeTenant
    const tenantCode = user.activeTenant?.code;
    if (!tenantCode) {
      setError('No active tenant found in user data');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch current tenant info from API
      const response = await axios.get('/api/system/tenant/current', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Code': tenantCode,
        },
      });

      if (response.status !== 200) {
        throw new Error(`Failed to fetch tenant info: ${response.statusText}`);
      }

      const tenantData = response.data;
      
      // Ensure we have the schema name
      const tenantInfo: TenantInfo = {
        ...tenantData,
        schemaName: tenantData.schemaName || `tenant_${tenantCode}`,
      };

      setTenant(tenantInfo);

      // Store tenant context in localStorage for persistence
      localStorage.setItem('currentTenant', JSON.stringify(tenantInfo));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch tenant info';
      setError(errorMessage);
      console.error('Error fetching tenant info:', err);
      
      // Try to load from localStorage as fallback
      const storedTenant = localStorage.getItem('currentTenant');
      if (storedTenant && user.activeTenant?.code) {
        try {
          const parsedTenant = JSON.parse(storedTenant);
          // Only use stored tenant if it matches current user's tenant
          if (parsedTenant.code === user.activeTenant.code) {
            setTenant(parsedTenant);
            setError(null);
          }
        } catch {
          localStorage.removeItem('currentTenant');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const switchTenant = async (tenantCode: string) => {
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      setLoading(true);
      setError(null);

      // Call the backend tenant switch API (using tenantId for compatibility)
      // First get the tenant info to get the ID
      const tenantResponse = await axios.get(`/api/system/tenant`, {
        params: { filter: tenantCode },
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Code': tenant?.code || user?.activeTenant?.code || 'system',
        },
      });

      const tenants = tenantResponse.data.tenants || [];
      const targetTenant = tenants.find((t: any) => t.code === tenantCode);
      
      if (!targetTenant) {
        throw new Error(`Tenant with code '${tenantCode}' not found`);
      }

      // Call the switch tenant API
      await axios.post('/api/system/user/switch-tenant', {
        tenantId: targetTenant.id
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Code': tenant?.code || user?.activeTenant?.code || 'system',
        },
      });

      // Refresh the page to ensure all components re-initialize with new tenant context
      window.location.reload();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to switch tenant';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const refreshTenant = async () => {
    await fetchTenantInfo();
  };

  useEffect(() => {
    fetchTenantInfo();
  }, [user, token]);

  // Clear tenant data when user logs out
  useEffect(() => {
    if (!user) {
      setTenant(null);
      localStorage.removeItem('currentTenant');
    }
  }, [user]);

  const contextValue: TenantContextType = {
    tenant,
    loading,
    error,
    switchTenant,
    refreshTenant,
  };

  return (
    <TenantContext.Provider value={contextValue}>
      {children}
    </TenantContext.Provider>
  );
};

export default TenantProvider;