import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';
import type { AdminRole } from '@expense/shared';
import { isAuthenticated } from '../lib/session';
import { useMe } from '../hooks/useAuth';
import { ROUTES } from '../constants';

export default function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: AdminRole[] }) {
  const location = useLocation();
  const { data: admin, isLoading } = useMe();

  if (!isAuthenticated()) return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;

  if (roles) {
    if (isLoading && !admin) {
      return (
        <Center h="60vh">
          <Loader />
        </Center>
      );
    }
    if (admin && !roles.includes(admin.role)) return <Navigate to={ROUTES.HOME} replace />;
  }

  return children;
}
