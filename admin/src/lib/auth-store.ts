"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, setTokens } from "./api";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "student" | "doctor";
  universityId: string;
};

type State = {
  user: AuthUser | null;
  hydrated: boolean;
  _setHydrated: () => void;
  login: (
    email: string,
    password: string,
    twoFactorCode?: string,
  ) => Promise<{ requires2fa?: boolean }>;
  logout: () => Promise<void>;
};

export const useAuth = create<State>()(
  persist(
    (set) => ({
      user: null,
      hydrated: false,
      _setHydrated: () => set({ hydrated: true }),
      async login(email, password, twoFactorCode) {
        try {
          const r = await api.post("/auth/login", {
            email,
            password,
            twoFactorCode,
          });
          const data = r.data?.data ?? r.data;
          // Refresh token now travels in an HttpOnly cookie set by the
          // backend's Set-Cookie response — JS only ever sees the access
          // token, which we keep in memory.
          setTokens(data.accessToken ?? null);
          set({ user: data.user });
          return {};
        } catch (e: unknown) {
          const code = (
            e as { response?: { data?: { error?: { code?: string } } } }
          )?.response?.data?.error?.code;
          if (code === "TWO_FA_REQUIRED") return { requires2fa: true };
          throw e;
        }
      },
      async logout() {
        try {
          // Empty body — server reads the refresh cookie. `withCredentials`
          // is set globally on the axios instance.
          await api.post("/auth/logout", {});
        } catch {
          /* ignore — we still clear local state below */
        }
        setTokens(null);
        set({ user: null });
      },
    }),
    {
      name: "admin-auth",
      // Flip `hydrated` to true once localStorage has been read so route
      // guards can wait before yanking the user back to /login on a hard
      // navigation (e.g. page.goto('/students') in Playwright).
      onRehydrateStorage: () => (s) => {
        if (s) s.hydrated = true;
      },
    },
  ),
);
