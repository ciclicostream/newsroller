import { NavLink, useNavigate } from "react-router-dom";
import { type ReactNode } from "react";
import {
  ListVideo,
  FilePlus2,
  LayoutTemplate,
  Video,
  Radio,
  BarChart3,
  Settings,
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
  { to: "/", label: "Programación", icon: <ListVideo size={18} /> },
  { to: "/plantillas", label: "Plantillas", icon: <LayoutTemplate size={18} /> },
  { to: "/camaras", label: "Cámaras", icon: <Video size={18} /> },
  { to: "/fuentes", label: "Fuentes", icon: <Radio size={18} /> },
  { to: "/reportes", label: "Reportes", icon: <BarChart3 size={18} /> },
  { to: "/ajustes", label: "Ajustes", icon: <Settings size={18} /> },
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
          {/* Programación */}
          <NavLink to="/" end className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <ListVideo size={18} /> Programación
          </NavLink>

          {/* Contenido: link directo (el submenú de plantillas vive en la página). */}
          <NavLink to="/contenido" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
            <FilePlus2 size={18} /> Contenido
          </NavLink>

          {/* Resto */}
          {NAV.slice(1).filter((n) => !n.adminOnly || isAdmin).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
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
