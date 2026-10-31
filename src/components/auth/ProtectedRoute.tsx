import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { AppLoader } from '@/components/ui/app-loader';
import { PasswordChangeRequired } from './PasswordChangeRequired';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const { user, isLoading } = useAuthContext();

  if (isLoading) {
    return <AppLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (user.must_change_password) {
    return <PasswordChangeRequired />;
  }

  return <>{children}</>;
}
