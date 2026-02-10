import { useAuth } from '@client/provider/AuthProvider';
import { Navigate, Outlet } from 'react-router';
import './../print.css';

const PrintLayout = () => {
  const { token } = useAuth();

  // Check if the user is authenticated
  if (!token) {
    // If not authenticated, redirect to the login page
    const redirectTo = window.location.pathname + window.location.search;
    const params = new URLSearchParams({redirectTo});
    const to = `/auth/login?${params}`;
    return <Navigate to={to} />;
  }

  return (
    <Outlet/>    
  )
}

export default PrintLayout