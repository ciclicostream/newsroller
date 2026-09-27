import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Copy, ExternalLink, Link2Off, Loader2, Plus, RectangleHorizontal, RectangleVertical, RefreshCw, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { DEFAULT_COLLECTION, SUITE_DEFAULT, SUITE_NAME_RE, TEMPLATE_COLLECTIONS, activeSuiteOf, collectionById, type OutputLink, type Suite } from "@newsroller/shared";
import { useAuth } from "../auth/AuthProvider";
import { settingsApi } from "../lib/settings";
import { outputLinkUrl, outputLinksApi } from "../lib/outputLinks";

// Ajustes → Suites (Administrador y Master).
//  - Colecciones: el Master habilita qué colecciones de templates se pueden usar.
//  - Suites: nombre + colección. Siempre hay UNA activa: la salida del canal emite con su colección, y el
//    Programador y el Host ven su nombre. Activar otra suite o cambiarle la colección entra en el próximo contenido.
//  - Links del canal: uno horizontal y uno vertical, fijos. Siempre usan la suite activa; acá sólo se prende o
//    apaga el audio, se les cambia el nombre o se regeneran si se filtran.
const newId = () => Math.random().toString(36).slice(2, 10);

export function AjustesSuites() {
  const { can } = useAuth();
  const isMaster = can("config_sistema");
  const [enabled, setEnabled] = useState<string[]>([DEFAULT_COLLECTION]);
  const [suites, setSuites] = useState<Suite[]>([SUITE_DEFAULT]);
  const [active, setActive] = useState<string>(SUITE_DEFAULT.id);
  const [legacy, setLegacy] = useState(true);
  const [links, setLinks] = useState<OutputLink[] | null>(null);
  const [newName, setNewName] = useState("");
  const [newStyle, setNewStyle] = useState<string>(DEFAULT_COLLECTION);
  const [editSlug, setEditSlug] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [regen, setRegen] = useState<OutputLink | null>(null);

  const apply = (s: { collections?: string[]; suites?: Suite[]; activeSuite?: string; legacyLinks?: boolean }) => {
    setEnabled(s.collections?.length ? s.collections : [DEFAULT_COLLECTION]);
    setSuites(s.suites?.length ? s.suites : [SUITE_DEFAULT]);
    setActive(activeSuiteOf(s).id);
    setLegacy(s.legacyLinks !== false);
  };
  const loadLinks = () => outputLinksApi.list().then(setLinks).catch((e) => { setLinks([]); setErr(/relation|output_links/i.test(e.message) ? "Falta correr la migración 0026 en Supabase." : e.message); });
  useEffect(() => {
    settingsApi.get().then(apply).catch((e) => setErr(e.message));
    void loadLinks();
  }, []);

  async function run(key: string, fn: () => Promise<void>, ok?: string) {
    setBusy(key); setErr(null); setMsg(null);
    try { await fn(); if (ok) setMsg(ok); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }

  // --- Colecciones (Master) ---
  const toggleCollection = (id: string) => run("col:" + id, async () => {
    const next = enabled.includes(id) ? enabled.filter((x) => x !== id) : [...enabled, id];
    if (!next.length) throw new Error("Tiene que quedar al menos una colección habilitada.");
    if (suites.some((s) => s.style === id) && !next.includes(id)) throw new Error("Hay suites que usan esta colección: cambiales la colección antes de deshabilitarla.");
    apply(await settingsApi.update({ collections: next }));
  });

  // --- Suites (Administrador y Master) ---
  const saveSuites = (next: Suite[], ok?: string) => run("suites", async () => { apply(await settingsApi.update({ suites: next })); }, ok);
  const createSuite = () => {
    const name = newName.trim().toLowerCase();
    if (!SUITE_NAME_RE.test(name)) { setErr("El nombre va de 2 a 40 caracteres: minúsculas, números y guiones."); return; }
    if (suites.some((s) => s.name === name)) { setErr("Ya hay una suite con ese nombre."); return; }
    void saveSuites([...suites, { id: newId(), name, style: enabled.includes(newStyle) ? newStyle : enabled[0]! }], `Suite ${name} creada. Activala cuando quieras que salga al aire.`);
    setNewName("");
  };
  const setStyleOf = (s: Suite, style: string) => saveSuites(suites.map((x) => (x.id === s.id ? { ...x, style } : x)),
    s.id === active ? `${s.name} pasa a ${collectionById(style)?.label ?? style}: entra en el próximo contenido.` : `${s.name} pasa a ${collectionById(style)?.label ?? style}.`);
  const removeSuite = (s: Suite) => {
    if (s.id === active) return;
    if (!confirm(`¿Borrar la suite ${s.name}?`)) return;
    void saveSuites(suites.filter((x) => x.id !== s.id), `Suite ${s.name} borrada.`);
  };
  const activate = (s: Suite) => run("act:" + s.id, async () => { apply(await settingsApi.update({ activeSuite: s.id })); },
    `${s.name} es la suite activa: el canal la toma en el próximo contenido.`);

  // --- Links del canal ---
  const setAudio = (l: OutputLink, audio: boolean) => run(l.slug, async () => { await outputLinksApi.update(l.slug, { audio }); await loadLinks(); });
  const rename = (l: OutputLink) => {
    const next = (editSlug[l.slug] ?? "").trim().toLowerCase();
    if (!next || next === l.slug) return;
    if (!confirm(`El link /output/${l.slug} va a dejar de funcionar y pasa a ser /output/${next}. Hay que cargar el nuevo en OBS/vMix. ¿Seguimos?`)) return;
    void run(l.slug, async () => { await outputLinksApi.update(l.slug, { slug: next }); setEditSlug((m) => ({ ...m, [l.slug]: "" })); await loadLinks(); }, `Ahora es /output/${next}.`);
  };
  // Se confirma en la ventana de "Regenerar link" (regen), que explica qué pasa.
  const regenerate = (l: OutputLink) => {
    setRegen(null);
    void run(l.slug, async () => { const n = await outputLinksApi.regenerate(l.slug); await loadLinks(); setMsg(`Link nuevo: /output/${n.slug}`); });
  };
  async function copy(slug: string) {
    try { await navigator.clipboard.writeText(outputLinkUrl(slug)); setCopied(slug); setTimeout(() => setCopied(null), 1500); }
    catch { /* el navegador no dejó copiar: el link queda visible igual */ }
  }

  const toggleLegacy = () => {
    const next = !legacy;
    if (!next && !confirm("Los links viejos (/output/?…) van a dejar de emitir. ¿Ya cargaste los links del canal en todos los OBS/vMix?")) return;
    void run("legacy", async () => { apply(await settingsApi.update({ legacyLinks: next })); }, next ? "Los links viejos vuelven a funcionar." : "Los links viejos ya no emiten.");
  };

  const colName = (id: string) => collectionById(id)?.label ?? id;
  const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderTop: "1px solid #eef1f6" };
  // width auto: el select/input global es 100% y aplastaba el nombre de la suite.
  const sel: React.CSSProperties = { height: 32, width: "auto", flex: "none", borderRadius: 8, border: "1px solid #e3e7ef", padding: "0 8px", background: "#fff" };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Suites</h1>
          <p>Una suite es un nombre con una colección de templates. Siempre hay una activa: la salida del canal emite con su colección, y el Programador y el Host ven su nombre. Activar otra suite o cambiarle la colección entra en el próximo contenido, sin tocar los links de OBS/vMix.</p>
        </div>
        <Link to="/ajustes" className="btn"><ArrowLeft size={16} /> Ajustes</Link>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <section className="card sec-card">
        <div className="sec-card-hd"><h3>Suites</h3></div>
        {suites.map((s) => {
          const on = s.id === active;
          return (
            <div key={s.id} style={{ ...row, borderTop: undefined, background: on ? "#f3f7ff" : undefined, borderRadius: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{s.name}{on && <span style={{ fontSize: 12, color: "#2f6bff", marginLeft: 8 }}>activa</span>}</div>
                <div style={{ fontSize: 12, color: "#6b7688" }}>{colName(s.style)}</div>
              </div>
              <select value={s.style} disabled={busy != null} onChange={(e) => void setStyleOf(s, e.target.value)} style={sel} aria-label={`Colección de ${s.name}`}>
                {!enabled.includes(s.style) && <option value={s.style}>{colName(s.style)} (no habilitada)</option>}
                {enabled.map((id) => <option key={id} value={id}>{colName(id)}</option>)}
              </select>
              {on
                ? <span className="toggle-pill on"><Check size={14} /> Activa</span>
                : <button type="button" className="toggle-pill" disabled={busy != null} onClick={() => void activate(s)}>{busy === "act:" + s.id ? <Loader2 size={14} className="spin" /> : null} Activar</button>}
              <button type="button" className="btn" disabled={on || busy != null} onClick={() => removeSuite(s)} title={on ? "La suite activa no se puede borrar" : "Borrar"}><Trash2 size={15} /></button>
            </div>
          );
        })}
        <div style={row}>
          <input value={newName} onChange={(e) => setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40))} placeholder="nombre de la suite nueva (ej. navidad2026)" style={{ ...sel, flex: 1, minWidth: 0, padding: "0 10px" }} aria-label="Nombre de la suite nueva" />
          <select value={newStyle} onChange={(e) => setNewStyle(e.target.value)} style={sel} aria-label="Colección de la suite nueva">
            {enabled.map((id) => <option key={id} value={id}>{colName(id)}</option>)}
          </select>
          <button type="button" className="btn primary" disabled={!newName || busy != null} onClick={createSuite}><Plus size={15} /> Crear suite</button>
        </div>
      </section>

      <section className="card sec-card">
        <div className="sec-card-hd"><h3>Links del canal</h3>
        <p>La salida del canal es una sola señal: la parrilla del Copiloto y, mientras el Host tiene Stream abierto, el Stream. Cargá estos links una vez en OBS/vMix (1920×1080 el horizontal, 1080×1920 el vertical). No lo compartas: cualquiera con el link ve la señal.</p></div>
        {links == null && <div style={{ padding: 12, color: "#6b7688" }}><Loader2 size={14} className="spin" /> Cargando…</div>}
        {links?.map((l, i) => (
          <div key={l.slug} style={{ ...row, borderTop: i ? row.borderTop : undefined, gap: 8 }}>
            <span title={l.orientation === "vertical" ? "Vertical 9:16" : "Horizontal 16:9"} style={{ display: "inline-flex", color: "#6b7688" }}>{l.orientation === "vertical" ? <RectangleVertical size={18} /> : <RectangleHorizontal size={18} />}</span>
            <div style={{ flex: 1, minWidth: 0, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={outputLinkUrl(l.slug)}>{outputLinkUrl(l.slug)}</div>
            <button type="button" className="btn" onClick={() => void copy(l.slug)} title={copied === l.slug ? "Copiado" : "Copiar"}>{copied === l.slug ? <Check size={15} /> : <Copy size={15} />}</button>
            <a className="btn" href={outputLinkUrl(l.slug)} target="_blank" rel="noreferrer" title="Abrir"><ExternalLink size={15} /></a>
            <button type="button" className={"toggle-pill" + (l.audio ? " on" : "")} disabled={busy != null} onClick={() => void setAudio(l, !l.audio)} title={l.audio ? "Con audio" : "Sin audio"}>
              {busy === l.slug ? <Loader2 size={14} className="spin" /> : l.audio ? <Volume2 size={14} /> : <VolumeX size={14} />} {l.audio ? "Con audio" : "Sin audio"}
            </button>
            <input value={editSlug[l.slug] ?? ""} onChange={(e) => setEditSlug((m) => ({ ...m, [l.slug]: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) }))} placeholder="nombre nuevo" style={{ ...sel, width: 120, padding: "0 10px" }} aria-label={`Nombre nuevo para ${l.slug}`} />
            <button type="button" className="btn" disabled={!editSlug[l.slug] || busy != null} onClick={() => rename(l)}>Renombrar</button>
            <button type="button" className="btn" disabled={busy != null} onClick={() => setRegen(l)} title="Si el link se filtró: genera uno nuevo al azar y el viejo deja de emitir"><RefreshCw size={15} /> Regenerar</button>
          </div>
        ))}
      </section>

      <section className="card sec-card">
        <div className="sec-card-hd"><h3>Colecciones habilitadas</h3>
        <p>{isMaster ? "Elegí qué colecciones de templates se pueden usar en las suites." : "Las habilita el Master."}</p></div>
        {TEMPLATE_COLLECTIONS.map((c, i) => {
          const on = enabled.includes(c.id);
          return (
            <div key={c.id} style={{ ...row, borderTop: i ? row.borderTop : undefined, opacity: c.ready ? 1 : 0.55 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{c.label}{!c.ready ? <span style={{ fontSize: 12, color: "#6b7688", marginLeft: 8 }}>en preparación</span> : null}</div>
                <div style={{ fontSize: 13, color: "#6b7688" }}>{c.desc}</div>
              </div>
              {isMaster
                ? <button type="button" className={"toggle-pill" + (on ? " on" : "")} disabled={!c.ready || busy != null} onClick={() => void toggleCollection(c.id)}>
                    {busy === "col:" + c.id ? <Loader2 size={14} className="spin" /> : on ? <Check size={14} /> : null} {on ? "Habilitada" : "No habilitada"}
                  </button>
                : <span style={{ fontSize: 13, color: on ? "#1a2235" : "#6b7688" }}>{on ? "Habilitada" : "No habilitada"}</span>}
            </div>
          );
        })}
      </section>

      <div className="card sec-card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Link2Off size={20} style={{ flex: "none", color: "#6b7688" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>Links viejos con variables</div>
          <div style={{ fontSize: 13, color: "#6b7688", marginTop: 2 }}>
            {legacy ? "Siguen funcionando (/output/?orientation=…, ?session=…, ?radio=…). Apagalos cuando todos los OBS/vMix usen los links del canal." : "Apagados: sólo emiten los links del canal. Los monitores del panel no se ven afectados."}
          </div>
        </div>
        <button type="button" className={"toggle-pill" + (legacy ? " on" : "")} disabled={busy != null} onClick={toggleLegacy}>
          {busy === "legacy" ? <Loader2 size={14} className="spin" /> : legacy ? <Check size={14} /> : null} {legacy ? "Funcionan" : "Apagados"}
        </button>
      </div>

      {regen && (
        <div className="modal-back" onClick={() => setRegen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Regenerar link">
            <div className="modal-head">
              <b>Regenerar el link {regen.orientation === "vertical" ? "vertical" : "horizontal"}</b>
              <button className="icon-btn" onClick={() => setRegen(null)} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div className="sx-regen">
              <p>Regenerar crea un link nuevo al azar para esta salida del canal. Sirve si el link se filtró: quien lo tenga deja de ver la señal.</p>
              <ul>
                <li>El link actual <code>/output/{regen.slug}</code> deja de emitir en el momento.</li>
                <li>Los OBS/vMix que lo usan quedan sin señal hasta que cargues el link nuevo.</li>
                <li>Se mantienen la suite activa y el audio {regen.audio ? "(con audio)" : "(sin audio)"}.</li>
              </ul>
              <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
                <button className="btn" onClick={() => setRegen(null)}>Cancelar</button>
                <button className="btn primary" style={{ background: "#c0392b", borderColor: "#c0392b" }} onClick={() => regenerate(regen)}><RefreshCw size={15} /> Regenerar link</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
