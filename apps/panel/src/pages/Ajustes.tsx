import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ROLES, ROLE_LABEL, IDLE_MINUTES_DEFAULT, MUSIC_DEFAULT, DEFAULT_COLLECTION, TEMPLATE_COLLECTIONS, activeSuiteOf,
  type Camera, type MusicSettings, type Plataforma, type Role, type Short,
} from "@newsroller/shared";
import { Users as UsersIcon, Youtube, Tv, Images, Rss, CloudSun, Clapperboard, History, Music, Palette, Video, Timer, ChevronRight, Hash } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { settingsApi, type AppSettings } from "../lib/settings";
import { camerasApi } from "../lib/cameras";
import { content } from "../lib/content";
import { banco, fmtSize, type BancoList } from "../lib/banco";
import { api } from "../lib/api";

interface Activity { id: string; at: string; actor_name: string | null; summary: string | null; action: string }
const hhmm = (iso: string) => new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Card del masonry: encabezado (lleva a la sección si tiene `to`) + un resumen o control a la vista.
function AjCard({ to, icon, name, desc, children }: { to?: string; icon: ReactNode; name: string; desc: string; children?: ReactNode }) {
  const head = (
    <>
      <span className="tipo-ic">{icon}</span>
      <span className="tipo-main" style={{ flex: 1 }}>
        <span className="tipo-name">{name}</span>
        <span className="tipo-desc">{desc}</span>
      </span>
      {to && <ChevronRight size={18} className="aj-go" />}
    </>
  );
  return (
    <section className="card aj-card">
      {to ? <Link to={to} className="aj-hd">{head}</Link> : <div className="aj-hd">{head}</div>}
      {children != null && <div className="aj-body">{children}</div>}
    </section>
  );
}

