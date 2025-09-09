// src/lib/auth.ts
export type Tokens = { access: string; refresh?: string };

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

export function setTokens(t: Tokens) {
    localStorage.setItem(ACCESS_KEY, t.access);
    if (t.refresh) localStorage.setItem(REFRESH_KEY, t.refresh);
}
export function getAccessToken() {
    return localStorage.getItem(ACCESS_KEY) || "";
}
export function getRefreshToken() {
    return localStorage.getItem(REFRESH_KEY) || "";
}
export function clearTokens() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
}
export function isLoggedIn() {
    return !!getAccessToken();
}

