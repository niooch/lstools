// src/components/RequireAuth.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAuthenticated } from "../lib/api";

export default function RequireAuth() {
  const authed = isAuthenticated();
  const loc = useLocation();
  return authed ? <Outlet /> : <Navigate to="/login" replace state={{ from: loc }} />;
}

