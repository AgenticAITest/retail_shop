import { useAuth } from '@client/provider/AuthProvider';
import { ModuleAuthorizationProvider } from '@client/hooks/useModuleAuthorization';
import { Navigate, Outlet } from 'react-router';
import { CartProvider } from '../../hooks/useCart';
import { ShiftProvider } from '../../hooks/useShift';

const PosLayout = () => {
  const { token } = useAuth();

  if (!token) {
    const redirectTo = window.location.pathname + window.location.search;
    const params = new URLSearchParams({ redirectTo });
    return <Navigate to={`/auth/login?${params}`} />;
  }

  return (
    <ModuleAuthorizationProvider>
      <ShiftProvider>
        <CartProvider>
          <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
            <Outlet />
          </div>
        </CartProvider>
      </ShiftProvider>
    </ModuleAuthorizationProvider>
  );
};

export default PosLayout;
