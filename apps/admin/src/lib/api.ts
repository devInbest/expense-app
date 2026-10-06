import { createAdminApi, createHttp } from '@expense/api-client';
import { clearSession, getAccessToken, getRefreshToken, saveSession } from './session';
import { ROUTES } from '../constants';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const http = createHttp({
  baseURL: API_URL,
  refreshPath: '/admin/auth/refresh',
  getHeaders: () => ({ 'x-platform': 'web' }),
  tokens: {
    getAccessToken,
    getRefreshToken,
    setTokens: (tokens) => saveSession(tokens),
    onAuthFailure: () => {
      clearSession();
      if (!window.location.pathname.startsWith(ROUTES.LOGIN)) window.location.assign(ROUTES.LOGIN);
    },
  },
});

export const api = createAdminApi(http);
