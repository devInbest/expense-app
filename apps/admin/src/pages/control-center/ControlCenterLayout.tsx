import { NavLink, Outlet } from 'react-router-dom';
import PageBanner from '../../components/common/PageBanner';
import { useIsSuperAdmin } from '../../hooks/useAuth';
import { ROUTES } from '../../constants';

const tabs = [
  { label: 'Mobile app', to: ROUTES.CONTROL_CENTER_APP },
  { label: 'Theme', to: ROUTES.CONTROL_CENTER_THEME },
  { label: 'Admin accounts', to: ROUTES.CONTROL_CENTER_ADMINS, superadminOnly: true },
];

export default function ControlCenterLayout() {
  const isSuperAdmin = useIsSuperAdmin();

  return (
    <div>
      <PageBanner className="mb-4" title="Control Center" subtitle="App-wide configuration and portal access" />
      <div className="control-center-tabs-shell mb-4">
        <div className="control-center-tabs-list" role="tablist" aria-label="Control Center">
          {tabs
            .filter((tab) => !tab.superadminOnly || isSuperAdmin)
            .map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) => (isActive ? 'control-center-tab control-center-tab--active' : 'control-center-tab')}
              >
                {tab.label}
              </NavLink>
            ))}
        </div>
      </div>
      <Outlet />
    </div>
  );
}
