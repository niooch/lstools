// src/lib/auth.ts
export type Tokens = { access: string; refresh?: string };

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
const LANGUAGE_KEY = "i18nextLng";

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

export function clearClientSessionCache() {
    clearTokens();

    try {
        sessionStorage.clear();
    } catch {}

    try {
        const lang = localStorage.getItem(LANGUAGE_KEY);
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (key && key !== LANGUAGE_KEY) keysToRemove.push(key);
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
        if (lang) localStorage.setItem(LANGUAGE_KEY, lang);
    } catch {}

    if (typeof window !== "undefined" && "caches" in window) {
        void caches
            .keys()
            .then((names) => Promise.all(names.map((name) => caches.delete(name))))
            .catch(() => {});
    }
}
export function isLoggedIn() {
    return !!getAccessToken();
}
