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
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import About from "./pages/About"; 
import Contact from "./pages/Contact";
import LocalisationsAdd from "./pages/LocalisationsAdd";

import AccessGate from "./components/AccessGate";
import { useAuth } from "./context/AuthContext";

function UsersToProfile() {
  const { id } = useParams();
  return <Navigate to={`/profile/${id}`} replace />;
}

function NavItem({
  to,
  label,
  collapsed,
  end,
}: {
  to: string;
  label: string;
  collapsed: boolean;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      style={({ isActive }) => ({
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        gap: 10,
        minHeight: 40,
        padding: collapsed ? "8px" : "8px 10px",
        borderRadius: 10,
        textDecoration: "none",
        color: isActive ? "#111827" : "#374151",
        background: isActive ? "#eef2ff" : "transparent",
        border: isActive ? "1px solid #c7d2fe" : "1px solid transparent",
        fontWeight: 600,
        transition: "background 0.15s ease, border-color 0.15s ease, color 0.15s ease",
      })}
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden
            style={{
              width: 22,
              height: 22,
              borderRadius: 7,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: isActive ? "#4f46e5" : "#e5e7eb",
              color: isActive ? "#fff" : "#4b5563",
              fontSize: 12,
              fontWeight: 700,
              flex: "0 0 auto",
            }}
          >
            {label.charAt(0).toUpperCase()}
          </span>
          {!collapsed && (
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {label}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default function App() {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const { token, user, loading, logout } = useAuth();
  const canUseEmailVerifiedTools = !!token && !loading && !!user?.is_email_verified;
  const canUseTransportTools = !!token && !loading && !!user?.is_fully_verified;
  const showEmailLockNotice = !!token && !loading && !!user && !user.is_email_verified;
  const showDocsLockNotice = !!token && !loading && !!user && user.is_email_verified && !user.is_fully_verified;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: collapsed ? "72px 1fr" : "250px 1fr",
        minHeight: "100vh",
        background: "#f8fafc",
      }}
    >
      {/* LEFT SIDEBAR */}
      <aside
        style={{
          borderRight: "1px solid #e5e7eb",
          padding: "12px",
          display: "grid",
          alignContent: "start",
          gap: 12,
          position: "sticky",
          top: 0,
          height: "100vh",
          background: "#f8fafc",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {/* Logo + hamburger */}
        <div
          style={{
            display: "flex",
            flexDirection: collapsed ? "column" : "row",
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
              justifyContent: collapsed ? "center" : "flex-start",
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
              border: "1px solid #e5e7eb",
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
        <nav
          style={{
            display: "grid",
            gap: 6,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 8,
          }}
        >
          {canUseTransportTools && <NavItem to="/routes" end collapsed={collapsed} label={t("nav.routes")} />}
          {canUseTransportTools && <NavItem to="/routes/new" collapsed={collapsed} label={t("nav.addRoute")} />}
          {canUseTransportTools && <NavItem to="/my-routes" collapsed={collapsed} label={t("nav.myRoutes")} />}
          {canUseEmailVerifiedTools && <NavItem to="/chat" collapsed={collapsed} label={t("nav.chat")} />}
          {canUseEmailVerifiedTools && (
            <NavItem to="/verify" collapsed={collapsed} label={t("nav.verification")} />
          )}
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
          {showEmailLockNotice && (
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 10,
                border: "1px solid #f59e0b",
                background: "#fffbeb",
              }}
            >
              {t("app.notices.verifyEmail")}
            </div>
          )}

          {showDocsLockNotice && (
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 10,
                border: "1px solid #93c5fd",
                background: "#eff6ff",
              }}
            >
              {t("app.notices.docsPending")}
            </div>
          )}

          <Routes>
            <Route
              path="/"
              element={
                <AccessGate level="full">
                  <RoutesList />
                </AccessGate>
              }
            />
            <Route
              path="/routes"
              element={
                <AccessGate level="full">
                  <RoutesList />
                </AccessGate>
              }
            />
            <Route
              path="/routes/new"
              element={
                <AccessGate level="full">
                  <RouteNew />
                </AccessGate>
              }
            />
            <Route
              path="/my-routes"
              element={
                <AccessGate level="full">
                  <MyRoutes />
                </AccessGate>
              }
            />
            <Route
              path="/chat"
              element={
                <AccessGate level="email">
                  <Chat />
                </AccessGate>
              }
            />
            <Route
              path="/chat/popout"
              element={
                <AccessGate level="email">
                  <ChatPopup />
                </AccessGate>
              }
            />
            <Route
              path="/verify"
              element={
                <AccessGate level="email">
                  <VerificationPage />
                </AccessGate>
              }
            />
            <Route
              path="/profile/:id"
              element={
                <AccessGate level="email">
                  <Profile />
                </AccessGate>
              }
            />
            <Route
              path="/users/:id"
              element={
                <AccessGate level="email">
                  <UsersToProfile />
                </AccessGate>
              }
            />
            <Route
              path="/profile/edit"
              element={
                <AccessGate>
                  <ProfileEdit />
                </AccessGate>
              }
            />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route
              path="/routes/:id"
              element={
                <AccessGate level="full">
                  <RouteDetails />
                </AccessGate>
              }
            />

            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route
              path="/localisations/new"
              element={
                <AccessGate level="full">
                  <LocalisationsAdd />
                </AccessGate>
              }
            />

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
              {t("footer.aboutLink")}
            </Link>
            <Link to="/contact" style={{ color: "#0a58ca", textDecoration: "underline" }}>
              {t("footer.contactLink")}
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
