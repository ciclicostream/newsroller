import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ListVideo,
  FilePlus2,
  LayoutTemplate,
  Video,
  Radio,
  Youtube,
  Tv,
  Images,
  BarChart3,
  Users as UsersIcon,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { TIPOS } from "../lib/tipos";
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
  { to: "/shorts", label: "Shorts", icon: <Youtube size={18} /> },
  { to: "/programas", label: "Programas", icon: <Tv size={18} /> },
  { to: "/banco", label: "Banco", icon: <Images size={18} /> },
  { to: "/reportes", label: "Reportes", icon: <BarChart3 size={18} /> },
  { to: "/usuarios", label: "Usuarios", icon: <UsersIcon size={18} />, adminOnly: true },
];

export function Layout({ children }: { children: ReactNode }) {
  const { me, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = me?.role === "admin";
  const [open, setOpen] = useState(false);
  const ddRef = useRef<HTMLDivElement>(null);

  // Cerrar el submenú al navegar o al hacer click afuera.
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function handleLogout() {
    await signOut();
    navigate("/login");
  }

  const initial = (me?.email ?? "?").charAt(0).toUpperCase();
  const contenidoActive = location.pathname.startsWith("/contenido");

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

          {/* Nuevo Contenido (submenú) */}
          <div className={"nav-dd" + (open ? " open" : "")} ref={ddRef}>
            <button
              type="button"
              className={"nav-item" + (contenidoActive ? " active" : "")}
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <FilePlus2 size={18} /><span className="nav-lbl">Contenido <ChevronDown size={12} className="dd-caret" /></span>
            </button>
            {open && (
              <div className="nav-menu" role="menu">
                {TIPOS.map((t) => (
                  <NavLink key={t.type} to={`/contenido/${t.type}`} className="nav-menu-item" role="menuitem">
                    <t.Icon size={17} />
                    <span>{t.label}</span>
                    {!t.ready && <span className="tipo-soon">pronto</span>}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

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
