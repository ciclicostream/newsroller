import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { contentItems } from "../lib/content-items";
import { selectActions, useSelectState } from "../lib/contentSelect";
import { toast } from "../lib/toast";

const WORD = "BORRAR";

// Barra de la lista de contenidos (va dentro del monitor): selección múltiple y borrado en tandas.
// El borrado pide escribir BORRAR para no mandar a la papelera por error. Sólo aparece en las páginas que
// registran su lista con useContentSelect.
export function ContentToolbar() {
  const s = useSelectState();
  const [asking, setAsking] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  if (!s.reload) return null;
  const n = s.selected.size;
  const inGrid = [...s.selected].filter((id) => s.grid.has(id)).length;

  const close = () => { if (!busy) { setAsking(false); setTyped(""); } };
  async function confirm() {
    if (typed !== WORD || busy) return;
    setBusy(true);
    const r = await contentItems.removeMany([...s.selected]);
    setBusy(false); setAsking(false); setTyped("");
    selectActions.cancel();
    await s.reload?.();
    if (r.failed) toast(`${r.ok ? `${r.ok} a la papelera. ` : ""}${r.failed} no se pudo borrar: ${r.reason}`, "error");
    else toast(`${r.ok} contenido${r.ok === 1 ? "" : "s"} a la papelera. Se conservan 30 días.`, "ok");
  }

  if (!s.selecting) return null; // se activa con el ícono de la cabecera del monitor

  return (
    <div className="ct-bar">
      <span className="ct-n">{n} de {s.ids.length}</span>
      <button type="button" className="ct-btn" onClick={selectActions.all}>Todos</button>
      <button type="button" className="ct-btn" onClick={selectActions.none} disabled={n === 0}>Ninguno</button>
      <button type="button" className="ct-btn ct-del" onClick={() => setAsking(true)} disabled={n === 0}><Trash2 size={13} /> Borrar{n ? ` (${n})` : ""}</button>
      <button type="button" className="ct-btn" onClick={selectActions.cancel}>Cancelar</button>

      {asking && (
        <div className="modal-back" onClick={close}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-head">
              <b>Borrar {n} contenido{n === 1 ? "" : "s"}</b>
              <button type="button" className="icon-btn" onClick={close} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div style={{ padding: 16, display: "grid", gap: 12 }}>
              <div style={{ fontSize: 14 }}>Van a la papelera y se conservan 30 días.</div>
              {inGrid > 0 && (
                <div className="alert error" style={{ margin: 0 }}>
                  {inGrid === 1 ? "1 está" : `${inGrid} están`} en la parrilla. Si alguno está al aire, no se borra.
                </div>
              )}
              <label style={{ fontSize: 14 }}>
                Escribí <b>{WORD}</b> para confirmar
                <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void confirm(); if (e.key === "Escape") close(); }}
                  placeholder={WORD} autoComplete="off" spellCheck={false} style={{ width: "100%", marginTop: 6 }} />
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn" onClick={close} disabled={busy}>Cancelar</button>
                <button type="button" className="btn ct-danger" onClick={confirm} disabled={typed !== WORD || busy}>{busy ? "Borrando…" : "Borrar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
