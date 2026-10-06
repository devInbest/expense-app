import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@mantine/core';
import { IconLogout, IconMenu2, IconMoon, IconSun, IconTool } from '@tabler/icons-react';
import { useLogout } from '../../hooks/useAuth';
import { useAppSettings } from '../../hooks/useAppSettings';
import { useAppDispatch, useAppSelector } from '../../store';
import { setTheme } from '../../store/slices/commonSlice';
import { notifySuccess } from '../../lib/queryClient';
import { ROUTES } from '../../constants';
import ConfirmModal from '../common/ConfirmModal';

const iconButton = 'p-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors';

export default function Navbar({ sidebarOpen, onToggleSidebar }: { sidebarOpen: boolean; onToggleSidebar: () => void }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const theme = useAppSelector((state) => state.common.theme);
  const { data: settings } = useAppSettings();
  const logout = useLogout();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const onLogout = () =>
    logout.mutate(undefined, {
      onSettled: () => {
        setConfirmLogout(false);
        notifySuccess('Logged out');
        navigate(ROUTES.LOGIN);
      },
    });

  return (
    <header className="app-navbar h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className={`navbar-toggle ${iconButton}`}
          aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          <IconMenu2 className="w-5 h-5" />
        </button>
        {settings?.maintenanceMode && (
          <Badge
            color="orange"
            variant="light"
            leftSection={<IconTool size={12} />}
            className="cursor-pointer"
            onClick={() => navigate(ROUTES.CONTROL_CENTER_APP)}
          >
            Maintenance mode is on
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => dispatch(setTheme(theme === 'dark' ? 'light' : 'dark'))}
          className={`navbar-theme ${iconButton}`}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? <IconSun className="w-5 h-5" /> : <IconMoon className="w-5 h-5" />}
        </button>
        <button
          type="button"
          onClick={() => setConfirmLogout(true)}
          className="navbar-logout group inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          aria-label="Log out"
        >
          <IconLogout className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
          Logout
        </button>
      </div>
      <ConfirmModal
        open={confirmLogout}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmLabel="Logout"
        variant="primary"
        loading={logout.isPending}
        onConfirm={onLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </header>
  );
}
