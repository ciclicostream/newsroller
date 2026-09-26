import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Link2, Loader2, Plus, RectangleHorizontal, RectangleVertical, Trash2, Volume2, VolumeX } from "lucide-react";
import { TEMPLATE_COLLECTIONS, collectionById, type OutputLink, type OutputLinkTarget } from "@newsroller/shared";
import { outputLinkUrl, outputLinksApi } from "../lib/outputLinks";

// Generador de links de salida (debajo del monitor en Emisión, en cada Sesión y en Stream).
// Arma links con nombre: /output/<nombre>, sin variables a la vista. Orientación, audio y estilo quedan
// guardados en el server y se cambian desde acá sin tocar la URL que ya está cargada en OBS/vMix.
export function OutputLinksPicker({ title, target = "emision", sessionId, fixedAudio }: {
  title?: string;
  target?: OutputLinkTarget;
  sessionId?: string;
  fixedAudio?: boolean; // Stream: siempre con audio
}) {
  const [vertical, setVertical] = useState(false);
  const [audio, setAudio] = useState(fixedAudio ?? false);
  const [style, setStyle] = useState<string>(""); // "" = el de Ajustes → Estilos
  const [name, setName] = useState("");
  const [links, setLinks] = useState<OutputLink[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const mine = (l: OutputLink) => l.target === target && (target !== "sesion" || l.session_id === sessionId);
  const load = () => outputLinksApi.list().then((all) => setLinks(all.filter(mine))).catch((e) => { setLinks([]); setErr(hint(e)); });
  useEffect(() => { void load(); }, [target, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function create() {
    setBusy("new"); setErr(null);
    try {
      await outputLinksApi.create({
        slug: name.trim().toLowerCase() || undefined, target, session_id: target === "sesion" ? sessionId ?? null : null,
        orientation: vertical ? "vertical" : "horizontal", audio: fixedAudio ?? audio, style: style || null,
      });
      setName("");
      await load();
    } catch (e) { setErr(hint(e)); }
    finally { setBusy(null); }
  }

  async function update(l: OutputLink, patch: Partial<OutputLink>) {
    setBusy(l.slug); setErr(null);
    try { await outputLinksApi.update(l.slug, patch); await load(); }
    catch (e) { setErr(hint(e)); }
    finally { setBusy(null); }
  }

  async function remove(l: OutputLink) {
    if (!confirm(`¿Borrar el link /output/${l.slug}? El OBS/vMix que lo use deja de emitir.`)) return;
    setBusy(l.slug); setErr(null);
    try { await outputLinksApi.remove(l.slug); await load(); }
    catch (e) { setErr(hint(e)); }
    finally { setBusy(null); }
  }

  async function copy(slug: string) {
    try { await navigator.clipboard.writeText(outputLinkUrl(slug)); setCopied(slug); setTimeout(() => setCopied(null), 1500); }
    catch { /* el navegador no dejó copiar: el link queda visible igual */ }
  }

  return (
    <div className="card lp">
      {title && <div className="lp-hd">{title}</div>}
      <div className="lp-picks">
        <Link2 size={15} className="lp-icon" />
        <Seg on={vertical} set={setVertical} off={<RectangleHorizontal size={15} />} onIcon={<RectangleVertical size={15} />} offTitle="Horizontal 16:9" onTitle="Vertical 9:16" />
        {fixedAudio == null && <Seg on={audio} set={setAudio} off={<VolumeX size={15} />} onIcon={<Volume2 size={15} />} offTitle="Sin audio" onTitle="Con audio" />}
        <StyleSelect value={style} onChange={setStyle} />
        <input className="lp-name" value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40))} placeholder="nombre (opcional)" aria-label="Nombre del link" />
        <button className="sess-icon" onClick={() => void create()} disabled={busy != null} title="Crear link">{busy === "new" ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}</button>
      </div>
      {err && <div className="lp-err">{err}</div>}
      {links && links.length > 0 && (
        <div className="lp-list">
          {links.map((l) => (
            <div key={l.slug} className="lp-row">
              <div className="lp-url" title={outputLinkUrl(l.slug)}>{outputLinkUrl(l.slug)}</div>
              <Seg on={l.orientation === "vertical"} set={(v) => void update(l, { orientation: v ? "vertical" : "horizontal" })} off={<RectangleHorizontal size={14} />} onIcon={<RectangleVertical size={14} />} offTitle="Horizontal 16:9" onTitle="Vertical 9:16" />
              {fixedAudio == null && <Seg on={l.audio} set={(v) => void update(l, { audio: v })} off={<VolumeX size={14} />} onIcon={<Volume2 size={14} />} offTitle="Sin audio" onTitle="Con audio" />}
              <StyleSelect value={l.style ?? ""} onChange={(v) => void update(l, { style: v || null })} />
              <a className="sess-icon" href={outputLinkUrl(l.slug)} target="_blank" rel="noreferrer" title="Abrir"><ExternalLink size={14} /></a>
              <button className="sess-icon" onClick={() => void copy(l.slug)} title={copied === l.slug ? "Copiado" : "Copiar"}>{copied === l.slug ? <Check size={14} /> : <Copy size={14} />}</button>
              <button className="sess-icon" onClick={() => void remove(l)} disabled={busy === l.slug} title="Borrar">{busy === l.slug ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Par de íconos (sin texto): el título aparece al pasar el mouse.
function Seg({ on, set, off, onIcon, offTitle, onTitle }: { on: boolean; set: (v: boolean) => void; off: React.ReactNode; onIcon: React.ReactNode; offTitle: string; onTitle: string }) {
  return (
    <div className="lp-seg">
      <button className={!on ? "on" : ""} onClick={() => set(false)} title={offTitle} aria-label={offTitle}>{off}</button>
      <button className={on ? "on" : ""} onClick={() => set(true)} title={onTitle} aria-label={onTitle}>{onIcon}</button>
    </div>
  );
}

// Estilo del link: el de Ajustes (por defecto) o una colección fija. Las que están en preparación no se eligen.
function StyleSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select className="lp-style" value={value} onChange={(e) => onChange(e.target.value)} title="Estilo" aria-label="Estilo">
      <option value="">Estilo de Ajustes</option>
      {TEMPLATE_COLLECTIONS.map((c) => (
        <option key={c.id} value={c.id} disabled={!c.ready && value !== c.id}>{c.label}{c.ready ? "" : " (en preparación)"}</option>
      ))}
      {value && !collectionById(value) && <option value={value}>{value}</option>}
    </select>
  );
}

function hint(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return /output_links|relation|does not exist|sin base/i.test(m) ? "Falta correr la migración 0024 en Supabase para guardar links con nombre." : m;
}
