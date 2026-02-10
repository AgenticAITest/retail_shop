import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

interface TenantAxiosConfig {
  getCurrentTenant: () => string | null;
  onUnauthorized?: () => void;
  onTenantError?: (error: any) => void;
}

/**
 * Creates a tenant-aware axios instance that automatically adds X-Tenant-Code headers
 */
export function createTenantAxios(config: TenantAxiosConfig): AxiosInstance {
  const { getCurrentTenant, onUnauthorized, onTenantError } = config;

  const instance = axios.create();

  // Request interceptor to add tenant headers
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const tenantCode = getCurrentTenant();
      
      // Add X-Tenant-Code header if we have a tenant
      if (tenantCode && config.headers) {
        config.headers['X-Tenant-Code'] = tenantCode;
      }

      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor for tenant-specific error handling
  instance.interceptors.response.use(
    (response) => {
      return response;
    },
    (error) => {
      if (error.response) {
        const status = error.response.status;
        
        // Handle authentication errors
        if (status === 401) {
          console.log('Tenant axios interceptor: 401 error - unauthorized');
          onUnauthorized?.();
        }
        
        // Handle tenant-specific errors
        if (status === 400 || status === 404) {
          const message = error.response.data?.message || '';
          if (message.toLowerCase().includes('tenant')) {
            console.log('Tenant axios interceptor: Tenant error -', message);
            onTenantError?.(error);
          }
        }
      }
      
      return Promise.reject(error);
    }
  );

  return instance;
}

/**
 * Enhanced axios configuration that integrates with tenant context
 */
export function setupTenantAxios() {
  // Store reference to interceptor ID for cleanup
  let requestInterceptorId: number | null = null;
  
  return {
    /**
     * Add tenant-aware request interceptor to global axios
     */
    addTenantInterceptor(getCurrentTenant: () => string | null) {
      // Remove existing tenant interceptor if it exists
      if (requestInterceptorId !== null) {
        axios.interceptors.request.eject(requestInterceptorId);
      }
      
      // Add new tenant-aware interceptor and store its ID
      requestInterceptorId = axios.interceptors.request.use(
        (config: InternalAxiosRequestConfig) => {
          const tenantCode = getCurrentTenant();
          
          // Add X-Tenant-Code header if we have a tenant
          if (tenantCode && config.headers) {
            config.headers['X-Tenant-Code'] = tenantCode;
          }

          return config;
        },
        (error) => {
          return Promise.reject(error);
        }
      );
    },

    /**
     * Remove tenant interceptor
     */
    removeTenantInterceptor() {
      if (requestInterceptorId !== null) {
        axios.interceptors.request.eject(requestInterceptorId);
        requestInterceptorId = null;
      }
    },

    /**
     * Create a request config with tenant header
     */
    withTenant(tenantCode: string, config: AxiosRequestConfig = {}): AxiosRequestConfig {
      return {
        ...config,
        headers: {
          ...config.headers,
          'X-Tenant-Code': tenantCode,
        },
      };
    },
  };
}

export default {
  createTenantAxios,
  setupTenantAxios,
};