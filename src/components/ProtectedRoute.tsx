import { Navigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { Loader } from './ui/Loader';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isLoggedIn = useStore((state) => state.isAuthenticated);
  const loading = useStore((state) => state.loading);

  if (loading) {
    return <Loader fullScreen />;
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
