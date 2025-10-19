// src/App.tsx
import { useState } from "react";
import { Routes, Route, NavLink, Navigate, useParams, Link } from "react-router-dom";
import LangSwitch from "./components/LanguageSwitcher";
import { useTranslation } from "react-i18next";

// pages
import RouteDetails from "./pages/RouteDetails";
import RoutesList from "./pages/RoutesList";
import RouteNew from "./pages/RouteNew";
import MyRoutes from "./pages/MyRoutes";
import Chat from "./pages/Chat";
import ChatPopup from "./pages/ChatPopout";
import VerificationPage from "./pages/VerifyDocs";
import Profile from "./pages/Profile";
import ProfileEdit from "./pages/ProfileEdit";
import Login from "./pages/Login";
import Register from "./pages/Register";
import About from "./pages/About"; 
import LocalisationsAdd from "./pages/LocalisationsAdd";

import { useAuth } from "./context/AuthContext";

function UsersToProfile() {
  const { id } = useParams();
  return <Navigate to={`/profile/${id}`} replace />;
}

function NavItem({
  to,
  label,
  collapsed,
}: {
  to: string;
  label: string;
  collapsed: boolean;
}) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 8,
        textDecoration: "none",
        color: isActive ? "#111" : "#333",
        background: isActive ? "#eef2ff" : "transparent",
        border: isActive ? "1px solid #e5e7eb" : "1px solid transparent",
        fontWeight: 500,
      })}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#4f46e5",
          opacity: 0.8,
          flex: "0 0 auto",
        }}
      />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}

export default function App() {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const { token, logout } = useAuth();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: collapsed ? "64px 1fr" : "240px 1fr",
        minHeight: "100vh",
        background: "#fff",
      }}
    >
      {/* LEFT SIDEBAR */}
      <aside
        style={{
          borderRight: "1px solid #eee",
          padding: "12px 10px",
          display: "grid",
          alignContent: "start",
          gap: 12,
          position: "sticky",
          top: 0,
          height: "100vh",
          background: "#fff",
        }}
      >
        {/* Logo + hamburger */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            gap: 8,
          }}
        >
          <Link
            to="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              textDecoration: "none",
            }}
          >
            {/* Put your logo file in /public/logo.svg */}
            <img src="/logo.png" alt={t("brand.logoAlt")} style={{ width: 28, height: 28 }} />
            {!collapsed && (
              <strong style={{ color: "#111", fontSize: 16 }}>{t("brand.name")}</strong>
            )}
          </Link>

          <button
            aria-label={t("top.toggleMenu")}
            onClick={() => setCollapsed((v) => !v)}
            style={{
              border: "1px solid #eee",
              background: "#fafafa",
              borderRadius: 8,
              padding: 6,
              cursor: "pointer",
              fontSize: 16,
            }}
            title={t("top.toggleMenu")}
          >
            ☰
          </button>
        </div>

        {/* NAVIGATION */}
        <nav style={{ display: "grid", gap: 6 }}>
          <NavItem to="/routes" collapsed={collapsed} label={t("nav.routes")} />
          <NavItem to="/routes/new" collapsed={collapsed} label={t("nav.addRoute")} />
          <NavItem to="/my-routes" collapsed={collapsed} label={t("nav.myRoutes")} />
          <NavItem to="/chat" collapsed={collapsed} label={t("nav.chat")} />
          {/* Visible to everyone */}
          <NavItem to="/verify" collapsed={collapsed} label={t("nav.verification")} />
          {!token && <NavItem to="/login" collapsed={collapsed} label={t("nav.login")} />}
          {!token && <NavItem to="/register" collapsed={collapsed} label={t("nav.register")} />}
          {token && (
            <NavItem to="/profile/edit" collapsed={collapsed} label={t("nav.editProfile")} />
          )}
        </nav>

        {!collapsed && (
          <div style={{ marginTop: "auto", fontSize: 12, opacity: 0.6 }}>
            {t("footer.version", { version: "v1", year: new Date().getFullYear() })}
          </div>
        )}
      </aside>

      {/* RIGHT: TOPBAR + CONTENT + FOOTER */}
      <div style={{ display: "grid", gridTemplateRows: "56px 1fr auto" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            padding: "0 12px",
            borderBottom: "1px solid #eee",
            background: "#fff",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <LangSwitch />

          {token ? (
            <button
              onClick={logout}
              style={{
                border: "1px solid #ddd",
                background: "#fff",
                padding: "6px 10px",
                borderRadius: 8,
                cursor: "pointer",
              }}
              title={t("top.logoutTitle")}
            >
              {t("top.logout")}
            </button>
          ) : null}
        </header>

        <main style={{ padding: 16 }}>
          <Routes>
            <Route path="/" element={<RoutesList />} />
            <Route path="/routes" element={<RoutesList />} />
            <Route path="/routes/new" element={<RouteNew />} />
            <Route path="/my-routes" element={<MyRoutes />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/chat/popout" element={<ChatPopup />} />
            <Route path="/verify" element={<VerificationPage />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/users/:id" element={<UsersToProfile />} />
            <Route path="/profile/edit" element={<ProfileEdit />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/routes/:id" element={<RouteDetails />} />

            <Route path="/about" element={<About />} />
            <Route path="/localisations/new" element={<LocalisationsAdd />} />

            <Route path="*" element={<div>{t("common.notFound")}</div>} />
          </Routes>
        </main>

        {/* NEW: Footer with "About us" link */}
        <footer
          style={{
            borderTop: "1px solid #eee",
            padding: "12px 16px",
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link to="/about" style={{ color: "#0a58ca", textDecoration: "underline" }}>
              {t("footer.aboutLink", "About us")}
            </Link>
          </div>
          <span style={{ opacity: 0.6, fontSize: 12 }}>
            © {new Date().getFullYear()}
          </span>
        </footer>
      </div>
    </div>
  );
}
