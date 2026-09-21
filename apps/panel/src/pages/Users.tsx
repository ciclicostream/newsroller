import { useEffect, useState } from "react";
import { UserPlus, Trash2, UserX, UserCheck, ShieldCheck } from "lucide-react";
import { ROLE_LABEL, assignableRoles } from "@newsroller/shared";
import { api } from "../lib/api";
import { useAuth, type Role } from "../auth/AuthProvider";

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  active: boolean;
  created_at: string;
}

export function Users() {
  const { me, can } = useAuth();
  const roles = me ? assignableRoles(me.role) : [];
  const [rows, setRows] = useState<UserRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    try {
      setRows(await api.get<UserRow[]>("/api/users"));
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function changeRole(u: UserRow, role: Role) {
    try {
      await api.patch(`/api/users/${u.id}`, { role });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    }
  }

  async function setActive(u: UserRow, active: boolean) {
    if (!active && !confirm(`¿Desactivar a ${u.email}? No podrá ingresar hasta que lo actives de nuevo (su historial se conserva).`)) return;
    try {
      await api.patch(`/api/users/${u.id}`, { active });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    }
  }

  async function remove(u: UserRow) {
    if (!confirm(`¿Eliminar a ${u.email}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.del(`/api/users/${u.id}`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Usuarios</h1>
          <p>Quién entra y con qué rol. Podés desactivar personas; borrarlas es solo del Master.</p>
        </div>
        <button className="btn primary" onClick={() => setShowCreate(true)}>
          <UserPlus size={16} /> Nuevo usuario
        </button>
      </div>

      {err && <div className="alert error">{err}</div>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Creado</th>
              <th style={{ textAlign: "right" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const self = u.id === me?.id;
              return (
                <tr key={u.id}>
                  <td>
                    {u.email} {self && <span className="muted-note">(vos)</span>}
                  </td>
                  <td>{u.full_name ?? "—"}</td>
                  <td>
                    <select
                      value={u.role}
                      disabled={self || !roles.includes(u.role)}
                      onChange={(e) => changeRole(u, e.target.value as Role)}
                      style={{ width: 210 }}
                    >
                      {(roles.includes(u.role) ? roles : [u.role, ...roles]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  </td>
                  <td>{u.active ? <span className="pill">Activo</span> : <span className="muted-note">Desactivado</span>}</td>
                  <td className="muted-note">{new Date(u.created_at).toLocaleDateString("es-AR")}</td>
                  <td style={{ textAlign: "right" }}>
                    {u.active ? (
                      <button className="btn" disabled={self} onClick={() => setActive(u, false)}><UserX size={15} /> Desactivar</button>
                    ) : (
                      <button className="btn" onClick={() => setActive(u, true)}><UserCheck size={15} /> Activar</button>
                    )}
                    {can("eliminar_personas") && (
                      <button className="btn danger-ghost" disabled={self} onClick={() => remove(u)} style={{ marginLeft: 8 }}>
                        <Trash2 size={15} /> Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !err && (
              <tr>
                <td colSpan={6} className="muted-note">
                  Sin usuarios todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card stat" style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 16 }}>
        {[
          ["master", "Control total: APIs, plantillas, personas y configuración. Invisible para los demás."],
          ["administrador", "Programa, contenidos, cámaras, reportes y ajustes; ve las plantillas; invita y desactiva personas (sin tocar al Master)."],
          ["programador", "Programa, gestiona contenidos, agrega cámaras y usa los ajustes; ve el estado de las fuentes."],
          ["generador", "Solo genera contenidos (ve los de todos, edita los suyos) y gestiona su propio perfil."],
        ].map(([r, d]) => (
          <div key={r} style={{ display: "flex", gap: 10 }}>
            <ShieldCheck size={18} color="var(--accent)" style={{ flex: "none", marginTop: 2 }} />
            <div className="muted-note"><b style={{ color: "var(--text)" }}>{ROLE_LABEL[r as Role]}</b>: {d}</div>
          </div>
        ))}
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const { me } = useAuth();
  const allowed = me ? assignableRoles(me.role) : [];
  const [role, setRole] = useState<Role>("generador");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.post("/api/users", { email: email.trim(), full_name: fullName.trim(), password, role });
      await onCreated();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "no se pudo crear");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Nuevo usuario</h2>
        {err && <div className="alert error">{err}</div>}
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label>Nombre</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="field">
          <label>Contraseña provisoria (mín. 8)</label>
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </div>
        <div className="field">
          <label>Rol</label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {allowed.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Creando…" : "Crear usuario"}
          </button>
        </div>
      </form>
    </div>
  );
}
