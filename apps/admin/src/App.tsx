import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';
import { isAuthenticated } from './lib/session';
import { ROUTES } from './constants';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './routes/ProtectedRoute';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const UsersPage = lazy(() => import('./pages/users/UsersPage'));
const UserDetailPage = lazy(() => import('./pages/users/UserDetailPage'));
const RoomsPage = lazy(() => import('./pages/rooms/RoomsPage'));
const RoomDetailPage = lazy(() => import('./pages/rooms/RoomDetailPage'));
const ActivityPage = lazy(() => import('./pages/activity/ActivityPage'));
const UsagePage = lazy(() => import('./pages/usage/UsagePage'));
const BroadcastPage = lazy(() => import('./pages/broadcast/BroadcastPage'));
const CategoriesPage = lazy(() => import('./pages/masters/CategoriesPage'));
const ControlCenterLayout = lazy(() => import('./pages/control-center/ControlCenterLayout'));
const AppSettingsPage = lazy(() => import('./pages/control-center/AppSettingsPage'));
const ThemeSettingsPage = lazy(() => import('./pages/control-center/ThemeSettingsPage'));
const AdminsPage = lazy(() => import('./pages/control-center/AdminsPage'));
const AccountPage = lazy(() => import('./pages/account/AccountPage'));

const pageFallback = (
  <Center h="50vh">
    <Loader />
  </Center>
);

function PublicOnly({ children }: { children: ReactNode }) {
  if (isAuthenticated()) return <Navigate to={ROUTES.HOME} replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={pageFallback}>
        <Routes>
          <Route
            path={ROUTES.LOGIN}
            element={
              <PublicOnly>
                <LoginPage />
              </PublicOnly>
            }
          />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:id" element={<UserDetailPage />} />
            <Route path="rooms" element={<RoomsPage />} />
            <Route path="rooms/:id" element={<RoomDetailPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="usage" element={<UsagePage />} />
            <Route path="broadcast" element={<BroadcastPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="control-center" element={<ControlCenterLayout />}>
              <Route index element={<Navigate to="app" replace />} />
              <Route path="app" element={<AppSettingsPage />} />
              <Route path="theme" element={<ThemeSettingsPage />} />
              <Route
                path="admins"
                element={
                  <ProtectedRoute roles={['superadmin']}>
                    <AdminsPage />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="account" element={<AccountPage />} />
          </Route>
          <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
