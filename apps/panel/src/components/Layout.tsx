import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { type ReactNode } from "react";
import {
  ListVideo,
  FilePlus2,
  LayoutTemplate,
  Radio,
  BarChart3,
  Settings,
  LogOut,
  ListMusic,
  AudioLines,
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
  cls?: string;
}

// Al centro, agrupados en una card gris, Copiloto y Stream (lo que va al aire); a la izquierda
// Contenido/Sesiones/Fuentes, a la derecha Plantillas/Reportes, y Ajustes separado por una rayita.
// Cámaras vive dentro de Ajustes.
const NAV_LEFT: NavDef[] = [
  { to: "/contenido", label: "Contenido", icon: <FilePlus2 size={18} />, perm: "contenidos" },
  { to: "/sesiones", label: "Sesiones", icon: <ListMusic size={18} />, perm: "sesiones" },
  { to: "/fuentes", label: "Fuentes", icon: <Radio size={18} />, perm: "fuentes" },
];
const NAV_RIGHT: NavDef[] = [
  { to: "/plantillas", label: "Plantillas", icon: <LayoutTemplate size={18} />, perm: "plantillas_ver" },
  { to: "/reportes", label: "Reportes", icon: <BarChart3 size={18} />, perm: "reportes" },
];

// Secciones que usan el ancho de Contenido (card de encabezado + contenido a 924px, centrado).
// El editor de una sesión (/sesiones/:id) queda fuera: es una consola a todo el ancho, como Copiloto.
const SECTION_ROOTS = ["/sesiones", "/fuentes", "/plantillas", "/reportes", "/ajustes", "/usuarios", "/banco", "/shorts", "/programas"];
const isSection = (path: string) =>
  path === "/sesiones" || SECTION_ROOTS.some((r) => r !== "/sesiones" && (path === r || path.startsWith(r + "/")));

export function Layout({ children }: { children: ReactNode }) {
  const { me, signOut, can: canDo } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

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

          {/* Copiloto (antes "Emisión") y Stream: al centro, agrupados en una card gris. */}
          {(canDo("programar") || canDo("stream")) && (
            <span className="nav-group">
              {canDo("programar") && (
                <NavLink to="/" end className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
                  <ListVideo size={18} /> Copiloto
                </NavLink>
              )}
              {canDo("stream") && (
                <NavLink to="/stream" className={({ isActive }) => "nav-item nav-stream" + (isActive ? " active" : "")}>
                  <AudioLines size={18} /> Stream
                </NavLink>
              )}
            </span>
          )}

          {NAV_RIGHT.filter((n) => canDo(n.perm)).map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => "nav-item" + (n.cls ? " " + n.cls : "") + (isActive ? " active" : "")}>
              {n.icon}
              {n.label}
            </NavLink>
          ))}

          {canDo("ajustes_medios") && <span className="nav-sep" aria-hidden="true" />}
          {canDo("ajustes_medios") && (
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

      <main className={"main" + (isSection(pathname) ? " sec" : "")}>{children}</main>
      <Toaster />
      {me && <IdleGuard minutes={me.idleMinutes} onIdle={() => { void signOut("idle").then(() => navigate("/login")); }} />}
    </div>
  );
}
