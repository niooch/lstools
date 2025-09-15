// src/lib/api.ts
import axios from "axios";
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "./auth";

const baseURL = import.meta.env.VITE_API_URL as string;
const LOGIN_PATH = (import.meta.env.VITE_AUTH_LOGIN as string) || "/api/auth/jwt/create";
const REFRESH_PATH = (import.meta.env.VITE_AUTH_REFRESH as string) || "/api/auth/jwt/refresh";

export const api = axios.create({ baseURL, withCredentials: false });

api.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshToken(): Promise<string | null> {
    if (!refreshing) {
        refreshing = (async () => {
            const refresh = getRefreshToken();
            if (!refresh) return null;
            try {
                const r = await axios.post(baseURL + REFRESH_PATH, { refresh });
                const access = r.data.access as string;
                setTokens({ access, refresh });
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

api.interceptors.response.use(
    (res) => res,
        async (err) => {
        const original = err.config;
        if (err.response?.status === 401 && !original._retry && !original.url.endsWith(LOGIN_PATH) && !original.url.endsWith(REFRESH_PATH)) {
            original._retry = true;
            const newAccess = await refreshToken();
            if (newAccess) {
                original.headers.Authorization = `Bearer ${newAccess}`;
                return api(original);
            }
            clearTokens();
            window.location.href = "/login";
        }
        return Promise.reject(err);
    }
);

export function setAuthToken(token?: string | null) {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
}

export { LOGIN_PATH };

