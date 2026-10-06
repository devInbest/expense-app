import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@expense/api-client';
import type { AdminLoginInput } from '@expense/shared';
import { api } from '../lib/api';
import { clearSession, getStoredAdmin, isAuthenticated, saveSession } from '../lib/session';

/** The signed-in admin; the source of truth for name and role across the portal. */
export const useMe = () =>
  useQuery({
    queryKey: qk.admin.me,
    queryFn: async () => {
      const admin = await api.auth.me();
      saveSession({ admin });
      return admin;
    },
    enabled: isAuthenticated(),
    initialData: getStoredAdmin() ?? undefined,
    staleTime: 5 * 60_000,
  });

export const useIsSuperAdmin = () => useMe().data?.role === 'superadmin';

export const useLogin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userName, password }: AdminLoginInput) => api.auth.login(userName, password),
    onSuccess: (data) => {
      saveSession(data);
      queryClient.setQueryData(qk.admin.me, data.admin);
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await api.auth.logout();
      } catch {
        // Best effort: the local session is cleared either way.
      }
    },
    onSettled: () => {
      clearSession();
      queryClient.clear();
    },
  });
};

export const useChangePassword = () =>
  useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      api.auth.changePassword(currentPassword, newPassword),
  });
