import { QueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { ApiClientError } from '@expense/api-client';

/** A user-facing message for any error thrown by the API client. */
export const getApiErrorMessage = (error: unknown, fallback = 'Something went wrong') => {
  if (error instanceof ApiClientError) {
    if (error.isNetworkError) return 'Cannot reach the server. Check that the API is running.';
    return error.errors?.[0]?.message ?? error.message;
  }
  return error instanceof Error ? error.message : fallback;
};

export const notifyError = (error: unknown, fallback?: string) =>
  notifications.show({ message: getApiErrorMessage(error, fallback), color: 'red' });

export const notifySuccess = (message: string) => notifications.show({ message, color: 'green' });

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => {
        if (error instanceof ApiClientError && error.status >= 400 && error.status < 500) return false;
        return count < 1;
      },
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
