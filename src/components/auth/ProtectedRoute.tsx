import type { ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { AppLoader } from '@/components/ui/app-loader';
import { PasswordChangeRequired } from './PasswordChangeRequired';
import { RestrictedScreen } from './RestrictedScreen';
import type { ActorRole } from '@/types/roles';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Who may open this page. The server still decides what it returns. */
  allow?: (roles: ActorRole[]) => boolean;
}

export function ProtectedRoute({ children, allow }: ProtectedRouteProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, roles, isLoading } = useAuthContext();

  if (isLoading) {
    return <AppLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (user.must_change_password) {
    return <PasswordChangeRequired />;
  }

  if (allow && !allow(roles)) {
    return <RestrictedScreen onLeave={() => navigate('/', { replace: true })} />;
  }

  return <>{children}</>;
}
