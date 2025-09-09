import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isLoggedIn } from "../lib/auth";

export default function ProtectedRoute() {
    const authed = isLoggedIn();
    const loc = useLocation();
    return authed ? <Outlet /> : <Navigate to="/login" state={{ from: loc }} replace />;
}

