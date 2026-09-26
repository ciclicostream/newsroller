import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Loader2, Palette, Link2Off } from "lucide-react";
import { DEFAULT_COLLECTION, TEMPLATE_COLLECTIONS } from "@newsroller/shared";
import { settingsApi } from "../lib/settings";

// Ajustes → Estilos (sólo Administrador o Master): qué colección de templates usan TODOS los outputs,
// el Stream y los monitores del panel. Cada colección tiene 16:9 y 9:16; no se mezclan.
// También apaga los links viejos con variables cuando todos los outputs ya usan links con nombre.
export function AjustesEstilos() {
  const [style, setStyle] = useState<string | null>(null);
  const [legacy, setLegacy] = useState<boolean>(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    settingsApi.get().then((s) => { setStyle(s.style ?? DEFAULT_COLLECTION); setLegacy(s.legacyLinks !== false); }).catch((e) => setErr(e.message));
  }, []);

  async function pick(id: string) {
    if (id === style) return;
    setBusy(id); setErr(null); setMsg(null);
    try {
      const s = await settingsApi.update({ style: id });
      setStyle(s.style ?? id);
      setMsg("Listo: el próximo contenido ya sale con este estilo en todos los outputs.");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  }

  async function toggleLegacy() {
    const next = !legacy;
    if (!next && !confirm("Los links viejos (/output/?…) van a dejar de emitir. ¿Ya pasaste todos los OBS/vMix a links con nombre?")) return;
    setBusy("legacy"); setErr(null); setMsg(null);
    try {
      const s = await settingsApi.update({ legacyLinks: next });
      setLegacy(s.legacyLinks !== false);
      setMsg(next ? "Los links viejos vuelven a funcionar." : "Los links viejos ya no emiten.");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Estilos</h1>
          <p>La colección de templates que usan todos los outputs, el Stream y los monitores. Cada una tiene versión 16:9 y 9:16, y no se mezclan. Un link con nombre puede fijar su propio estilo desde el Generador de links.</p>
        </div>
        <Link to="/ajustes" className="btn"><ArrowLeft size={16} /> Ajustes</Link>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div className="tipo-grid">
        {TEMPLATE_COLLECTIONS.map((c) => {
          const on = style === c.id;
          return (
            <button key={c.id} type="button" className={"tipo-card" + (on ? " active" : "")} disabled={!c.ready || busy != null} onClick={() => void pick(c.id)}
              style={{ textAlign: "left", cursor: c.ready ? "pointer" : "not-allowed", opacity: c.ready ? 1 : 0.55, outline: on ? "2px solid var(--accent, #2f6bff)" : undefined }}>
              <span className="tipo-ic">{busy === c.id ? <Loader2 size={22} className="spin" /> : on ? <Check size={22} /> : <Palette size={22} />}</span>
              <span className="tipo-main">
                <span className="tipo-name">{c.label}{on ? " · en uso" : ""}{!c.ready ? " · en preparación" : ""}</span>
                <span className="tipo-desc">{c.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="card" style={{ padding: 18, marginTop: 18, display: "flex", alignItems: "center", gap: 14 }}>
        <Link2Off size={20} style={{ flex: "none", color: "#6b7688" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>Links viejos con variables</div>
          <div style={{ fontSize: 13, color: "#6b7688", marginTop: 2 }}>
            {legacy ? "Siguen funcionando (/output/?orientation=…). Apagalos cuando todos los OBS/vMix usen links con nombre." : "Apagados: sólo emiten los links con nombre. Los monitores del panel no se ven afectados."}
          </div>
        </div>
        <button type="button" className={"toggle-pill" + (legacy ? " on" : "")} disabled={busy != null} onClick={() => void toggleLegacy()}>
          {busy === "legacy" ? <Loader2 size={14} className="spin" /> : legacy ? <Check size={14} /> : null} {legacy ? "Funcionan" : "Apagados"}
        </button>
      </div>
    </>
  );
}
