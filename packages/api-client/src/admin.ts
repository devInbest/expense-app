import type { AxiosInstance } from 'axios';
import type {
  ActivityLogDTO,
  AdminActivityQuery,
  AdminAuthResult,
  AdminDashboardDTO,
  AdminDTO,
  AdminEventsQuery,
  AdminEventsSummaryDTO,
  AdminRoomRowDTO,
  AdminRoomsQuery,
  AdminUserDetailDTO,
  AdminUserRowDTO,
  AdminUsersQuery,
  ApiSuccess,
  AppSettingsDTO,
  AppSettingsInput,
  BroadcastInput,
  CategoryDTO,
  CreateAdminInput,
  CreateCategoryInput,
  Paged,
  RoomDTO,
  RoomExpenseDTO,
  RoomMemberDTO,
  TransactionDTO,
} from '@expense/shared';
import { unwrap } from './http';

type Params = Record<string, unknown>;

const clean = (params?: Params) =>
  params
    ? Object.fromEntries(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]),
      )
    : undefined;

export const createAdminApi = (http: AxiosInstance) => {
  const get = <T>(url: string, params?: Params) => unwrap<T>(http.get<ApiSuccess<T>>(url, { params: clean(params) }));
  const post = <T>(url: string, body?: unknown) => unwrap<T>(http.post<ApiSuccess<T>>(url, body));
  const patch = <T>(url: string, body?: unknown) => unwrap<T>(http.patch<ApiSuccess<T>>(url, body));
  const put = <T>(url: string, body?: unknown) => unwrap<T>(http.put<ApiSuccess<T>>(url, body));
  const del = <T>(url: string) => unwrap<T>(http.delete<ApiSuccess<T>>(url));
  const paged = <T>(url: string, params?: Params) =>
    http
      .get<ApiSuccess<T[]>>(url, { params: clean(params) })
      .then((r) => ({ items: r.data.data, pagination: r.data.pagination! }) as Paged<T>);

  return {
    http,
    auth: {
      login: (userName: string, password: string) => post<AdminAuthResult>('/admin/auth/login', { userName, password }),
      me: () => get<AdminDTO>('/admin/auth/me'),
      logout: () => post<null>('/admin/auth/logout'),
      changePassword: (currentPassword: string, newPassword: string) =>
        put<null>('/admin/auth/change-password', { currentPassword, newPassword }),
    },
    dashboard: (days = 30) => get<AdminDashboardDTO>('/admin/dashboard', { days }),
    users: {
      list: (q: AdminUsersQuery = {}) => paged<AdminUserRowDTO>('/admin/users', q as Params),
      get: (id: string) => get<AdminUserDetailDTO>(`/admin/users/${id}`),
      activity: (id: string, page = 1) => paged<ActivityLogDTO>(`/admin/users/${id}/activity`, { page }),
      transactions: (id: string, page = 1) => paged<TransactionDTO>(`/admin/users/${id}/transactions`, { page }),
      block: (id: string, reason: string) => post<null>(`/admin/users/${id}/block`, { reason }),
      unblock: (id: string) => post<null>(`/admin/users/${id}/unblock`),
      revokeSessions: (id: string) => post<null>(`/admin/users/${id}/revoke-sessions`),
    },
    rooms: {
      list: (q: AdminRoomsQuery = {}) => paged<AdminRoomRowDTO>('/admin/rooms', q as Params),
      get: (id: string) =>
        get<{ room: RoomDTO; members: RoomMemberDTO[]; recentExpenses: RoomExpenseDTO[] }>(`/admin/rooms/${id}`),
    },
    activity: (q: AdminActivityQuery = {}) => paged<ActivityLogDTO>('/admin/activity', q as Params),
    events: (q: AdminEventsQuery = {}) => get<AdminEventsSummaryDTO>('/admin/events', q as Params),
    broadcast: (body: BroadcastInput) => post<{ recipients: number }>('/admin/broadcast', body),
    categories: {
      list: () => get<CategoryDTO[]>('/admin/categories'),
      create: (body: CreateCategoryInput) => post<CategoryDTO>('/admin/categories', body),
      update: (id: string, body: Partial<CreateCategoryInput>) => patch<CategoryDTO>(`/admin/categories/${id}`, body),
      remove: (id: string) => del<null>(`/admin/categories/${id}`),
    },
    admins: {
      list: () => get<AdminDTO[]>('/admin/admins'),
      create: (body: CreateAdminInput) => post<AdminDTO>('/admin/admins', body),
      update: (id: string, body: Partial<Pick<AdminDTO, 'name' | 'role' | 'isActive'>>) =>
        patch<AdminDTO>(`/admin/admins/${id}`, body),
      resetPassword: (id: string) => post<{ password: string }>(`/admin/admins/${id}/reset-password`),
      remove: (id: string) => del<null>(`/admin/admins/${id}`),
    },
    settings: {
      get: () => get<AppSettingsDTO>('/app-settings'),
      update: (body: AppSettingsInput) => put<AppSettingsDTO>('/admin/settings', body),
    },
  };
};

export type AdminApi = ReturnType<typeof createAdminApi>;
