import { NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  FileStack,
  Users as UsersIcon,
  Radio,
  LogOut,
  CircleDot,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";

interface NavDef {
  to: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const NAV: NavDef[] = [
  { to: "/", label: "Panel", icon: <LayoutDashboard size={18} /> },
  { to: "/contenido", label: "Contenido", icon: <FileStack size={18} /> },
  { to: "/fuentes", label: "Fuentes / APIs", icon: <Radio size={18} />, adminOnly: true },
  { to: "/usuarios", label: "Usuarios", icon: <UsersIcon size={18} />, adminOnly: true },
];

export function Layout({ children }: { children: ReactNode }) {
  const { me, signOut } = useAuth();
  const navigate = useNavigate();
  const isAdmin = me?.role === "admin";

  async function handleLogout() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="mark">
            <CircleDot size={16} color="#fff" />
          </span>
          NewsRoller
        </div>
        {NAV.filter((n) => !n.adminOnly || isAdmin).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
          >
            {n.icon}
            {n.label}
          </NavLink>
        ))}
        <div className="spacer" />
        <div className="user-box">
          <div className="email">{me?.email}</div>
          <span className={"role-pill " + (me?.role ?? "editor")}>
            {me?.role === "admin" ? "Administrador" : "Gestor de contenidos"}
          </span>
          <button className="logout" onClick={handleLogout}>
            <LogOut size={15} /> Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
