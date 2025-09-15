// src/App.tsx (add links + routes)
import { Routes, Route, Navigate, Link } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import RoutesList from "./pages/RoutesList";
import RouteNew from "./pages/RouteNew";
import MyRoutes from "./pages/MyRoutes";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import ProfileEdit from "./pages/ProfileEdit";

export default function App() {
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <nav style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <Link to="/routes">Routes</Link>
        <Link to="/routes/new">New</Link>
        <Link to="/routes/mine">My Routes</Link>
        <Link to="/chat">Chat</Link>
        <Link to="/me">Me</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/routes" replace />} />
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/routes" element={<RoutesList />} />
          <Route path="/routes/new" element={<RouteNew />} />
          <Route path="/routes/mine" element={<MyRoutes />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/me" element={<ProfileEdit />} />
          <Route path="/users/:id" element={<Profile />} />
        </Route>
      </Routes>
    </div>
  );
}
