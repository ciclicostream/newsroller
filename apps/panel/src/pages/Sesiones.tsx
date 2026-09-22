import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FilePlus2, Link2, Loader2, Pencil, Plus, Trash2, Users as UsersIcon } from "lucide-react";
import { ROLE_LABEL } from "@newsroller/shared";
import { useAuth } from "../auth/AuthProvider";
import { api } from "../lib/api";
import { sessions, type SessionRow } from "../lib/sessions";
import { OutputLinksPicker } from "../components/OutputLinksPicker";
import { toast } from "../lib/toast";

interface UserRow { id: string; email: string | null; full_name: string | null; role: string }

// Sesiones: playlists independientes del aire principal, cada una con su propia URL de salida.
// Master/Administrador ven y gestionan todas; Programador/Generador sólo las que les asignaron.
export function Sesiones() {
  const { me, can } = useAuth();
  const isAdmin = can("sesiones_admin");
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [people, setPeople] = useState<UserRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [busyAvail, setBusyAvail] = useState<string | null>(null);

  const load = () => sessions.list().then(setRows).catch((e) => setErr(e.message));
  useEffect(() => {
    void load();
    if (isAdmin) api.get<UserRow[]>("/api/users").then(setPeople).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try { await sessions.create(newName.trim()); setNewName(""); await load(); }
    catch (er) { toast(er instanceof Error ? er.message : "no se pudo crear", "error"); }
    finally { setCreating(false); }
  }
  async function toggle(s: SessionRow) {
    setBusy(s.id);
    try { await sessions.toggle(s.id, !s.active); await load(); toast(s.active ? "Sesión detenida." : "Sesión reanudada.", "ok"); }
    catch (er) { toast(er instanceof Error ? er.message : "no se pudo cambiar el estado", "error"); }
    finally { setBusy(null); }
  }
  // Aparece o no en "Contenidos disponibles" de Emisión — independiente de si está en vivo en su link.
  async function setAvailable(s: SessionRow) {
    setBusyAvail(s.id);
    try { await sessions.setAvailable(s.id, s.in_parrilla === false); await load(); toast(s.in_parrilla === false ? "Vuelve a aparecer en Contenidos disponibles de Emisión." : "Ya no aparece en Contenidos disponibles de Emisión.", "ok"); }
    catch (er) { toast(er instanceof Error ? er.message : "no se pudo cambiar", "error"); }
    finally { setBusyAvail(null); }
  }
  async function remove(s: SessionRow) {
    if (!confirm(`¿Borrar la sesión "${s.name}"? Se pierde su lista de contenidos.`)) return;
    try { await sessions.remove(s.id); await load(); }
    catch (er) { toast(er instanceof Error ? er.message : "no se pudo borrar", "error"); }
  }
  async function rename(s: SessionRow, name: string) {
    try { await sessions.rename(s.id, name); await load(); }
    catch (er) { toast(er instanceof Error ? er.message : "no se pudo renombrar", "error"); throw er; }
  }
  async function saveManagers(s: SessionRow, userIds: string[]) {
    try { await sessions.setManagers(s.id, userIds); await load(); }
    catch (er) { toast(er instanceof Error ? er.message : "no se pudo guardar", "error"); throw er; }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Sesiones</h1>
          <p>Playlists independientes del aire, cada una con su propia URL para transmitir.</p>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}

      {isAdmin && (
        <form className="card" style={{ padding: 16, marginBottom: 18, display: "flex", gap: 10 }} onSubmit={create}>
          <input value={newName} onChange={(e) => setNewName(e.target.value.slice(0, 60))} placeholder="Nombre de la sesión (ej.: Maratón de shorts)" />
          <button className="btn primary" type="submit" disabled={creating || !newName.trim()}>
            {creating ? <Loader2 size={15} className="spin" /> : <Plus size={15} />} Crear
          </button>
        </form>
      )}

      {rows == null ? (
        <div className="muted-note">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ padding: 22, textAlign: "center" }}>
          <div className="muted-note">{isAdmin ? "Todavía no hay sesiones. Creá la primera." : "Todavía no te asignaron ninguna sesión."}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {rows.map((s) => (
            <SessionCard
              key={s.id} s={s} isAdmin={isAdmin} mine={s.manager_ids.includes(me?.id ?? "")} people={people}
              busy={busy === s.id} onToggle={() => toggle(s)}
              busyAvail={busyAvail === s.id} onSetAvailable={() => setAvailable(s)}
              onRename={(name) => rename(s, name)}
              onSaveManagers={(ids) => saveManagers(s, ids)}
              onRemove={() => remove(s)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type Expand = "links" | "rename" | "manage" | null;

function SessionCard({ s, isAdmin, mine, people, busy, onToggle, busyAvail, onSetAvailable, onRename, onSaveManagers, onRemove }: {
  s: SessionRow; isAdmin: boolean; mine: boolean; people: UserRow[]; busy: boolean;
  onToggle: () => void; busyAvail: boolean; onSetAvailable: () => void;
  onRename: (name: string) => Promise<void>; onSaveManagers: (userIds: string[]) => Promise<void>; onRemove: () => void;
}) {
  const canManage = isAdmin || mine;
  const [expand, setExpand] = useState<Expand>(null);
  const available = s.in_parrilla !== false;
  const navigate = useNavigate();
  const stop = (e: React.MouseEvent, fn: () => void) => { e.stopPropagation(); fn(); };
  const toggleExpand = (v: Expand) => setExpand((cur) => (cur === v ? null : v));
  return (
    <div className="card sess-card" style={{ padding: 14, cursor: canManage ? "pointer" : "default" }}
      onClick={canManage ? () => navigate(`/sesiones/${s.id}`) : undefined} title={canManage ? "Gestionar contenidos" : undefined}>
      <div className="sess-bar">
        <div className="sess-bar-l">
          {canManage ? (
            <button className={"toggle-pill" + (s.active ? " on" : "")} disabled={busy} onClick={(e) => stop(e, onToggle)} title={s.active ? "Detener (corte de emergencia)" : "Reanudar"}>
              {busy ? <Loader2 size={13} className="spin" /> : s.active && <span className="live-dot" />} {s.active ? "En vivo" : "Detenida"}
            </button>
          ) : (
            <span className={"toggle-pill" + (s.active ? " on" : "")}>{s.active && <span className="live-dot" />}{s.active ? "En vivo" : "Detenida"}</span>
          )}
          <span className="sess-name" title={s.name}>{s.name}</span>
        </div>
        <div className="sess-bar-r">
          {isAdmin && <button className={"sess-icon" + (expand === "manage" ? " on" : "")} onClick={(e) => stop(e, () => toggleExpand("manage"))} title="Asignar personas"><UsersIcon size={16} /></button>}
          {isAdmin && <button className={"sess-icon" + (expand === "rename" ? " on" : "")} onClick={(e) => stop(e, () => toggleExpand("rename"))} title="Renombrar"><Pencil size={16} /></button>}
          {isAdmin && <span className="sess-sep" />}
          <span className="sess-num" title="Contenidos"><FilePlus2 size={13} /> {s.item_count}</span>
          <span className="sess-num" title="Duración total">{fmtDur(s.total_duration_sec)} total</span>
          <span className="sess-sep" />
          {canManage && <button className={"sess-icon" + (expand === "links" ? " on" : "")} onClick={(e) => stop(e, () => toggleExpand("links"))} title="Enlaces para transmitir"><Link2 size={16} /></button>}
          {canManage && (
            <button className={"sw-toggle" + (available ? " on" : "")} disabled={busyAvail} onClick={(e) => stop(e, onSetAvailable)} aria-pressed={available}
              title={available ? "Disponible en Contenidos de Emisión — click para sacarla" : "No aparece en Contenidos de Emisión — click para ofrecerla"} />
          )}
          {isAdmin && <button className="sess-icon danger" onClick={(e) => stop(e, onRemove)} title="Borrar"><Trash2 size={16} /></button>}
        </div>
      </div>
      {expand === "links" && canManage && <div style={{ marginTop: 12 }} onClick={(e) => e.stopPropagation()}><OutputLinksPicker extraParams={{ session: s.id }} /></div>}
      {expand === "rename" && isAdmin && <RenameInline name={s.name} onSave={onRename} onDone={() => setExpand(null)} />}
      {expand === "manage" && isAdmin && <ManageInline session={s} people={people} onSave={onSaveManagers} onDone={() => setExpand(null)} />}
    </div>
  );
}

// Panel desplegado (no modal) para renombrar, igual en estilo a "Enlaces para transmitir".
function RenameInline({ name, onSave, onDone }: { name: string; onSave: (name: string) => Promise<void>; onDone: () => void }) {
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setSaving(true);
    try { await onSave(value.trim()); onDone(); } finally { setSaving(false); }
  }
  return (
    <form className="card lp" style={{ marginTop: 12, display: "flex", gap: 10 }} onClick={(e) => e.stopPropagation()} onSubmit={save}>
      <input value={value} onChange={(e) => setValue(e.target.value.slice(0, 60))} autoFocus required style={{ flex: 1 }} />
      <button type="submit" className="btn primary btn-sm" disabled={saving || !value.trim()}>{saving ? <Loader2 size={13} className="spin" /> : "Guardar"}</button>
    </form>
  );
}

// Panel desplegado (no modal) para asignar Programadores/Generadores a esta sesión.
function ManageInline({ session, people, onSave, onDone }: { session: SessionRow; people: UserRow[]; onSave: (userIds: string[]) => Promise<void>; onDone: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(session.manager_ids));
  const [saving, setSaving] = useState(false);
  const assignable = people.filter((p) => p.role === "programador" || p.role === "generador");

  async function save() {
    setSaving(true);
    try { await onSave([...selected]); onDone(); } finally { setSaving(false); }
  }

  return (
    <div className="card lp" style={{ marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div className="lp-hd" style={{ margin: 0 }}>Quién gestiona "{session.name}"</div>
        <button type="button" className="btn primary btn-sm" disabled={saving} onClick={save}>{saving ? "Guardando…" : "Guardar"}</button>
      </div>
      <div className="mng-grid">
        {assignable.length === 0 && <div className="muted-note">No hay Programadores ni Generadores todavía.</div>}
        {assignable.map((p) => (
          <label key={p.id} className={"mng-row" + (selected.has(p.id) ? " on" : "")}>
            <input type="checkbox" checked={selected.has(p.id)} style={{ width: 16, height: 16, flex: "none" }} onChange={(e) => setSelected((s) => { const n = new Set(s); e.target.checked ? n.add(p.id) : n.delete(p.id); return n; })} />
            <span className="mng-name">{p.full_name || p.email}</span>
            <span className="mng-role">{ROLE_LABEL[p.role as keyof typeof ROLE_LABEL] ?? p.role}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
