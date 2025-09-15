import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LogoutButton({ confirm = false }: { confirm?: boolean }) {
  const { logout } = useAuth();
  const nav = useNavigate();

  function handle() {
    if (confirm && !window.confirm("Log out now?")) return;
    logout();            // clears token + user (from AuthContext you already have)
    nav("/login");       // send back to login
  }

  return (
    <button onClick={handle} title="Log out">
      Logout
    </button>
  );
}

