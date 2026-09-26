import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Loader2, Link2Off, RectangleHorizontal, RectangleVertical, Volume2, VolumeX, ExternalLink } from "lucide-react";
import { DEFAULT_COLLECTION, TEMPLATE_COLLECTIONS, collectionById, type OutputLink } from "@newsroller/shared";
import { useAuth } from "../auth/AuthProvider";
import { settingsApi } from "../lib/settings";
import { outputLinkUrl, outputLinksApi } from "../lib/outputLinks";
import { sessions as sessionsApi } from "../lib/sessions";

// Ajustes → Suites.
//  - Colecciones (Master): qué colecciones de templates se pueden usar. La primera es la que reciben las suites nuevas.
//  - Suites (Administrador y Master): cada link con nombre es una suite; acá se le cambia la colección sin tocar la URL.
//    El cambio entra en el próximo contenido de todos los outputs que usan esa suite, también el Stream.
//  - Links viejos con variables: se apagan cuando todos los OBS/vMix usan suites.
const TARGET_LABEL = { emision: "Emisión", sesion: "Sesión", stream: "Stream" } as const;

export function AjustesSuites() {
  const { can } = useAuth();
  const isMaster = can("config_sistema");
  const [enabled, setEnabled] = useState<string[] | null>(null);
  const [legacy, setLegacy] = useState(true);
  const [suites, setSuites] = useState<OutputLink[] | null>(null);
  const [sessionName, setSessionName] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadSuites = () => outputLinksApi.list().then(setSuites).catch((e) => { setSuites([]); setErr(e.message); });
  useEffect(() => {
    settingsApi.get().then((s) => { setEnabled(s.collections?.length ? s.collections : [DEFAULT_COLLECTION]); setLegacy(s.legacyLinks !== false); }).catch((e) => setErr(e.message));
    void loadSuites();
    sessionsApi.list().then((rows) => setSessionName(Object.fromEntries(rows.map((r) => [r.id, r.name])))).catch(() => {});
  }, []);

  async function run(key: string, fn: () => Promise<void>, ok?: string) {
    setBusy(key); setErr(null); setMsg(null);
    try { await fn(); if (ok) setMsg(ok); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }

  const toggleCollection = (id: string) => run("col:" + id, async () => {
    const cur = enabled ?? [DEFAULT_COLLECTION];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    if (!next.length) throw new Error("Tiene que quedar al menos una colección habilitada.");
    const s = await settingsApi.update({ collections: next });
    setEnabled(s.collections ?? next);
  });
  const makeDefault = (id: string) => run("col:" + id, async () => {
    const cur = (enabled ?? [DEFAULT_COLLECTION]).filter((x) => x !== id);
    const s = await settingsApi.update({ collections: [id, ...cur] });
    setEnabled(s.collections ?? [id, ...cur]);
  });
  const setSuiteCollection = (l: OutputLink, id: string) => run(l.slug, async () => { await outputLinksApi.update(l.slug, { style: id }); await loadSuites(); },
    `La suite ${l.slug} pasa a ${collectionById(id)?.label ?? id}: entra en el próximo contenido.`);
  const toggleLegacy = () => {
    const next = !legacy;
    if (!next && !confirm("Los links viejos (/output/?…) van a dejar de emitir. ¿Ya pasaste todos los OBS/vMix a suites?")) return;
    void run("legacy", async () => { const s = await settingsApi.update({ legacyLinks: next }); setLegacy(s.legacyLinks !== false); }, next ? "Los links viejos vuelven a funcionar." : "Los links viejos ya no emiten.");
  };

  const en = enabled ?? [DEFAULT_COLLECTION];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Suites</h1>
          <p>Cada link de salida es una suite: tiene su nombre, qué emite, orientación, audio y colección de templates. Cambiar la colección de una suite no cambia su link, y entra en el próximo contenido de todos los outputs que la usan, también el Stream.</p>
        </div>
        <Link to="/ajustes" className="btn"><ArrowLeft size={16} /> Ajustes</Link>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <h3 style={{ margin: "6px 0 10px" }}>Colecciones habilitadas</h3>
      <p className="muted-note" style={{ marginTop: 0 }}>{isMaster ? "Elegí qué colecciones se pueden usar en las suites. La marcada como \"por defecto\" es la que reciben las suites nuevas." : "Las habilita el Master."}</p>
      <div className="card" style={{ padding: 6 }}>
        {TEMPLATE_COLLECTIONS.map((c) => {
          const on = en.includes(c.id);
          return (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", opacity: c.ready ? 1 : 0.55 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{c.label}{en[0] === c.id ? <span style={{ fontSize: 12, color: "#2f6bff", marginLeft: 8 }}>por defecto</span> : null}{!c.ready ? <span style={{ fontSize: 12, color: "#6b7688", marginLeft: 8 }}>en preparación</span> : null}</div>
                <div style={{ fontSize: 13, color: "#6b7688" }}>{c.desc}</div>
              </div>
              {isMaster && on && en[0] !== c.id && <button type="button" className="btn" disabled={busy != null} onClick={() => void makeDefault(c.id)}>Por defecto</button>}
              {isMaster
                ? <button type="button" className={"toggle-pill" + (on ? " on" : "")} disabled={!c.ready || busy != null} onClick={() => void toggleCollection(c.id)}>
                    {busy === "col:" + c.id ? <Loader2 size={14} className="spin" /> : on ? <Check size={14} /> : null} {on ? "Habilitada" : "No habilitada"}
                  </button>
                : <span style={{ fontSize: 13, color: on ? "#1a2235" : "#6b7688" }}>{on ? "Habilitada" : "No habilitada"}</span>}
            </div>
          );
        })}
      </div>

      <h3 style={{ margin: "22px 0 10px" }}>Suites</h3>
      <div className="card" style={{ padding: 6 }}>
        {suites == null && <div style={{ padding: 12, color: "#6b7688" }}><Loader2 size={14} className="spin" /> Cargando…</div>}
        {suites && suites.length === 0 && <div style={{ padding: 12, color: "#6b7688" }}>Todavía no hay suites. Se crean desde el Generador de links (debajo del monitor en Emisión, en cada Sesión y en Stream).</div>}
        {suites?.map((l) => (
          <div key={l.slug} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderTop: "1px solid #eef1f6" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13 }}>{l.slug}</div>
              <div style={{ fontSize: 12, color: "#6b7688", display: "flex", alignItems: "center", gap: 8 }}>
                <span>{TARGET_LABEL[l.target]}{l.target === "sesion" && l.session_id ? ` · ${sessionName[l.session_id] ?? "sesión"}` : ""}</span>
                {l.orientation === "vertical" ? <RectangleVertical size={13} /> : <RectangleHorizontal size={13} />}
                {l.audio ? <Volume2 size={13} /> : <VolumeX size={13} />}
              </div>
            </div>
            <select value={l.style} disabled={busy != null} onChange={(e) => void setSuiteCollection(l, e.target.value)} style={{ height: 32, borderRadius: 8, border: "1px solid #e3e7ef", padding: "0 8px" }} aria-label={`Colección de ${l.slug}`}>
              {!en.includes(l.style) && <option value={l.style}>{collectionById(l.style)?.label ?? l.style} (no habilitada)</option>}
              {en.map((id) => <option key={id} value={id}>{collectionById(id)?.label ?? id}</option>)}
            </select>
            <a className="btn" href={outputLinkUrl(l.slug)} target="_blank" rel="noreferrer" title="Abrir"><ExternalLink size={15} /></a>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 18, marginTop: 18, display: "flex", alignItems: "center", gap: 14 }}>
        <Link2Off size={20} style={{ flex: "none", color: "#6b7688" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>Links viejos con variables</div>
          <div style={{ fontSize: 13, color: "#6b7688", marginTop: 2 }}>
            {legacy ? "Siguen funcionando (/output/?orientation=…). Apagalos cuando todos los OBS/vMix usen suites." : "Apagados: sólo emiten las suites. Los monitores del panel no se ven afectados."}
          </div>
        </div>
        <button type="button" className={"toggle-pill" + (legacy ? " on" : "")} disabled={busy != null} onClick={toggleLegacy}>
          {busy === "legacy" ? <Loader2 size={14} className="spin" /> : legacy ? <Check size={14} /> : null} {legacy ? "Funcionan" : "Apagados"}
        </button>
      </div>
    </>
  );
}
