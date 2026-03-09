import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type AccessLevel = "auth" | "email" | "full";

type AccessGateProps = {
  children: ReactNode;
  level?: AccessLevel;
};

export default function AccessGate({ children, level = "auth" }: AccessGateProps) {
  const { t } = useTranslation();
  const { token, user, loading } = useAuth();
  const loc = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }

  if (loading) {
    return <div>{t("accessGate.loadingAccount")}</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }

  if (level === "email" && !user.is_email_verified) {
    return (
      <BlockedState
        title={t("accessGate.email.title")}
        detail={t("accessGate.email.detail")}
      />
    );
  }

  if (level === "full" && !user.is_fully_verified) {
    if (!user.is_email_verified) {
      return (
        <BlockedState
          title={t("accessGate.email.title")}
          detail={t("accessGate.full.emailDetail")}
        />
      );
    }

    return (
      <BlockedState
        title={t("accessGate.full.title")}
        detail={t("accessGate.full.detail")}
        action={<Link to="/verify">{t("accessGate.full.action")}</Link>}
      />
    );
  }

  return <>{children}</>;
}

function BlockedState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        maxWidth: 720,
        margin: "24px auto",
        padding: 20,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#fffaf0",
        display: "grid",
        gap: 10,
      }}
    >
      <h2 style={{ margin: 0 }}>{title}</h2>
      <div>{detail}</div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
