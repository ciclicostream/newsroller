import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Trash2, Loader2, Search, RotateCcw, RefreshCw, Film, Image as ImageIcon, Music, X } from "lucide-react";
import { AssetManager } from "../components/managers";
import { useAuth } from "../auth/AuthProvider";
import { banco, fmtSize, type BancoItem, type BancoList, type BancoTrashed, type DeleteResult } from "../lib/banco";
import { uploadMedia } from "../lib/content";
import { toast } from "../lib/toast";
import { TIPO_BY_KEY } from "../lib/tipos";

type Tab = "biblioteca" | "fondos" | "papelera";
type TypeFilter = "all" | "image" | "video";
type UseFilter = "all" | "en_uso" | "sin_uso";

const DAY = 86_400_000;
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// Agrupa por fecha de carga: Hoy, Ayer, Esta semana (últimos 7 días) y luego por mes.
function groupKey(iso: string, now: number): { key: string; label: string; order: number } {
  const d = new Date(iso);
  const days = Math.floor((startOfDay(new Date(now)) - startOfDay(d)) / DAY);
  if (days <= 0) return { key: "hoy", label: "Hoy", order: 0 };
  if (days === 1) return { key: "ayer", label: "Ayer", order: 1 };
  if (days < 7) return { key: "semana", label: "Esta semana", order: 2 };
  return { key: `${d.getFullYear()}-${d.getMonth()}`, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, order: 3 + (100000 - (d.getFullYear() * 12 + d.getMonth())) };
}
const fmtDate = (iso: string) => new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const typeLabel = (t: string) => TIPO_BY_KEY[t]?.label ?? t;

export function Banco() {
  const { can } = useAuth();
  const [tab, setTab] = useState<Tab>("biblioteca");
  const [data, setData] = useState<BancoList | null>(null);
  const [trash, setTrash] = useState<BancoTrashed[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (sync = false) => {
    try { setData(await banco.list(sync)); } catch (e) { toast(e instanceof Error ? e.message : "no se pudo cargar el Banco", "error"); }
    finally { setLoading(false); }
  };
  const loadTrash = () => banco.trash().then(setTrash).catch(() => setTrash([]));
  useEffect(() => { void load(); void loadTrash(); }, []);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    let ok = 0;
    for (const f of Array.from(files)) {
      try { await uploadMedia(f, "media", "banco"); ok++; }
      catch (e) { toast(`${f.name}: ${e instanceof Error ? e.message : "no se pudo subir"}`, "error"); }
    }
    if (ok) toast(ok === 1 ? "Subido al Banco." : `${ok} archivos subidos al Banco.`, "ok");
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    await load();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Banco</h1>
          <p>Todas las fotos, videos y logos cargados, incluidos los de las placas. Los fondos están aparte.</p>
        </div>
        {tab === "biblioteca" && (
          <div className="row" style={{ alignItems: "center" }}>
            {can("vaciar_papelera") && data?.ready && (
              <button className="btn" onClick={async () => { setLoading(true); await load(true); }} title="Trae al Banco lo que esté en el almacenamiento y no figure">
                <RefreshCw size={16} /> Importar del almacenamiento
              </button>
            )}
            <button className="btn primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />} Subir
            </button>
            <input ref={fileRef} type="file" hidden multiple accept="image/*,video/*" onChange={(e) => onFiles(e.target.files)} />
          </div>
        )}
      </div>

      <div className="tabs">
        <button className={"tab" + (tab === "biblioteca" ? " active" : "")} onClick={() => setTab("biblioteca")}>Fotos, videos y logos</button>
        <button className={"tab" + (tab === "fondos" ? " active" : "")} onClick={() => setTab("fondos")}>Fondos</button>
        <button className={"tab" + (tab === "papelera" ? " active" : "")} onClick={() => { setTab("papelera"); void loadTrash(); }}>
          Papelera{data && data.trash_count > 0 ? ` (${data.trash_count})` : ""}
        </button>
      </div>

      {tab === "fondos" && <AssetManager kind="background" />}
      {tab === "biblioteca" && (loading || !data
        ? <div className="uploading"><Loader2 size={16} className="spin" /> Cargando…</div>
        : <Biblioteca data={data} reload={async () => { await load(); await loadTrash(); }} />)}
      {tab === "papelera" && <PapeleraBanco rows={trash} reload={async () => { await loadTrash(); await load(); }} canPurge={can("vaciar_papelera")} days={data?.trash_days ?? 30} />}
    </>
  );
}