// Ajustes: las secciones en masonry. Cada card muestra lo importante (o el control) sin tener que entrar.
export function Ajustes() {
  const { can } = useAuth();
  const isAdmin = can("perfiles");
  const isMaster = can("config_sistema");
  const [err, setErr] = useState<string | null>(null);

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [cams, setCams] = useState<Camera[] | null>(null);
  const [shorts, setShorts] = useState<Short[] | null>(null);
  const [bank, setBank] = useState<BancoList | null>(null);
  const [users, setUsers] = useState<{ id: string; active?: boolean }[] | null>(null);
  const [online, setOnline] = useState<number | null>(null);
  const [acts, setActs] = useState<Activity[] | null>(null);

  // Newsticker e inactividad: se editan acá mismo.
  const [speed, setSpeed] = useState<number | null>(null);
  const [idle, setIdle] = useState<Record<Role, number> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const applySettings = (s: AppSettings) => {
    setSettings(s);
    setSpeed(s.tickerSpeed);
    setIdle({ ...IDLE_MINUTES_DEFAULT, ...(s.idleMinutes ?? {}) } as Record<Role, number>);
  };

  useEffect(() => {
    settingsApi.get().then(applySettings).catch((e) => setErr(e.message));
    content.listShorts().then(setShorts).catch(() => {});
    api.get<{ id: string }[]>("/api/presence").then((l) => setOnline(l.length)).catch(() => {});
    if (can("camaras")) camerasApi.list().then(setCams).catch(() => {});
    if (can("ajustes")) banco.list().then(setBank).catch(() => {});
    if (isAdmin) api.get<{ id: string; active?: boolean }[]>("/api/users").then(setUsers).catch(() => {});
    if (can("reportes")) api.get<{ rows: Activity[] }>("/api/activity?limit=3").then((r) => setActs(r.rows ?? [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function update(key: string, patch: Partial<AppSettings>) {
    setBusy(key);
    setErr(null);
    try { applySettings(await settingsApi.update(patch)); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  }

  // Colecciones que el Master habilitó (más la activa, por si quedó una deshabilitada).
  const enabledCollections = TEMPLATE_COLLECTIONS.filter((c) => c.ready && ((settings?.collections ?? [DEFAULT_COLLECTION]).includes(c.id) || c.id === activeSuiteOf(settings ?? {}).style));
  const activeSuite = settings ? activeSuiteOf(settings) : null;
  const music: MusicSettings = settings?.music ?? MUSIC_DEFAULT;
  const plataformas = (settings?.plataformas ?? []) as Plataforma[];
  const climaCount = settings ? Object.values(settings.climaIcons ?? {}).filter(Boolean).length + Object.values(settings.climaDayIcons ?? {}).filter(Boolean).length : null;
  const idleDirty = !!settings && !!idle && JSON.stringify(idle) !== JSON.stringify({ ...IDLE_MINUTES_DEFAULT, ...(settings.idleMinutes ?? {}) });
  const liveCam = cams?.find((c) => c.active);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ajustes</h1>
          <p>Configuración del sistema y accesos.</p>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}

      <div className="aj-masonry">
        {can("ajustes") && (
          <AjCard icon={<Rss size={22} />} name="Newsticker" desc="Velocidad del texto del zócalo, en todas las placas">
            {speed == null ? <span className="muted-note">Cargando…</span> : (
              <>
                <div className="aj-kv"><span>≈{speed}s por vuelta</span><span className="muted-note">{speed < 60 ? "rápido" : speed > 150 ? "lento" : "medio"}</span></div>
                <input type="range" min={20} max={240} step={5} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} style={{ width: "100%" }} />
                <div className="aj-scale"><span>Más rápido</span><span>Más lento</span></div>
                {speed !== settings?.tickerSpeed && (
                  <button className="btn primary aj-save" disabled={busy === "ticker"} onClick={() => update("ticker", { tickerSpeed: speed })}>
                    {busy === "ticker" ? "Guardando…" : "Guardar"}
                  </button>
                )}
              </>
            )}
          </AjCard>
        )}

        {isAdmin && (
          <AjCard to="/ajustes/suites" icon={<Palette size={22} />} name="Colección" desc="Diseño del canal (Copiloto y Stream) y links para OBS/vMix">
            {activeSuite && (
              <>
                <label className="aj-lbl">Colección activa</label>
                <select value={activeSuite.style} disabled={busy === "suite"} onChange={(e) => {
                  const style = e.target.value;
                  const label = TEMPLATE_COLLECTIONS.find((c) => c.id === style)?.label ?? style;
                  if (confirm(`¿Pasar el canal a la colección ${label}? Cambia en Copiloto y en Stream desde el próximo contenido.`))
                    void update("suite", { suites: [{ ...activeSuite, style }], activeSuite: activeSuite.id });
                }}>
                  {enabledCollections.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </>
            )}
          </AjCard>
        )}

        {can("camaras") && (
          <AjCard to="/ajustes/camaras" icon={<Video size={22} />} name="Cámaras" desc="Cámaras en vivo (YouTube o HLS)">
            {cams == null ? <span className="muted-note">Cargando…</span> : (
              <>
                <div className="aj-stats"><span><b>{cams.length}</b> cargada{cams.length === 1 ? "" : "s"}</span></div>
                <div className="aj-kv"><span>Al aire</span><b className={liveCam ? "aj-live" : ""}>{liveCam ? liveCam.name : "ninguna"}</b></div>
              </>
            )}
          </AjCard>
        )}

        {isAdmin && (
          <AjCard to="/usuarios" icon={<UsersIcon size={22} />} name="Usuarios" desc="Altas, roles y accesos al panel">
            <div className="aj-stats">
              <span><b>{users?.length ?? "…"}</b> usuarios</span>
              {users && <span><b>{users.filter((u) => u.active !== false).length}</b> activos</span>}
              {online != null && <span className="on"><i className="live-dot" /><b>{online}</b> conectados</span>}
            </div>
          </AjCard>
        )}

        <AjCard to="/ajustes/musica" icon={<Music size={22} />} name="Música" desc="Temas para el canal de fondo">
          {!settings ? <span className="muted-note">Cargando…</span> : music.tracks.length === 0 ? (
            <span className="muted-note">Todavía no hay temas cargados.</span>
          ) : (
            <>
              <label className="aj-lbl">Tema activo · {music.enabled ? "canal encendido" : "canal apagado"}</label>
              <select value={music.activeId ?? ""} disabled={busy === "music"} onChange={(e) => {
                  const next = music.tracks.find((t) => t.id === e.target.value);
                  if (next && confirm(`¿Poner "${next.name}" como tema activo de la música de fondo?`)) void update("music", { music: { ...music, activeId: next.id } });
                }}>
                {!music.activeId && <option value="">Sin elegir</option>}
                {music.tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </>
          )}
        </AjCard>

        <AjCard to="/shorts" icon={<Youtube size={22} />} name="Shorts" desc="Sincronizar shorts de YouTube">
          {shorts && (
            <div className="aj-stats">
              <span><b>{shorts.filter((s) => s.active).length}</b> rotando</span>
              <span><b>{shorts.length}</b> sincronizados</span>
            </div>
          )}
        </AjCard>

        {can("ajustes") && (
          <AjCard to="/banco" icon={<Images size={22} />} name="Banco" desc="Fondos, fotos, videos y logos">
            {bank && (
              <div className="aj-stats">
                <span><b>{bank.items.length}</b> archivos</span>
                <span><b>{fmtSize(bank.items.reduce((a, i) => a + (i.size ?? 0), 0))}</b></span>
                {bank.trash_count > 0 && <span><b>{bank.trash_count}</b> en papelera</span>}
              </div>
            )}
          </AjCard>
        )}

        {can("ajustes") && (
          <AjCard to="/ajustes/clima" icon={<CloudSun size={22} />} name="Íconos del clima" desc="Imágenes grandes según el cielo">
            {climaCount != null && (
              <div className="aj-stats"><span><b>{climaCount}</b> ícono{climaCount === 1 ? "" : "s"} propio{climaCount === 1 ? "" : "s"}</span><span>el resto, predeterminados</span></div>
            )}
          </AjCard>
        )}

        {can("ajustes") && (
          <AjCard to="/ajustes/plataformas" icon={<Clapperboard size={22} />} name="Plataformas" desc="Logos de streaming para series">
            {settings && (
              plataformas.length === 0 ? <span className="muted-note">Sin plataformas cargadas.</span> : (
                <div className="aj-logos">
                  {plataformas.map((p) => (
                    <span key={p.id} className="aj-logo" title={p.name}>{p.logo ? <img src={p.logo} alt={p.name} /> : p.name}</span>
                  ))}
                </div>
              )
            )}
          </AjCard>
        )}

        {can("reportes") && (
          <AjCard to="/ajustes/actividad" icon={<History size={22} />} name="Actividad" desc="Quién hizo qué y cuándo">
            {acts && (acts.length === 0 ? <span className="muted-note">Sin registros todavía.</span> : (
              <ul className="aj-acts">
                {acts.map((a) => (
                  <li key={a.id}>
                    <span className="aj-act-txt">{a.summary ?? a.action}</span>
                    <span className="muted-note">{a.actor_name ?? "Sistema"} · {hhmm(a.at)}</span>
                  </li>
                ))}
              </ul>
            ))}
          </AjCard>
        )}

        <AjCard to="/programas" icon={<Tv size={22} />} name="Programas" desc="Búsqueda por hashtags">
          <div className="aj-stats"><span><Hash size={12} />ciclico</span><span><Hash size={12} />programa</span><span className="muted-note">en construcción</span></div>
        </AjCard>

        {isMaster && idle && (
          <AjCard icon={<Timer size={22} />} name="Cierre por inactividad" desc="Minutos sin actividad por rol. El aire no se ve afectado.">
            <div className="aj-idle">
              {ROLES.map((r) => (
                <label key={r}>
                  <span>{ROLE_LABEL[r]}</span>
                  <input type="number" min={1} max={480} value={idle[r]} onChange={(e) => setIdle({ ...idle, [r]: Math.max(1, Math.min(480, Number(e.target.value) || 1)) })} />
                </label>
              ))}
            </div>
            {idleDirty && (
              <button className="btn primary aj-save" disabled={busy === "idle"} onClick={() => update("idle", { idleMinutes: idle })}>
                {busy === "idle" ? "Guardando…" : "Guardar"}
              </button>
            )}
          </AjCard>
        )}
      </div>
    </>
  );
}
