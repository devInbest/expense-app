import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type { ApiFailure, ApiSuccess } from '@expense/shared';

export interface TokenStore {
  getAccessToken: () => string | null | Promise<string | null>;
  getRefreshToken: () => string | null | Promise<string | null>;
  setTokens: (tokens: { accessToken: string; refreshToken?: string }) => void | Promise<void>;
  /** Called when refresh fails; the app should clear state and go to login. */
  onAuthFailure: (reason: string) => void;
}

export interface HttpOptions {
  baseURL: string;
  tokens: TokenStore;
  /** Endpoint (relative to baseURL) used to exchange a refresh token. */
  refreshPath: string;
  /** Extra headers on every request (app version, platform, ...). */
  getHeaders?: () => Record<string, string>;
  timeoutMs?: number;
}

export class ApiClientError extends Error {
  status: number;
  code?: string;
  errors?: ApiFailure['errors'];
  isNetworkError: boolean;

  constructor(message: string, status: number, body?: Partial<ApiFailure>, isNetworkError = false) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = body?.code;
    this.errors = body?.errors;
    this.isNetworkError = isNetworkError;
  }
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const AUTH_FREE_PATHS = ['/auth/otp', '/auth/google', '/auth/refresh', '/admin/auth/login', '/admin/auth/refresh'];

export const createHttp = (opts: HttpOptions): AxiosInstance => {
  const http = axios.create({ baseURL: opts.baseURL, timeout: opts.timeoutMs ?? 20000 });

  http.interceptors.request.use(async (config) => {
    const token = await opts.tokens.getAccessToken();
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
    for (const [k, v] of Object.entries(opts.getHeaders?.() ?? {})) config.headers.set(k, v);
    return config;
  });

  let refreshing: Promise<string | null> | null = null;

  const refresh = async (): Promise<string | null> => {
    const refreshToken = await opts.tokens.getRefreshToken();
    if (!refreshToken) return null;
    try {
      const { data } = await axios.post<ApiSuccess<{ accessToken: string; refreshToken?: string }>>(
        `${opts.baseURL}${opts.refreshPath}`,
        { refreshToken },
        { timeout: opts.timeoutMs ?? 20000, headers: opts.getHeaders?.() },
      );
      await opts.tokens.setTokens(data.data);
      return data.data.accessToken;
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      // Network failure: keep the session so offline users stay logged in.
      if (!status) throw err;
      return null;
    }
  };

  http.interceptors.response.use(
    (res) => res,
    async (error: AxiosError<ApiFailure>) => {
      const original = error.config as RetriableConfig | undefined;
      const status = error.response?.status ?? 0;
      const body = error.response?.data;
      const isAuthFree = AUTH_FREE_PATHS.some((p) => original?.url?.startsWith(p));

      if (status === 401 && original && !original._retry && !isAuthFree) {
        original._retry = true;
        refreshing ??= refresh().finally(() => {
          refreshing = null;
        });
        try {
          const token = await refreshing;
          if (token) {
            original.headers.set('Authorization', `Bearer ${token}`);
            return http(original);
          }
          opts.tokens.onAuthFailure(body?.message ?? 'Session expired');
        } catch {
          // Refresh failed because the network is down; surface the original error.
        }
      } else if (status === 403 && body?.code === 'ACCOUNT_BLOCKED') {
        opts.tokens.onAuthFailure(body.message);
      }

      if (!error.response) {
        throw new ApiClientError('No internet connection', 0, undefined, true);
      }
      throw new ApiClientError(body?.message ?? error.message, status, body);
    },
  );

  return http;
};

/** Unwraps the `{ success, data }` envelope. */
export const unwrap = <T>(p: Promise<{ data: ApiSuccess<T> }>): Promise<T> => p.then((r) => r.data.data);
