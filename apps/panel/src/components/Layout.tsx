import { Link, NavLink, useNavigate } from "react-router-dom";
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
  ListMusic,
} from "lucide-react";
import { ROLE_LABEL, type Perm } from "@newsroller/shared";
import { useAuth } from "../auth/AuthProvider";
import { IdleGuard } from "./IdleGuard";
import { Avatar } from "./Avatar";
import { PresenceStrip } from "./PresenceStrip";
import { Toaster } from "./Toaster";
import ciclicoBlack from "../assets/ciclico-black.png";

interface NavDef {
  to: string;
  label: string;
  icon: ReactNode;
  perm: Perm;
}

// Orden simétrico alrededor de Emisión (que se dibuja aparte, al centro y en rojo):
// izquierda Contenido/Sesiones/Fuentes, derecha Plantillas/Cámaras/Reportes, y Ajustes
// separado por una rayita porque no es parte de la simetría.
const NAV_LEFT: NavDef[] = [
  { to: "/contenido", label: "Contenido", icon: <FilePlus2 size={18} />, perm: "contenidos" },
  { to: "/sesiones", label: "Sesiones", icon: <ListMusic size={18} />, perm: "sesiones" },
  { to: "/fuentes", label: "Fuentes", icon: <Radio size={18} />, perm: "fuentes" },
];
const NAV_RIGHT: NavDef[] = [
  { to: "/plantillas", label: "Plantillas", icon: <LayoutTemplate size={18} />, perm: "plantillas_ver" },
  { to: "/camaras", label: "Cámaras", icon: <Video size={18} />, perm: "camaras" },
  { to: "/reportes", label: "Reportes", icon: <BarChart3 size={18} />, perm: "reportes" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { me, signOut, can: canDo } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src={ciclicoBlack} alt="Cíclico" />
          <span className="brand-txt"><b>Cíclico Stream</b><small>NewsRoller</small></span>
        </div>

        <nav className="topnav">
          {NAV_LEFT.filter((n) => canDo(n.perm)).map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
              {n.icon}
              {n.label}
            </NavLink>
          ))}

          {/* Emisión (antes "Programación"): al centro, destacada en rojo — es el aire en vivo. */}
          {canDo("programar") && (
            <NavLink to="/" end className={({ isActive }) => "nav-item nav-emision" + (isActive ? " active" : "")}>
              <ListVideo size={18} /> Emisión
            </NavLink>
          )}

          {NAV_RIGHT.filter((n) => canDo(n.perm)).map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
              {n.icon}
              {n.label}
            </NavLink>
          ))}

          {canDo("ajustes") && <span className="nav-sep" aria-hidden="true" />}
          {canDo("ajustes") && (
            <NavLink to="/ajustes" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
              <Settings size={18} /> Ajustes
            </NavLink>
          )}
        </nav>

        <div className="topbar-right">
          <span className={"role-pill " + (me?.role ?? "generador")}>{me ? ROLE_LABEL[me.role] : ""}</span>
          <PresenceStrip />
          <Link to="/perfil" className="avatar-link" title="Mi perfil">
            <Avatar url={me?.avatar_url} name={me?.full_name} email={me?.email} size={32} />
          </Link>
          <button className="logout" onClick={handleLogout} title="Cerrar sesión">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="main">{children}</main>
      <Toaster />
      {me && <IdleGuard minutes={me.idleMinutes} onIdle={() => { void signOut("idle").then(() => navigate("/login")); }} />}
    </div>
  );
}
