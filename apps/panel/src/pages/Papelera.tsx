import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { TIPO_BY_KEY } from "../lib/tipos";
import { contentItems, type TrashedItem } from "../lib/content-items";
import { toast } from "../lib/toast";
import { useAuth } from "../auth/AuthProvider";
import { ContenidoNav } from "./NuevoContenido";

const titleOf = (it: TrashedItem): string => {
  const d = (it.data ?? {}) as Record<string, unknown>;
  return String(d.title ?? d.text ?? d.name ?? d.city ?? TIPO_BY_KEY[it.type]?.label ?? it.type);
};
const ago = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "hoy" : d === 1 ? "ayer" : `hace ${d} días`;
};

// Papelera de contenidos: lo borrado se conserva 30 días y se puede restaurar. Los contenidos al aire no se pueden borrar.
export function Papelera() {
  const { can } = useAuth();
  const [rows, setRows] = useState<TrashedItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => contentItems.trash().then(setRows).catch((e) => { toast(e.message, "error"); setRows([]); });
  useEffect(() => { void load(); }, []);

  async function restore(it: TrashedItem) {
    setBusy(it.id);
    try { await contentItems.restore(it.id); toast("Restaurado. Ya está de nuevo en el banco.", "ok"); await load(); }
    catch (e) { toast(e instanceof Error ? e.message : "no se pudo restaurar", "error"); }
    finally { setBusy(null); }
  }
  async function purge(it: TrashedItem) {
    if (!confirm(`¿Eliminar definitivamente "${titleOf(it)}"? Ya no se podrá recuperar.`)) return;
    setBusy(it.id);
    try { await contentItems.purge(it.id); toast("Eliminado definitivamente.", "ok"); await load(); }
    catch (e) { toast(e instanceof Error ? e.message : "no se pudo eliminar", "error"); }
    finally { setBusy(null); }
  }

  return (
    <>
      <ContenidoNav active="papelera" />
      <div className="page-head">
        <div>
          <h1>Papelera</h1>
          <p>Los contenidos borrados se guardan 30 días; después se eliminan solos.</p>
        </div>
        <Link to="/contenido" className="btn"><ArrowLeft size={16} /> Contenido</Link>
      </div>

      {rows == null ? (
        <div className="muted-note">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ padding: 22, textAlign: "center" }}><div className="muted-note">La papelera está vacía.</div></div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr><th>Contenido</th><th>Borrado</th><th>Se elimina en</th><th style={{ textAlign: "right" }}>Acciones</th></tr>
            </thead>
            <tbody>
              {rows.map((it) => {
                const Ic = TIPO_BY_KEY[it.type]?.Icon;
                return (
                  <tr key={it.id}>
                    <td>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span className="tipo-ic" style={{ width: 34, height: 34, flex: "none" }}>{Ic ? <Ic size={16} /> : null}</span>
                        <div>
                          <div style={{ fontWeight: 600 }}>{titleOf(it)}</div>
                          <div className="muted-note" style={{ fontSize: 12 }}>{TIPO_BY_KEY[it.type]?.label ?? it.type}{it.created_by_name ? ` · creó ${it.created_by_name}` : ""}</div>
                        </div>
                      </div>
                    </td>
                    <td className="muted-note">{ago(it.deleted_at)}{it.deleted_by_name ? ` · ${it.deleted_by_name}` : ""}</td>
                    <td className="muted-note">{it.days_left} {it.days_left === 1 ? "día" : "días"}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn" disabled={busy != null} onClick={() => restore(it)}>{busy === it.id ? <Loader2 size={15} className="spin" /> : <RotateCcw size={15} />} Restaurar</button>
                      {can("vaciar_papelera") && <button className="btn danger-ghost" disabled={busy != null} onClick={() => purge(it)} style={{ marginLeft: 8 }}><Trash2 size={15} /> Eliminar</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
