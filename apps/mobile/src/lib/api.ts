import { Alert } from 'react-native';
import { ApiClientError, createCustomerApi, createHttp } from '@expense/api-client';
import { config } from './config';
import { tokenStorage } from './secure';

let authFailureHandler: (reason: string) => void = () => {};
export const setAuthFailureHandler = (fn: (reason: string) => void) => {
  authFailureHandler = fn;
};

export const http = createHttp({
  baseURL: config.apiUrl,
  refreshPath: '/auth/refresh',
  tokens: {
    getAccessToken: tokenStorage.getAccessToken,
    getRefreshToken: tokenStorage.getRefreshToken,
    setTokens: tokenStorage.setTokens,
    onAuthFailure: (reason) => authFailureHandler(reason),
  },
  getHeaders: () => ({ 'x-platform': config.platform, 'x-app-version': config.appVersion }),
});

export const api = createCustomerApi(http);

export const errorMessage = (err: unknown): string => {
  if (err instanceof ApiClientError) {
    return err.errors?.[0]?.message ?? err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
};

export const isOffline = (err: unknown) => err instanceof ApiClientError && err.isNetworkError;

export const showError = (err: unknown, title = 'Something went wrong') => Alert.alert(title, errorMessage(err));
