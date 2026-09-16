import { Link } from "react-router-dom";
import { Users as UsersIcon, Youtube, Tv, Images, Construction } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";

export function Ajustes() {
  const { me } = useAuth();
  const isAdmin = me?.role === "admin";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ajustes</h1>
          <p>Configuración del sistema y accesos.</p>
        </div>
      </div>

      <div className="tipo-grid">
        {isAdmin && (
          <Link to="/usuarios" className="tipo-card">
            <span className="tipo-ic"><UsersIcon size={22} /></span>
            <span className="tipo-main">
              <span className="tipo-name">Usuarios</span>
              <span className="tipo-desc">Altas, roles y accesos al panel</span>
            </span>
          </Link>
        )}
        <Link to="/banco" className="tipo-card">
          <span className="tipo-ic"><Images size={22} /></span>
          <span className="tipo-main">
            <span className="tipo-name">Banco</span>
            <span className="tipo-desc">Fondos, fotos, videos y logos</span>
          </span>
        </Link>
        <Link to="/shorts" className="tipo-card">
          <span className="tipo-ic"><Youtube size={22} /></span>
          <span className="tipo-main">
            <span className="tipo-name">Shorts</span>
            <span className="tipo-desc">Sincronizar shorts de YouTube</span>
          </span>
        </Link>
        <Link to="/programas" className="tipo-card">
          <span className="tipo-ic"><Tv size={22} /></span>
          <span className="tipo-main">
            <span className="tipo-name">Programas</span>
            <span className="tipo-desc">Búsqueda por hashtags</span>
          </span>
        </Link>
      </div>

      <div className="card" style={{ padding: 18, marginTop: 18 }}>
        <div className="muted-note" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Construction size={16} /> Preferencias del sistema (marca, salida, integraciones) — próximamente.
        </div>
      </div>
    </>
  );
}
