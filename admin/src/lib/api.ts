import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

let accessToken: string | null = null;
let refreshToken: string | null = null;

if (typeof window !== 'undefined') {
  accessToken = localStorage.getItem('accessToken');
  refreshToken = localStorage.getItem('refreshToken');
}

export function setTokens(access: string | null, refresh: string | null) {
  accessToken = access;
  refreshToken = refresh;
  if (typeof window === 'undefined') return;
  if (access) localStorage.setItem('accessToken', access);
  else localStorage.removeItem('accessToken');
  if (refresh) localStorage.setItem('refreshToken', refresh);
  else localStorage.removeItem('refreshToken');
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return refreshToken;
}

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: false,
});

api.interceptors.request.use((cfg) => {
  if (accessToken) {
    cfg.headers = cfg.headers ?? {};
    (cfg.headers as Record<string, string>).Authorization = `Bearer ${accessToken}`;
  }
  return cfg;
});

let refreshing: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (!refreshToken) return null;
  if (!refreshing) {
    refreshing = axios
      .post(`${API_URL}/auth/refresh`, { refreshToken })
      .then((r) => {
        const data = r.data?.data ?? r.data;
        setTokens(data.accessToken, data.refreshToken);
        return data.accessToken as string;
      })
      .catch(() => {
        setTokens(null, null);
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const cfg = err.config as AxiosRequestConfig & { _retry?: boolean };
    if (err.response?.status === 401 && !cfg._retry && refreshToken) {
      cfg._retry = true;
      const newToken = await tryRefresh();
      if (newToken) {
        cfg.headers = cfg.headers ?? {};
        (cfg.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return api.request(cfg);
      }
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export type Envelope<T> = { success: boolean; data: T; meta?: Record<string, unknown> };
export type PaginationMeta = { page: number; pageSize: number; total: number; totalPages: number };
export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number; totalPages: number };

export async function unwrap<T>(p: Promise<{ data: Envelope<T> }>): Promise<T> {
  const r = await p;
  return r.data.data;
}

export async function unwrapPaginated<T>(
  p: Promise<{ data: { data: T[]; meta?: Partial<PaginationMeta> } }>,
): Promise<Paginated<T>> {
  const r = await p;
  const items = r.data.data ?? [];
  const meta = r.data.meta ?? {};
  return {
    items,
    total: meta.total ?? items.length,
    page: meta.page ?? 1,
    pageSize: meta.pageSize ?? items.length,
    totalPages: meta.totalPages ?? 1,
  };
}
