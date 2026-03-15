import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";

const VERIFY_EMAIL_PATH =
  (import.meta.env.VITE_AUTH_VERIFY_EMAIL as string) || "/api/auth/verify-email";

type VerifyStatus = "loading" | "success" | "already" | "error" | "invalid";

export default function VerifyEmail() {
  const { t } = useTranslation();
  const loc = useLocation();
  const search = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const uid = search.get("uid") || "";
  const token = search.get("token") || "";
  const hasLinkData = !!uid && !!token;

  const [status, setStatus] = useState<VerifyStatus>(hasLinkData ? "loading" : "invalid");
  const [username, setUsername] = useState("");
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    if (!hasLinkData) {
      setStatus("invalid");
      return;
    }

    let alive = true;
    setStatus("loading");
    setUsername("");
    setDetail(null);

    api
      .get(VERIFY_EMAIL_PATH, { params: { uid, token } })
      .then((resp) => {
        if (!alive) return;
        const data = resp.data ?? {};
        setUsername(typeof data.username === "string" ? data.username : "");
        setDetail(typeof data.detail === "string" ? data.detail : null);
        setStatus(data.already_verified ? "already" : "success");
      })
      .catch((err: any) => {
        if (!alive) return;
        const errorDetail = err?.response?.data?.detail;
        setDetail(typeof errorDetail === "string" ? errorDetail : null);
        setStatus("error");
      });

    return () => {
      alive = false;
    };
  }, [hasLinkData, token, uid]);

  const successLine =
    status === "already"
      ? username
        ? t("auth.email_verify_already_user", { user: username })
        : t("auth.email_verify_already")
      : username
      ? t("auth.email_verify_success_user", { user: username })
      : t("auth.email_verify_success");

  return (
    <div style={{ maxWidth: 460, margin: "48px auto", display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0 }}>{t("auth.email_verify_title")}</h2>

      {status === "loading" ? <div>{t("auth.email_verify_loading")}</div> : null}
      {status === "invalid" ? <div style={{ color: "crimson" }}>{t("auth.email_verify_invalid_link")}</div> : null}
      {(status === "success" || status === "already") ? (
        <div style={{ color: "#065f46" }}>{successLine}</div>
      ) : null}
      {status === "error" ? (
        <div style={{ color: "crimson" }}>{detail || t("auth.email_verify_failed")}</div>
      ) : null}

      {detail && (status === "success" || status === "already") ? (
        <div style={{ fontSize: 13, opacity: 0.8 }}>{detail}</div>
      ) : null}

      <Link to="/login" style={linkStyle}>
        {t("auth.back_to_login")}
      </Link>
    </div>
  );
}

const linkStyle: React.CSSProperties = {
  color: "#0a58ca",
  textDecoration: "underline",
  fontSize: 14,
};
