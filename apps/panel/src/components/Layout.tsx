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
import { ROLE_LABEL, type Perm } from "@newsroller/shared";
import { useAuth } from "../auth/AuthProvider";
import { IdleGuard } from "./IdleGuard";
import ciclicoBlack from "../assets/ciclico-black.png";

interface NavDef {
  to: string;
  label: string;
  icon: ReactNode;
  perm: Perm;
}

const NAV: NavDef[] = [
  { to: "/", label: "Programación", icon: <ListVideo size={18} />, perm: "programar" },
  { to: "/plantillas", label: "Plantillas", icon: <LayoutTemplate size={18} />, perm: "plantillas_ver" },
  { to: "/camaras", label: "Cámaras", icon: <Video size={18} />, perm: "camaras" },
  { to: "/fuentes", label: "Fuentes", icon: <Radio size={18} />, perm: "fuentes" },
  { to: "/reportes", label: "Reportes", icon: <BarChart3 size={18} />, perm: "reportes" },
  { to: "/ajustes", label: "Ajustes", icon: <Settings size={18} />, perm: "ajustes" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { me, signOut, can: canDo } = useAuth();
  const navigate = useNavigate();

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
          {canDo("programar") && (
            <NavLink to="/" end className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
              <ListVideo size={18} /> Programación
            </NavLink>
          )}

          {/* Contenido: link directo (el submenú de plantillas vive en la página). */}
          {canDo("contenidos") && (
            <NavLink to="/contenido" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
              <FilePlus2 size={18} /> Contenido
            </NavLink>
          )}

          {/* Resto: sólo lo que el rol puede ver */}
          {NAV.slice(1).filter((n) => canDo(n.perm)).map((n) => (
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
          <span className={"role-pill " + (me?.role ?? "generador")}>{me ? ROLE_LABEL[me.role] : ""}</span>
          <div className="avatar" title={me?.email ?? ""}>{initial}</div>
          <button className="logout" onClick={handleLogout} title="Cerrar sesión">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="main">{children}</main>
      {me && <IdleGuard minutes={me.idleMinutes} onIdle={() => { void signOut("idle").then(() => navigate("/login")); }} />}
    </div>
  );
}
