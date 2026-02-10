import axios from "axios";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { setupTenantAxios } from "@client/lib/tenant-axios";

// Initialize axios configuration immediately when this module loads
const initializeAxiosConfig = () => {
  const storedToken = localStorage.getItem("token");
  const storedUser = localStorage.getItem("user");
  
  // Set authorization header if token exists
  if (storedToken) {
    axios.defaults.headers.common["Authorization"] = "Bearer " + storedToken;
  }
  
  // Initialize tenant axios setup
  const tenantAxios = setupTenantAxios();
  
  // Set up tenant interceptor if user data exists
  if (storedUser) {
    try {
      const parsedUser = JSON.parse(storedUser);
      if (parsedUser?.activeTenant?.code) {
        tenantAxios.addTenantInterceptor(() => {
          // Always get fresh user data for tenant code
          const currentUserData = localStorage.getItem("user");
          if (currentUserData) {
            const currentUser = JSON.parse(currentUserData);
            return currentUser?.activeTenant?.code || null;
          }
          return null;
        });
      }
    } catch (error) {
      console.error("Error parsing stored user data during initialization:", error);
    }
  }
  
  return { storedToken, storedUser, tenantAxios };
};

// Run initialization immediately
const { storedToken, storedUser, tenantAxios: globalTenantAxios } = initializeAxiosConfig();

interface User {
  id: string;
  username: string;
  fullname: string;
  email: string;
  avatar: string;
  status: string;
  roles: string[];
  permissions: string[];
  activeTenant: {
    id: string;
    code: string;
    name: string;
    description: string;
  };
}

// Define the shape of the authentication context
interface AuthContextType {
  token: string | null;
  setToken: (newToken: string | null) => void;
  user: User | null;
  setUser: (newUser: User | null) => void;
  isAuthorized: (roles: string | string[], permissions: string | string[], operator?: 'or' | 'and') => boolean;
}

// Create context with undefined as initial value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define props interface for AuthProvider
interface AuthProviderProps {
  children: ReactNode;
}

const AuthProvider = ({ children }: AuthProviderProps) => {

  // Initialize token and user from the values we already loaded
  const [token, setToken_] = useState<string | null>(storedToken);
  
  const [user, setUser_] = useState<User | null>(() => {
    return storedUser ? JSON.parse(storedUser) : null;
  });
  
  // Function to set the authentication token
  const setToken = (newToken: string | null): void => {
    setToken_(newToken);
  };
  
  // Function to set the authenticated user
  const setUser = (newUser: User | null): void => {
    setUser_(newUser);
  };

  // Use the globally initialized tenant axios configuration
  const tenantAxios = globalTenantAxios;

  // Set up response interceptor once
  useEffect(() => {
    const responseInterceptor = axios.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          console.log('interceptor : 401 error');
          setToken(null);
          setUser(null);
        }
        return Promise.reject(error);
      }
    );

    // Cleanup function to remove the interceptor
    return () => {
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  // Update axios authorization header and tenant interceptor when token or user changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = "Bearer " + token;
      
      // Setup tenant interceptor that gets current tenant from user data
      if (user?.activeTenant?.code) {
        tenantAxios.addTenantInterceptor(() => {
          return user?.activeTenant?.code || null;
        });
      } else {
        tenantAxios.removeTenantInterceptor();
      }
    } else {
      delete axios.defaults.headers.common["Authorization"];
      tenantAxios.removeTenantInterceptor();
    }
  }, [token, user, tenantAxios]);

  const isAuthorized = (roles: string | string[], permissions: string | string[], operator?: 'or' | 'and'): boolean => {
    if (operator === undefined) {
      operator = 'or';
    }
    const authUser = user;
    // If no user is authenticated, return false
    if (!authUser) {
      return false;
    }

    const userRoles = authUser?.roles || [];
    const userPermissions = authUser?.permissions || [];

    // if user has SYSADMIN role, grant all access
    if (userRoles.includes('SYSADMIN')) {
      return true;
    }

    // If neither roles nor permissions are provided, return false
    if (!roles && !permissions) {
      return false;
    }

    // If only roles are provided, check if the user has at least one of them
    if (roles && !permissions) {
      const requiredRoles = Array.isArray(roles) ? roles : [roles];
      let hasRequiredRoles = requiredRoles.some(role => userRoles.includes(role));
      if (!hasRequiredRoles) {
        return false;
      }
    }

    // If only permissions are provided, check if the user has at least one of them
    if (permissions && !roles) {
      const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
      let hasRequiredPermissions = requiredPermissions.some(permission => userPermissions.includes(permission));
      if (!hasRequiredPermissions) {
        return false;
      }
    }

    // If both roles and permissions are provided, check if the user has at least one of them
    if (roles && permissions) {
      const requiredRoles = Array.isArray(roles) ? roles : [roles];
      const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];

      let hasRequiredRoles = requiredRoles.some(role => userRoles.includes(role));
      let hasRequiredPermissions = requiredPermissions.some(permission => userPermissions.includes(permission));

      if (operator === 'or') {
        if (!hasRequiredRoles && !hasRequiredPermissions) {
          return false;
        }
      } else if (operator === 'and') {
        if (!hasRequiredRoles || !hasRequiredPermissions) {
          return false;
        }
      }
    }
    return true;
  };

  // Handle localStorage persistence separately from axios setup
  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("user");
    }
  }, [user]);

  // Memoized value of the authentication context
  const contextValue = useMemo(
    (): AuthContextType => ({
      token,
      setToken,
      user,
      setUser,
      isAuthorized
    }),
    [token, user]
  );

  // Provide the authentication context to the children components
  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthProvider;