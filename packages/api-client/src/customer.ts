import type { AxiosInstance } from 'axios';
import type {
  ApiSuccess,
  AppSettingsDTO,
  AuthResult,
  BudgetDTO,
  BudgetProgressDTO,
  CategoryDTO,
  CompleteOnboardingInput,
  CreateBudgetInput,
  CreateCategoryInput,
  CreateInviteInput,
  CreateRecurringInput,
  CreateRoomExpenseInput,
  CreateRoomInput,
  CreateTransactionInput,
  CursorPage,
  DeviceInfo,
  ExportQuery,
  InsightsQuery,
  InsightsSummaryDTO,
  ListTransactionsQuery,
  NotificationDTO,
  OtpRequestResult,
  PublicUserDTO,
  RecurringRuleDTO,
  RegisterPushTokenInput,
  RoomBalancesDTO,
  RoomBudgetSummaryDTO,
  RoomDTO,
  RoomExpenseDTO,
  RoomSpendingDTO,
  RoomSpendingItemDTO,
  RoomSpendingQuery,
  RoomInviteDTO,
  RoomMemberDTO,
  RoomPreviewDTO,
  SessionDTO,
  SettlementDTO,
  SignUploadInput,
  SyncPullResult,
  SyncPushInput,
  SyncPushResult,
  TrackEventsInput,
  TransactionDTO,
  UpdateProfileInput,
  UpdateRoomExpenseInput,
  UpdateRoomInput,
  UpdateTransactionInput,
  UploadSignResult,
  UserDTO,
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

export const createCustomerApi = (http: AxiosInstance) => {
  const get = <T>(url: string, params?: Params) => unwrap<T>(http.get<ApiSuccess<T>>(url, { params: clean(params) }));
  const post = <T>(url: string, body?: unknown) => unwrap<T>(http.post<ApiSuccess<T>>(url, body));
  const patch = <T>(url: string, body?: unknown) => unwrap<T>(http.patch<ApiSuccess<T>>(url, body));
  const del = <T>(url: string, params?: Params) => unwrap<T>(http.delete<ApiSuccess<T>>(url, { params: clean(params) }));

  return {
    http,
    appSettings: () => get<AppSettingsDTO>('/app-settings'),

    auth: {
      requestOtp: (phone: string) => post<OtpRequestResult>('/auth/otp/request', { phone }),
      verifyOtp: (phone: string, code: string, device?: DeviceInfo) =>
        post<AuthResult>('/auth/otp/verify', { phone, code, device }),
      google: (idToken: string, device?: DeviceInfo) => post<AuthResult>('/auth/google', { idToken, device }),
      logout: (refreshToken?: string) => post<null>('/auth/logout', { refreshToken }),
      logoutAll: () => post<null>('/auth/logout-all'),
    },

    me: {
      get: () => get<UserDTO>('/me'),
      update: (body: UpdateProfileInput) => patch<UserDTO>('/me', body),
      onboard: (body: CompleteOnboardingInput) => post<UserDTO>('/me/onboarding', body),
      sessions: () => get<SessionDTO[]>('/me/sessions'),
      revokeSession: (id: string) => del<null>(`/me/sessions/${id}`),
      registerPushToken: (body: RegisterPushTokenInput) => post<null>('/me/devices', body),
      unregisterPushToken: (deviceId: string) => del<null>(`/me/devices/${encodeURIComponent(deviceId)}`),
      requestPhoneLink: (phone: string) => post<OtpRequestResult>('/me/phone/request', { phone }),
      verifyPhoneLink: (phone: string, code: string) => post<UserDTO>('/me/phone/verify', { phone, code }),
      linkGoogle: (idToken: string) => post<UserDTO>('/me/google', { idToken }),
      deleteAccount: () => del<null>('/me', { confirm: 'DELETE' }),
    },

    users: {
      search: (q: string) => get<PublicUserDTO[]>('/users/search', { q }),
    },

    categories: {
      list: () => get<CategoryDTO[]>('/categories'),
      create: (body: CreateCategoryInput) => post<CategoryDTO>('/categories', body),
      update: (id: string, body: Partial<CreateCategoryInput>) => patch<CategoryDTO>(`/categories/${id}`, body),
      remove: (id: string, reassignTo?: string) => del<null>(`/categories/${id}`, { reassignTo }),
    },

    transactions: {
      list: (q: ListTransactionsQuery = {}) => get<CursorPage<TransactionDTO>>('/transactions', q as Params),
      get: (id: string) => get<TransactionDTO>(`/transactions/${id}`),
      create: (body: CreateTransactionInput) => post<TransactionDTO>('/transactions', body),
      update: (id: string, body: UpdateTransactionInput) => patch<TransactionDTO>(`/transactions/${id}`, body),
      remove: (id: string) => del<null>(`/transactions/${id}`),
      syncPush: (body: SyncPushInput) => post<SyncPushResult>('/transactions/sync', body),
      syncPull: (since?: string) => get<SyncPullResult>('/transactions/sync', { since }),
    },

    budgets: {
      list: () => get<BudgetProgressDTO[]>('/budgets'),
      create: (body: CreateBudgetInput) => post<BudgetDTO>('/budgets', body),
      update: (id: string, body: Partial<CreateBudgetInput>) => patch<BudgetDTO>(`/budgets/${id}`, body),
      remove: (id: string) => del<null>(`/budgets/${id}`),
    },

    recurring: {
      list: () => get<RecurringRuleDTO[]>('/recurring'),
      create: (body: CreateRecurringInput) => post<RecurringRuleDTO>('/recurring', body),
      update: (id: string, body: Params) => patch<RecurringRuleDTO>(`/recurring/${id}`, body),
      remove: (id: string) => del<null>(`/recurring/${id}`),
    },

    insights: {
      summary: (q: InsightsQuery) => get<InsightsSummaryDTO>('/insights/summary', q as Params),
    },

    exports: {
      /** Returns a URL the app can open/download with the current access token as a query param. */
      transactionsPath: (q: ExportQuery) => ({ url: '/exports/transactions', params: clean(q as Params) }),
    },

    rooms: {
      list: (includeArchived = false) => get<RoomDTO[]>('/rooms', { includeArchived }),
      get: (id: string) => get<RoomDTO>(`/rooms/${id}`),
      create: (body: CreateRoomInput) => post<RoomDTO>('/rooms', body),
      update: (id: string, body: UpdateRoomInput) => patch<RoomDTO>(`/rooms/${id}`, body),
      archive: (id: string) => post<RoomDTO>(`/rooms/${id}/archive`),
      unarchive: (id: string) => post<RoomDTO>(`/rooms/${id}/unarchive`),
      regenerateCode: (id: string) => post<RoomDTO>(`/rooms/${id}/invite-code`),
      preview: (code: string) => get<RoomPreviewDTO>(`/rooms/join/${code}`),
      join: (code: string) => post<RoomDTO>('/rooms/join', { code }),
      leave: (id: string) => post<null>(`/rooms/${id}/leave`),

      members: (id: string) => get<RoomMemberDTO[]>(`/rooms/${id}/members`),
      updateMemberRole: (id: string, userId: string, role: 'admin' | 'member') =>
        patch<RoomMemberDTO>(`/rooms/${id}/members/${userId}`, { role }),
      removeMember: (id: string, userId: string) => del<null>(`/rooms/${id}/members/${userId}`),
      transferOwnership: (id: string, userId: string) => post<RoomDTO>(`/rooms/${id}/transfer`, { userId }),

      invites: (id: string) => get<RoomInviteDTO[]>(`/rooms/${id}/invites`),
      invite: (id: string, body: CreateInviteInput) => post<RoomInviteDTO>(`/rooms/${id}/invites`, body),
      revokeInvite: (id: string, inviteId: string) => del<null>(`/rooms/${id}/invites/${inviteId}`),

      expenses: (id: string, q: Params = {}) => get<CursorPage<RoomExpenseDTO>>(`/rooms/${id}/expenses`, q),
      addExpense: (id: string, body: CreateRoomExpenseInput) => post<RoomExpenseDTO>(`/rooms/${id}/expenses`, body),
      updateExpense: (id: string, expenseId: string, body: UpdateRoomExpenseInput) =>
        patch<RoomExpenseDTO>(`/rooms/${id}/expenses/${expenseId}`, body),
      remove: (id: string) => del<null>(`/rooms/${id}`),
      spending: (q: RoomSpendingQuery) => get<RoomSpendingDTO>('/rooms/spending', q as Params),
      spendingItems: (q: RoomSpendingQuery) => get<RoomSpendingItemDTO[]>('/rooms/spending/items', q as Params),
      removeExpense: (id: string, expenseId: string) => del<null>(`/rooms/${id}/expenses/${expenseId}`),
      expense: (id: string, expenseId: string) => get<RoomExpenseDTO>(`/rooms/${id}/expenses/${expenseId}`),
      markSharePaid: (id: string, expenseId: string, userId: string, paid: boolean, upi?: { txnId?: string; app?: string }) =>
        post<RoomExpenseDTO>(`/rooms/${id}/expenses/${expenseId}/shares/${userId}/paid`, { paid, upi }),

      balances: (id: string) => get<RoomBalancesDTO>(`/rooms/${id}/balances`),
      budgetSummary: (id: string) => get<RoomBudgetSummaryDTO>(`/rooms/${id}/budget-summary`),
      setBudget: (id: string, body: CreateBudgetInput) => post<BudgetDTO>(`/rooms/${id}/budget`, body),

      settlements: (id: string) => get<SettlementDTO[]>(`/rooms/${id}/settlements`),
      confirmSettlement: (id: string, settlementId: string) =>
        post<SettlementDTO>(`/rooms/${id}/settlements/${settlementId}/confirm`),
      removeSettlement: (id: string, settlementId: string) => del<null>(`/rooms/${id}/settlements/${settlementId}`),
    },

    invites: {
      mine: () => get<RoomInviteDTO[]>('/invites'),
      accept: (inviteId: string) => post<RoomDTO>(`/invites/${inviteId}/accept`),
      decline: (inviteId: string) => post<null>(`/invites/${inviteId}/decline`),
    },

    notifications: {
      list: (cursor?: string) => get<CursorPage<NotificationDTO> & { unread: number }>('/notifications', { cursor }),
      markRead: (ids?: string[]) => post<null>('/notifications/read', { ids }),
    },

    uploads: {
      sign: (body: SignUploadInput) => post<UploadSignResult>('/uploads/sign', body),
    },

    events: {
      track: (body: TrackEventsInput) => post<null>('/events', body),
    },
  };
};

export type CustomerApi = ReturnType<typeof createCustomerApi>;
