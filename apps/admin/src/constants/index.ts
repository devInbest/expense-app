export const PAGE_SIZE = Number(import.meta.env.VITE_PAGE_SIZE) || 20;

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'expense_admin_access_token',
  REFRESH_TOKEN: 'expense_admin_refresh_token',
  ADMIN: 'expense_admin_profile',
  THEME: 'expense_admin_theme',
  THEME_COLOR: 'expense_admin_theme_color',
} as const;

export const ROUTES = {
  LOGIN: '/login',
  HOME: '/',
  USERS: '/users',
  ROOMS: '/rooms',
  ACTIVITY: '/activity',
  USAGE: '/usage',
  BROADCAST: '/broadcast',
  CATEGORIES: '/categories',
  CONTROL_CENTER: '/control-center',
  CONTROL_CENTER_APP: '/control-center/app',
  CONTROL_CENTER_THEME: '/control-center/theme',
  CONTROL_CENTER_ADMINS: '/control-center/admins',
  ACCOUNT: '/account',
} as const;
