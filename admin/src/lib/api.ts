import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
} from "axios";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

/**
 * Auth tokens.
 *
 * - **Access token** lives only in this module's closure (memory). It is
 *   never persisted anywhere a same-origin script could read it.
 * - **Refresh token** is owned by the backend as an HttpOnly+Secure cookie
 *   set on `/auth/login` and rotated on `/auth/refresh`. The browser
 *   includes it automatically when we call those routes with
 *   `withCredentials: true`. The token never touches JavaScript here, so
 *   an XSS payload cannot exfiltrate it.
 *
 * On a hard refresh we lose the in-memory access token and fall through to
 * `/auth/refresh`, which uses the cookie to mint a fresh pair.
 */
let accessToken: string | null = null;

export function setTokens(access: string | null, _refresh?: string | null) {
  // The `_refresh` argument is accepted for API symmetry with older callers
  // but ignored: the refresh token now lives in an HttpOnly cookie set by
  // the backend's Set-Cookie response and can only be sent by the browser,
  // never by JS.
  accessToken = access;
}

export function getAccessToken() {
  return accessToken;
}

/**
 * Hint that a refresh might succeed. The actual cookie is opaque to JS, so
 * callers should optimistically attempt `/auth/refresh` and fall back to
 * the login screen on 401. We default to `true` so the app always tries to
 * resume; the cost of one failed refresh is negligible.
 */
export function hasRefreshHint(): boolean {
  return true;
}

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  // Required so the browser sends the HttpOnly refresh cookie on
  // /auth/refresh and /auth/logout. The backend's CORS config allows
  // credentials from the configured admin origin.
  withCredentials: true,
});

api.interceptors.request.use((cfg) => {
  if (accessToken) {
    cfg.headers = cfg.headers ?? {};
    (cfg.headers as Record<string, string>).Authorization =
      `Bearer ${accessToken}`;
  }
  return cfg;
});

let refreshing: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (!refreshing) {
    refreshing = axios
      // Empty body — the refresh token is read from the HttpOnly cookie on
      // the backend.
      .post(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
      .then((r) => {
        const data = r.data?.data ?? r.data;
        setTokens(data.accessToken ?? null);
        return (data.accessToken ?? null) as string | null;
      })
      .catch(() => {
        setTokens(null);
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
    if (err.response?.status === 401 && !cfg._retry) {
      cfg._retry = true;
      const newToken = await tryRefresh();
      if (newToken) {
        cfg.headers = cfg.headers ?? {};
        (cfg.headers as Record<string, string>).Authorization =
          `Bearer ${newToken}`;
        return api.request(cfg);
      }
      if (
        typeof window !== "undefined" &&
        window.location.pathname !== "/login"
      ) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  },
);

export type Envelope<T> = {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
};
export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

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

/**
 * One-time migration: clear any legacy refresh token left behind in
 * localStorage by older builds. Idempotent and safe to call repeatedly.
 */
if (typeof window !== "undefined") {
  try {
    if (localStorage.getItem("refreshToken")) {
      localStorage.removeItem("refreshToken");
    }
    // Older builds also stored the access token; we now keep it in memory
    // only, so drop the persisted copy. The user gets one extra round-trip
    // through /auth/refresh on first load — a fair trade for XSS safety.
    if (localStorage.getItem("accessToken")) {
      localStorage.removeItem("accessToken");
    }
  } catch {
    // Some browsers throw in private mode — ignore.
  }
}