function Thumb({ f }: { f: { kind: string; url: string; name: string } }) {
  if (f.kind === "image") return <img src={f.url} alt={f.name} loading="lazy" />;
  if (f.kind === "video") return <><video src={f.url} muted preload="metadata" /><span className="bn-kind"><Film size={12} /></span></>;
  if (f.kind === "audio") return <Music size={26} />;
  return <ImageIcon size={26} />;
}

function Biblioteca({ data, reload }: { data: BancoList; reload: () => Promise<void> }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [use, setUse] = useState<UseFilter>("all");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [last, setLast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ ids: string[]; onAir: BancoItem[]; inUse: BancoItem[]; free: BancoItem[]; forceInUse: boolean } | null>(null);
  const now = Date.now();

  const isUnused = (f: BancoItem) => f.usage.count === 0 && now - new Date(f.created_at).getTime() > data.unused_days * DAY;
  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data.items.filter((f) => {
      if (type !== "all" && f.kind !== type) return false;
      if (use === "en_uso" && f.usage.count === 0) return false;
      if (use === "sin_uso" && !(f.usage.count === 0 && Date.now() - new Date(f.created_at).getTime() > data.unused_days * DAY)) return false;
      if (t && !(f.name.toLowerCase().includes(t) || (f.uploaded_by_name ?? "").toLowerCase().includes(t))) return false;
      return true;
    });
  }, [data, q, type, use]);

  const groups = useMemo(() => {
    const m = new Map<string, { label: string; order: number; items: BancoItem[] }>();
    for (const f of visible) {
      const g = groupKey(f.created_at, Date.now());
      const cur = m.get(g.key) ?? { label: g.label, order: g.order, items: [] };
      cur.items.push(f);
      m.set(g.key, cur);
    }
    return [...m.entries()].map(([key, g]) => ({ key, ...g })).sort((a, b) => a.order - b.order);
  }, [visible]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const byId = useMemo(() => new Map(data.items.map((f) => [f.id, f])), [data]);

  // Casilla con Shift: selecciona el rango entre la última tocada y ésta, siguiendo el orden en pantalla.
  function toggle(id: string, shift: boolean) {
    setSel((cur) => {
      const next = new Set(cur);
      if (shift && last && last !== id) {
        const a = flat.findIndex((f) => f.id === last), b = flat.findIndex((f) => f.id === id);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          const on = !cur.has(id);
          for (let i = lo; i <= hi; i++) on ? next.add(flat[i]!.id) : next.delete(flat[i]!.id);
          return next;
        }
      }
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setLast(id);
  }
  function toggleGroup(items: BancoItem[]) {
    setSel((cur) => {
      const next = new Set(cur);
      const all = items.every((f) => cur.has(f.id));
      for (const f of items) all ? next.delete(f.id) : next.add(f.id);
      return next;
    });
  }

  function askDelete() {
    const files = [...sel].map((id) => byId.get(id)).filter(Boolean) as BancoItem[];
    if (!files.length) return;
    setConfirm({
      ids: files.map((f) => f.id),
      onAir: files.filter((f) => f.usage.on_air),
      inUse: files.filter((f) => !f.usage.on_air && f.usage.count > 0),
      free: files.filter((f) => f.usage.count === 0),
      forceInUse: false,
    });
  }
  async function doDelete() {
    if (!confirm) return;
    setBusy(true);
    try {
      const ids = confirm.ids.filter((id) => !confirm.onAir.some((f) => f.id === id));
      const r: DeleteResult = await banco.remove(ids, confirm.forceInUse);
      const extra = r.skipped.length ? ` ${r.skipped.length} en uso se salteó.` : "";
      toast(`${r.deleted} a la papelera (30 días).${extra}`, "ok");
      setSel(new Set());
      setConfirm(null);
      await reload();
    } catch (e) { toast(e instanceof Error ? e.message : "no se pudo borrar", "error"); }
    finally { setBusy(false); }
  }
  async function toggleLogo(f: BancoItem) {
    try { await banco.setLogo(f.id, !f.logo_active); await reload(); }
    catch (e) { toast(e instanceof Error ? e.message : "no se pudo cambiar", "error"); }
  }

  const totalSize = visible.reduce((s, f) => s + (f.size ?? 0), 0);
  const unusedCount = data.items.filter(isUnused).length;

  return (
    <>
      {!data.ready && (
        <div className="alert info">Falta correr la migración 0017 en Supabase. Mientras tanto se ve sólo lo cargado desde el Banco anterior y no se puede borrar.</div>
      )}

      <div className="bn-tools">
        <div className="bn-search">
          <Search size={15} />
          <input placeholder="Buscar por nombre o persona" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value as TypeFilter)} aria-label="Tipo">
          <option value="all">Imágenes y videos</option>
          <option value="image">Sólo imágenes</option>
          <option value="video">Sólo videos</option>
        </select>
        <select value={use} onChange={(e) => setUse(e.target.value as UseFilter)} aria-label="Uso">
          <option value="all">Todo</option>
          <option value="en_uso">En uso</option>
          <option value="sin_uso">Sin uso hace más de {data.unused_days} días ({unusedCount})</option>
        </select>
        <div className="muted-note">{visible.length} archivo{visible.length === 1 ? "" : "s"} · {fmtSize(totalSize)}</div>
      </div>

      <div className="bn-barslot">
      {sel.size > 0 && (
        <div className="bn-bar">
          <b>{sel.size}</b> seleccionado{sel.size === 1 ? "" : "s"}
          <button className="btn" onClick={() => setSel(new Set(flat.map((f) => f.id)))}>Seleccionar los {flat.length} visibles</button>
          <button className="btn" onClick={() => setSel(new Set())}><X size={14} /> Limpiar</button>
          <span style={{ flex: 1 }} />
          <button className="btn danger-ghost" onClick={askDelete} disabled={!data.ready || busy}><Trash2 size={15} /> Borrar</button>
        </div>
      )}
      </div>

      {groups.length === 0 && <div className="muted-note">No hay nada que coincida. Subí el primero o cambiá los filtros.</div>}

      {groups.map((g) => {
        const all = g.items.every((f) => sel.has(f.id));
        const some = !all && g.items.some((f) => sel.has(f.id));
        return (
          <section key={g.key} className="bn-group">
            <div className="bn-ghead">
              <input type="checkbox" checked={all} ref={(el) => { if (el) el.indeterminate = some; }} onChange={() => toggleGroup(g.items)} aria-label={`Seleccionar ${g.label}`} />
              <h3>{g.label}</h3>
              <span className="muted-note">{g.items.length} · {fmtSize(g.items.reduce((s, f) => s + (f.size ?? 0), 0))}</span>
            </div>
            <div className="asset-grid bn-grid">
              {g.items.map((f) => (
                <div key={f.id} className={"asset-card bn-card" + (sel.has(f.id) ? " sel" : "")}>
                  <div className="asset-thumb bn-thumb">
                    <a href={f.url} target="_blank" rel="noreferrer" className="bn-open" aria-label="Abrir"><Thumb f={f} /></a>
                    <label className="bn-check" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={sel.has(f.id)} onChange={() => {}} onClick={(e) => toggle(f.id, e.shiftKey)} aria-label={`Seleccionar ${f.name}`} />
                    </label>
                    <div className="bn-badges">
                      {f.usage.on_air && <span className="bn-badge air"><span className="live-dot" /> Al aire</span>}
                      {!f.usage.on_air && f.usage.count > 0 && (
                        <span className="bn-badge use" title={f.usage.refs.map((r) => `${typeLabel(r.type)}: ${r.title}`).join("\n")}>En uso{f.usage.count > 1 ? ` (${f.usage.count})` : ""}</span>
                      )}
                      {f.logo_active && <span className="bn-badge logo">Logo</span>}
                    </div>
                  </div>
                  <div className="asset-body">
                    <div className="asset-name" title={f.name}>{f.name}</div>
                    <div className="bn-meta">{fmtSize(f.size)} · {fmtDate(f.created_at)}</div>
                    <div className="bn-meta">{f.uploaded_by_name ?? "Sin registro"}</div>
                    {f.kind === "image" && data.ready && (
                      <button className={"toggle-pill" + (f.logo_active ? " on" : "")} style={{ marginTop: 8 }} onClick={() => toggleLogo(f)} title="Mostrar esta imagen como logo fijo en pantalla">
                        {f.logo_active && <span className="live-dot" />} Logo en pantalla
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {confirm && (
        <div className="modal-bg" onClick={() => !busy && setConfirm(null)}>
          <div className="modal bn-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Mandar a la papelera</h3>
            <p className="muted-note">Se conservan {data.trash_days} días y se pueden restaurar.</p>
            {confirm.onAir.length > 0 && (
              <div className="alert error">
                {confirm.onAir.length} está{confirm.onAir.length === 1 ? "" : "n"} al aire y no se puede borrar:
                <ul>{confirm.onAir.slice(0, 5).map((f) => <li key={f.id}>{f.name}</li>)}{confirm.onAir.length > 5 && <li>y {confirm.onAir.length - 5} más</li>}</ul>
              </div>
            )}
            {confirm.inUse.length > 0 && (
              <div className="alert info">
                {confirm.inUse.length} {confirm.inUse.length === 1 ? "está usada" : "están usadas"} por otros contenidos; por defecto se salteán. Si las borrás, esos contenidos van a mostrar la imagen rota.
                <ul>{confirm.inUse.slice(0, 5).map((f) => <li key={f.id}>{f.name}: {f.usage.refs.map((r) => r.title).slice(0, 2).join(", ")}</li>)}</ul>
                <label className="bn-force"><input type="checkbox" checked={confirm.forceInUse} onChange={(e) => setConfirm({ ...confirm, forceInUse: e.target.checked })} /> Borrar también las que están en uso</label>
              </div>
            )}
            {(() => {
              const n = confirm.free.length + (confirm.forceInUse ? confirm.inUse.length : 0);
              return (
                <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
                  <button className="btn" onClick={() => setConfirm(null)} disabled={busy}>Cancelar</button>
                  <button className="btn primary" onClick={doDelete} disabled={busy || n === 0}>
                    {busy ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />} Mandar {n} a la papelera
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
}

function PapeleraBanco({ rows, reload, canPurge, days }: { rows: BancoTrashed[] | null; reload: () => Promise<void>; canPurge: boolean; days: number }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  if (!rows) return <div className="uploading"><Loader2 size={16} className="spin" /> Cargando…</div>;
  const toggle = (id: string) => setSel((c) => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const ids = [...sel];

  async function run(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    try { await fn(); toast(okMsg, "ok"); setSel(new Set()); await reload(); }
    catch (e) { toast(e instanceof Error ? e.message : "no se pudo", "error"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <p className="muted-note">Lo borrado se conserva {days} días y después se elimina solo.</p>
      {sel.size > 0 && (
        <div className="bn-bar">
          <b>{sel.size}</b> seleccionado{sel.size === 1 ? "" : "s"}
          <button className="btn" onClick={() => setSel(new Set(rows.map((r) => r.id)))}>Seleccionar todo</button>
          <span style={{ flex: 1 }} />
          <button className="btn" disabled={busy} onClick={() => run(() => banco.restore(ids), "Restaurado.")}><RotateCcw size={15} /> Restaurar</button>
          {canPurge && (
            <button className="btn danger-ghost" disabled={busy} onClick={() => { if (window.confirm(`¿Eliminar definitivamente ${ids.length} archivo(s)? No se puede deshacer.`)) void run(() => banco.purge(ids), "Eliminado definitivamente."); }}>
              <Trash2 size={15} /> Eliminar definitivamente
            </button>
          )}
        </div>
      )}
      {rows.length === 0 && <div className="muted-note">La papelera está vacía.</div>}
      <div className="asset-grid bn-grid">
        {rows.map((f) => (
          <div key={f.id} className={"asset-card bn-card" + (sel.has(f.id) ? " sel" : "")}>
            <div className="asset-thumb bn-thumb">
              <Thumb f={f} />
              <label className="bn-check"><input type="checkbox" checked={sel.has(f.id)} onChange={() => toggle(f.id)} aria-label={`Seleccionar ${f.name}`} /></label>
            </div>
            <div className="asset-body">
              <div className="asset-name" title={f.name}>{f.name}</div>
              <div className="bn-meta">{fmtSize(f.size)} · borrado {fmtDate(f.deleted_at)}</div>
              <div className="bn-meta">{f.deleted_by_name ? `por ${f.deleted_by_name} · ` : ""}quedan {f.days_left} día{f.days_left === 1 ? "" : "s"}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
