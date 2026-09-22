import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ROLES, ROLE_LABEL, IDLE_MINUTES_DEFAULT, type Role } from "@newsroller/shared";
import { Users as UsersIcon, Youtube, Tv, Images, Rss, CloudSun, Clapperboard, History, Music } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { settingsApi } from "../lib/settings";

export function Ajustes() {
  const { can } = useAuth();

  // Tiempos de inactividad por rol (sólo el Master los cambia).
  const [idle, setIdle] = useState<Record<Role, number> | null>(null);
  const [idleSaved, setIdleSaved] = useState<string>("");
  useEffect(() => {
    if (!can("config_sistema")) return;
    settingsApi.get().then((s) => { const v = { ...IDLE_MINUTES_DEFAULT, ...(s.idleMinutes ?? {}) } as Record<Role, number>; setIdle(v); setIdleSaved(JSON.stringify(v)); }).catch(() => {});
  }, [can]);
  async function guardarIdle() {
    if (!idle) return;
    try { const s = await settingsApi.update({ idleMinutes: idle }); const v = { ...IDLE_MINUTES_DEFAULT, ...(s.idleMinutes ?? {}) } as Record<Role, number>; setIdle(v); setIdleSaved(JSON.stringify(v)); }
    catch (e) { setErr((e as Error).message); }
  }
  const isAdmin = can("perfiles");

  // Velocidad del newsticker (segundos por vuelta; mayor = más lento).
  const [speed, setSpeed] = useState<number | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    settingsApi
      .get()
      .then((s) => { setSpeed(s.tickerSpeed); setSaved(s.tickerSpeed); })
      .catch((e) => setErr(e.message));
  }, []);

  const dirty = speed != null && speed !== saved;
  async function guardar() {
    if (speed == null || !dirty) return;
    setSaving(true);
    setErr(null);
    try {
      const s = await settingsApi.update({ tickerSpeed: speed });
      setSaved(s.tickerSpeed);
      setSpeed(s.tickerSpeed);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

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
        <Link to="/ajustes/clima" className="tipo-card">
          <span className="tipo-ic"><CloudSun size={22} /></span>
          <span className="tipo-main">
            <span className="tipo-name">Íconos del clima</span>
            <span className="tipo-desc">Imágenes grandes según el cielo</span>
          </span>
        </Link>
        {can("reportes") && (
          <Link to="/ajustes/actividad" className="tipo-card">
            <span className="tipo-ic"><History size={22} /></span>
            <span className="tipo-main">
              <span className="tipo-name">Actividad</span>
              <span className="tipo-desc">Quién hizo qué y cuándo</span>
            </span>
          </Link>
        )}
        <Link to="/ajustes/musica" className="tipo-card">
          <span className="tipo-ic"><Music size={22} /></span>
          <span className="tipo-main">
            <span className="tipo-name">Música</span>
            <span className="tipo-desc">Temas para el canal de fondo</span>
          </span>
        </Link>
        <Link to="/ajustes/plataformas" className="tipo-card">
          <span className="tipo-ic"><Clapperboard size={22} /></span>
          <span className="tipo-main">
            <span className="tipo-name">Plataformas</span>
            <span className="tipo-desc">Logos de streaming para series</span>
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

      <div className="card" style={{ padding: 20, marginTop: 18, maxWidth: 560 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
          <Rss size={18} />
          <h2 style={{ fontSize: 16, margin: 0 }}>Newsticker</h2>
        </div>
        <p className="muted-note" style={{ marginTop: 0 }}>
          Velocidad del texto que corre en el zócalo del aire. Aplica a todas las placas.
        </p>

        {err && <div className="alert error">{err}</div>}

        {speed == null ? (
          <div className="muted-note">Cargando…</div>
        ) : (
          <>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Velocidad — ≈{speed}s por vuelta</label>
              <input
                type="range"
                min={20}
                max={240}
                step={5}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                <span>Más rápido</span>
                <span>Más lento</span>
              </div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={guardar} disabled={!dirty || saving}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
              {!dirty && saved != null && <span className="muted-note">Guardado.</span>}
            </div>
          </>
        )}
      </div>

      {idle && (
        <div className="card" style={{ padding: 20, marginTop: 18, maxWidth: 560 }}>
          <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Cierre de sesión por inactividad</h2>
          <p className="muted-note" style={{ marginTop: 0 }}>Minutos sin actividad tras los cuales se cierra la sesión de cada rol. El aire no se ve afectado.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {ROLES.map((r) => (
              <div className="field" key={r} style={{ marginBottom: 0 }}>
                <label>{ROLE_LABEL[r]}</label>
                <input type="number" min={1} max={480} value={idle[r]} onChange={(e) => setIdle({ ...idle, [r]: Math.max(1, Math.min(480, Number(e.target.value) || 1)) })} />
              </div>
            ))}
          </div>
          <button className="btn primary" style={{ marginTop: 14 }} disabled={JSON.stringify(idle) === idleSaved} onClick={guardarIdle}>Guardar</button>
        </div>
      )}
    </>
  );
}
