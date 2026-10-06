import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { qk } from '@expense/api-client';
import type { AuthResult, CategoryDTO, UserDTO } from '@expense/shared';
import { api, isOffline, setAuthFailureHandler } from './api';
import { flushEvents, startSession } from './analytics';
import { clearLocalData, initDb, kv } from './db';
import { googleSignOut } from './google';
import { registerForPush, unregisterPush } from './push';
import { tokenStorage } from './secure';
import { resetSyncState, syncNow } from './sync';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'unreachable';

interface AuthContextValue {
  status: AuthStatus;
  user: UserDTO | null;
  signIn: (result: AuthResult) => Promise<void>;
  signOut: (options?: { remote?: boolean }) => Promise<void>;
  setUser: (user: UserDTO) => void;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = 'cache.user';
export const CATEGORIES_KEY = 'cache.categories';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUserState] = useState<UserDTO | null>(null);
  const signingOut = useRef(false);

  const setUser = useCallback(
    (next: UserDTO) => {
      setUserState(next);
      queryClient.setQueryData(qk.me, next);
      void kv.set(USER_KEY, next);
    },
    [queryClient],
  );

  const signOut = useCallback(
    async ({ remote = true }: { remote?: boolean } = {}) => {
      if (signingOut.current) return;
      signingOut.current = true;
      try {
        if (remote) {
          await flushEvents();
          await unregisterPush();
          const refreshToken = await tokenStorage.getRefreshToken();
          await api.auth.logout(refreshToken ?? undefined).catch(() => undefined);
        }
        await googleSignOut();
        await tokenStorage.clear();
        await clearLocalData();
        resetSyncState();
        queryClient.clear();
        setUserState(null);
        setStatus('signedOut');
      } finally {
        signingOut.current = false;
      }
    },
    [queryClient],
  );

  const afterSignedIn = useCallback((u: UserDTO) => {
    startSession();
    void syncNow();
    if (u.onboarded) void registerForPush();
  }, []);

  const bootstrap = useCallback(async () => {
    setStatus('loading');
    await initDb();
    if (!(await tokenStorage.getRefreshToken())) {
      setStatus('signedOut');
      return;
    }
    const [cachedUser, cachedCategories] = await Promise.all([
      kv.get<UserDTO>(USER_KEY),
      kv.get<CategoryDTO[]>(CATEGORIES_KEY),
    ]);
    if (cachedCategories) queryClient.setQueryData(qk.categories, cachedCategories, { updatedAt: 0 });
    if (cachedUser) {
      // Offline-first: open straight into the app with the cached profile.
      setUserState(cachedUser);
      setStatus('signedIn');
    }
    try {
      const fresh = await api.me.get();
      setUser(fresh);
      setStatus('signedIn');
      afterSignedIn(fresh);
    } catch (err) {
      if (cachedUser) {
        if (isOffline(err)) afterSignedIn(cachedUser);
      } else {
        setStatus(isOffline(err) ? 'unreachable' : 'signedOut');
      }
    }
  }, [afterSignedIn, queryClient, setUser]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- bootstrap syncs auth state from storage/network; status already starts as 'loading'
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    setAuthFailureHandler((reason) => {
      void signOut({ remote: false }).then(() => Alert.alert('Signed out', reason));
    });
  }, [signOut]);

  const signIn = useCallback(
    async (result: AuthResult) => {
      await initDb();
      await tokenStorage.setTokens(result);
      setUser(result.user);
      setStatus('signedIn');
      afterSignedIn(result.user);
    },
    [afterSignedIn, setUser],
  );

  const value = useMemo(
    () => ({ status, user, signIn, signOut, setUser, retry: () => void bootstrap() }),
    [status, user, signIn, signOut, setUser, bootstrap],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

/** For screens that only render when signed in. */
export const useUser = () => {
  const { user } = useAuth();
  if (!user) throw new Error('useUser called while signed out');
  return user;
};
