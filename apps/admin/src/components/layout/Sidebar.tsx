import { NavLink, useLocation } from 'react-router-dom';
import {
  IconActivity,
  IconAdjustmentsHorizontal,
  IconBroadcast,
  IconCategory,
  IconChartBar,
  IconLayoutDashboard,
  IconUsers,
  IconUsersGroup,
  type Icon,
} from '@tabler/icons-react';
import { useMe } from '../../hooks/useAuth';
import { label } from '../../lib/format';
import { ROUTES } from '../../constants';

interface NavItem {
  to: string;
  label: string;
  Icon: Icon;
  end?: boolean;
  /** Highlight for every path under this prefix (e.g. detail pages, tabs). */
  basePath?: string;
  superadminOnly?: boolean;
}

const navItems: NavItem[] = [
  { to: ROUTES.HOME, label: 'Dashboard', end: true, Icon: IconLayoutDashboard },
  { to: ROUTES.USERS, label: 'Users', basePath: ROUTES.USERS, Icon: IconUsers },
  { to: ROUTES.ROOMS, label: 'Rooms', basePath: ROUTES.ROOMS, Icon: IconUsersGroup },
  { to: ROUTES.ACTIVITY, label: 'Activity log', Icon: IconActivity },
  { to: ROUTES.USAGE, label: 'App usage', Icon: IconChartBar },
  { to: ROUTES.BROADCAST, label: 'Broadcast', Icon: IconBroadcast, superadminOnly: true },
  { to: ROUTES.CATEGORIES, label: 'Categories', Icon: IconCategory },
  { to: ROUTES.CONTROL_CENTER_APP, basePath: ROUTES.CONTROL_CENTER, label: 'Control Center', Icon: IconAdjustmentsHorizontal },
];

const linkClass = (isOpen: boolean, isActive: boolean) =>
  `sidebar-nav-link flex min-w-0 items-center overflow-hidden rounded-lg text-md font-medium transition-colors ${
    isOpen ? 'gap-3 justify-start px-3 py-2' : 'justify-center px-2 py-2.5'
  } ${
    isActive
      ? 'sidebar-nav-link--active bg-white/75 text-brand-deep shadow-sm'
      : 'sidebar-nav-link--inactive text-brand-on hover:bg-white/70 hover:text-brand-deep'
  }`;

export default function Sidebar({ isOpen = true }: { isOpen?: boolean }) {
  const { data: admin } = useMe();
  const location = useLocation();
  const items = navItems.filter((item) => !item.superadminOnly || admin?.role === 'superadmin');

  return (
    <aside
      data-open={isOpen}
      className={`flex-shrink-0 overflow-hidden bg-gradient-to-br from-brand-deep via-brand-mid to-brand-light text-white flex flex-col h-full transition-[width] duration-300 ease-in-out will-change-[width] ${
        isOpen ? 'w-64' : 'w-20'
      }`}
    >
      <div className={`flex h-14 flex-shrink-0 flex-col items-center justify-center border-b border-white/10 ${isOpen ? 'px-3' : 'px-2'}`}>
        <div className="flex w-full min-w-0 items-center justify-center gap-2">
          <img src="/logo.svg" alt="Expense Admin" className="h-7 w-7 flex-shrink-0 object-contain" />
          {isOpen && <span className="truncate text-lg font-semibold tracking-wide text-white">Expense Admin</span>}
        </div>
      </div>

      <nav className={`flex-1 overflow-x-hidden overflow-y-auto py-4 space-y-1 ${isOpen ? 'px-3' : 'px-2'}`}>
        {items.map(({ to, label: text, Icon, end, basePath }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={!isOpen ? text : undefined}
            className={({ isActive }) => linkClass(isOpen, basePath ? location.pathname.startsWith(basePath) : isActive)}
          >
            <Icon className={`${isOpen ? 'w-5 h-5' : 'w-7 h-7'} flex-shrink-0`} stroke={1.8} />
            {isOpen && <span className="overflow-hidden text-ellipsis whitespace-nowrap">{text}</span>}
          </NavLink>
        ))}
      </nav>

      <NavLink
        to={ROUTES.ACCOUNT}
        className={`py-4 border-t border-white/10 transition-[padding] duration-300 ease-in-out ${isOpen ? 'px-4' : 'px-2'}`}
        title={!isOpen ? admin?.name : 'Account'}
      >
        <div className={`flex items-center gap-3 ${isOpen ? '' : 'justify-center'}`}>
          <div className="sidebar-user-avatar text-lg font-semibold">{(admin?.name ?? '?').charAt(0).toUpperCase()}</div>
          <div className={`min-w-0 overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'w-full opacity-100' : 'w-0 opacity-0'}`}>
            <p className="text-md font-medium text-white truncate whitespace-nowrap">{admin?.name}</p>
            <p className="sidebar-user-role text-sm truncate whitespace-nowrap">{label(admin?.role)}</p>
          </div>
        </div>
      </NavLink>
    </aside>
  );
}
