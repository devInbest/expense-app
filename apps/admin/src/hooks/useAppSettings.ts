import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@expense/api-client';
import type { AppSettingsInput } from '@expense/shared';
import { api } from '../lib/api';
import { useAppDispatch } from '../store';
import { setThemeColor } from '../store/slices/commonSlice';

export const useAppSettings = () =>
  useQuery({
    queryKey: qk.appSettings,
    queryFn: api.settings.get,
    staleTime: 5 * 60_000,
  });

export const useUpdateAppSettings = () => {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: (body: AppSettingsInput) => api.settings.update(body),
    onSuccess: (settings) => {
      queryClient.setQueryData(qk.appSettings, settings);
      dispatch(setThemeColor(settings.themeColor));
    },
  });
};
