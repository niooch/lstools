import { Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
// pages...
import Chat from "./pages/Chat";
import ChatPopout from "./pages/ChatPopout";
import VerifyDocs from "./pages/VerifyDocs";
import Register from "./pages/Register";
import Login from "./pages/Login";
import RoutesList from "./pages/RoutesList";
import RouteNew from "./pages/RouteNew";
import MyRoutes from "./pages/MyRoutes";
import Profile from "./pages/Profile";
import ProfileEdit from "./pages/ProfileEdit";
import ProtectedRoute from "./components/ProtectedRoute";
import LogoutButton from "./components/LogoutButton";

export default function App() {
    const { user, logout } = useAuth();
    const nav = useNavigate();

    function doLogout() {
        logout();
        nav("/login");
    }

    return (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        <nav style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        {!user ? (
            <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
            </>
        ) : (
        <>
        <Link to="/routes">Routes</Link>
        <Link to="/routes/new">New</Link>
        <Link to="/routes/mine">My Routes</Link>
        <Link to="/chat">Chat</Link>
        {!user.is_email_verified && <Link to="/verify">Verify</Link>}
        <Link to="/me">Me</Link>
        <LogoutButton /> 
        </>
        )}
        </nav>

        <Routes>
        <Route path="/" element={<Navigate to="/routes" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
        <Route path="/routes" element={<RoutesList />} />
        <Route path="/routes/new" element={<RouteNew />} />
        <Route path="/routes/mine" element={<MyRoutes />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/chat/popout" element={<ChatPopout />} />
        <Route path="/verify" element={<VerifyDocs />} />
        <Route path="/me" element={<ProfileEdit />} />
        <Route path="/users/:id" element={<Profile />} />
        </Route>
        </Routes>
        </div>
    );
}
