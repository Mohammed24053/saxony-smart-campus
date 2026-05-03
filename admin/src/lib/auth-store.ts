'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, getRefreshToken, setTokens } from './api';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'student' | 'doctor';
  universityId: string;
};

type State = {
  user: AuthUser | null;
  hydrated: boolean;
  login: (email: string, password: string, twoFactorCode?: string) => Promise<{ requires2fa?: boolean }>;
  logout: () => Promise<void>;
};

export const useAuth = create<State>()(
  persist(
    (set) => ({
      user: null,
      hydrated: false,
      async login(email, password, twoFactorCode) {
        try {
          const r = await api.post('/auth/login', { email, password, twoFactorCode });
          const data = r.data?.data ?? r.data;
          setTokens(data.accessToken, data.refreshToken);
          set({ user: data.user });
          return {};
        } catch (e: any) {
          const code = e?.response?.data?.error?.code;
          if (code === 'TWO_FA_REQUIRED') return { requires2fa: true };
          throw e;
        }
      },
      async logout() {
        const refreshToken = getRefreshToken();
        try {
          if (refreshToken) {
            await api.post('/auth/logout', { refreshToken });
          }
        } catch {/* ignore */}
        setTokens(null, null);
        set({ user: null });
      },
    }),
    {
      name: 'admin-auth',
      onRehydrateStorage: () => (s) => {
        s?.hydrated;
      },
    },
  ),
);
