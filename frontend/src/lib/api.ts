// src/lib/api.ts
import axios from "axios";
import { getAccessToken, getRefreshToken, setTokens, clearClientSessionCache } from "./auth";

const baseURL = (import.meta.env.VITE_API_URL as string) || "";
export const LOGIN_PATH =
  ((import.meta.env.VITE_AUTH_LOGIN as string) || "/api/auth/token/create");
const REFRESH_PATH =
  ((import.meta.env.VITE_AUTH_REFRESH as string) || "/api/auth/token/refresh");

// Allow marking a request as already retried once after 401
declare module "axios" {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface AxiosRequestConfig {
    _retry?: boolean;
  }
}

export const api = axios.create({ baseURL, withCredentials: false });

// ---- tiny helpers ----------------------------------------------------------
let refreshing: Promise<string | null> | null = null;
let didRedirectToLogin = false;

function isAbsolute(url: string) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
function pathOf(url?: string): string {
  if (!url) return "";
  try {
    return isAbsolute(url) ? new URL(url).pathname : new URL(url, baseURL).pathname;
  } catch {
    return "";
  }
}
function isAuthEndpoint(url?: string): boolean {
  const p = pathOf(url);
  return p === LOGIN_PATH || p === REFRESH_PATH;
}
function redirectToLogin() {
  if (didRedirectToLogin) return;
  didRedirectToLogin = true;
  refreshing = null;
  clearClientSessionCache();
  setAuthToken(null);
  // dispatch app-wide signal (optional, if you want to listen elsewhere)
  try {
    window.dispatchEvent(new CustomEvent("auth:logout"));
  } catch {}
  window.location.replace("/login");
  // reset guard after a moment to avoid sticky state if user returns
  setTimeout(() => (didRedirectToLogin = false), 4000);
}
async function refreshToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      const refresh = getRefreshToken();
      if (!refresh) return null;
      try {
        const r = await axios.post(baseURL + REFRESH_PATH, { refresh });
        const access = r.data.access as string;
        setTokens({ access, refresh });
        setAuthToken(access);
        return access;
      } catch {
        return null;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

// ---- request: attach bearer if we have one ---------------------------------
api.interceptors.request.use((config) => {
  const p = pathOf(config.url);
  if (!isAuthEndpoint(p)) {
    const token = getAccessToken();
    if (token) {
      config.headers = config.headers || {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ---- response: single refresh attempt on 401, else boot to /login ----------
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config || {};
    const status = err?.response?.status;

    // If we’re already handling login/refresh calls, just bubble the error
    if (isAuthEndpoint(original?.url)) {
      return Promise.reject(err);
    }

    // Only try refresh once per request
    if (status === 401 && !original._retry) {
      original._retry = true;

      // Attempt refresh
      const newAccess = await refreshToken();
      if (newAccess) {
        original.headers = original.headers || {};
        (original.headers as any).Authorization = `Bearer ${newAccess}`;
        return api(original);
      }

      // Refresh failed → clear and send to login
      redirectToLogin();
      return Promise.reject(err);
    }

    // Optional hardening: if there is no response (network error) AND no token,
    // we’re probably logged-out → punt to login.
    if (!err.response && !getAccessToken()) {
      redirectToLogin();
    }

    return Promise.reject(err);
  }
);

// ---- handy exports for router/guards ---------------------------------------
export function setAuthToken(token?: string | null) {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

export function logout() {
  redirectToLogin();
}
