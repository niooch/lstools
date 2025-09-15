import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, setAuthToken } from "../lib/api";
import type { AuthedUser } from "../types";

const TOKEN_KEY = "access_token";
const ME_PATH = import.meta.env.VITE_AUTH_ME || "/api/users/me";
const LOGIN_PATH = import.meta.env.VITE_AUTH_LOGIN || "/api/auth/token/create";

type AuthCtx = {
    user: AuthedUser | null;
    token: string | null;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
    const [user, setUser] = useState<AuthedUser | null>(null);

    useEffect(() => {
        setAuthToken(token);
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    }, [token]);

    async function refreshUser() {
        if (!token) { setUser(null); return; }
        try {
            const r = await api.get(ME_PATH);
            setUser(r.data as AuthedUser);
        } catch {
            setUser(null);
        }
    }

    useEffect(() => { void refreshUser(); }, [token]);

    async function login(username: string, password: string) {
        const r = await api.post(LOGIN_PATH, { username, password });
        // support SimpleJWT-style shape
        const access = r.data?.access || r.data?.token || r.data?.auth_token;
        if (!access) throw new Error("No access token returned");
        setToken(access);
        await refreshUser();
    }

    function logout() {
        setToken(null);
        setUser(null);
    }

    const value = useMemo(() => ({ user, token, login, logout, refreshUser }), [user, token]);
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
    const v = useContext(Ctx);
    if (!v) throw new Error("useAuth must be used within <AuthProvider>");
    return v;
}

