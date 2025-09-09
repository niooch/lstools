import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, LOGIN_PATH } from "../lib/api";
import { setTokens } from "../lib/auth";

export default function Login() {
    const [id, setId] = useState(""); // username or email
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const loc = useLocation() as any;

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        try {
            const { data } = await api.post(LOGIN_PATH, { username: id, email: id, password });
            // simplejwt usually returns {access, refresh}; adapt if your backend uses a different shape
            setTokens({ access: data.access, refresh: data.refresh });
            navigate(loc.state?.from?.pathname || "/routes", { replace: true });
        } catch (err: any) {
            setError(err.response?.data?.detail || "Login failed");
        }
    }

    return (
        <form onSubmit={onSubmit} style={{ maxWidth: 360, margin: "48px auto", display: "grid", gap: 12 }}>
        <h2>Login</h2>
        <input placeholder="username or email" value={id} onChange={(e) => setId(e.target.value)} />
        <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Sign in</button>
        {error ? <div style={{ color: "crimson" }}>{error}</div> : null}
        </form>
    );
}

