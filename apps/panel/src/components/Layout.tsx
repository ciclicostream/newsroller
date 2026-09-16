import { NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  FileStack,
  LayoutTemplate,
  ListVideo,
  Siren,
  Video,
  Users as UsersIcon,
  Radio,
  LogOut,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import ciclicoBlack from "../assets/ciclico-black.png";

interface NavDef {
  to: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const NAV: NavDef[] = [
  { to: "/", label: "Panel", icon: <LayoutDashboard size={19} /> },
  { to: "/programacion", label: "Programación", icon: <ListVideo size={19} /> },
  { to: "/contenido", label: "Contenido", icon: <FileStack size={19} /> },
  { to: "/ultima-hora", label: "Última Hora", icon: <Siren size={19} /> },
  { to: "/plantillas", label: "Plantillas", icon: <LayoutTemplate size={19} /> },
  { to: "/camaras", label: "Cámaras", icon: <Video size={19} /> },
  { to: "/fuentes", label: "Fuentes", icon: <Radio size={19} />, adminOnly: true },
  { to: "/usuarios", label: "Usuarios", icon: <UsersIcon size={19} />, adminOnly: true },
];

export function Layout({ children }: { children: ReactNode }) {
  const { me, signOut } = useAuth();
  const navigate = useNavigate();
  const isAdmin = me?.role === "admin";

  async function handleLogout() {
    await signOut();
    navigate("/login");
  }

  const initial = (me?.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src={ciclicoBlack} alt="Cíclico" />
          <span className="brand-txt"><b>Cíclico Stream</b><small>NewsRoller</small></span>
        </div>

        <nav className="topnav">
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
        </nav>

        <div className="topbar-right">
          <span className={"role-pill " + (me?.role ?? "editor")}>
            {me?.role === "admin" ? "Admin" : "Editor"}
          </span>
          <div className="avatar" title={me?.email ?? ""}>{initial}</div>
          <button className="logout" onClick={handleLogout} title="Cerrar sesión">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="main">{children}</main>
    </div>
  );
}
