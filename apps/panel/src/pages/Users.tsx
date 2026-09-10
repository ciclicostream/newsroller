import { useEffect, useState } from "react";
import { UserPlus, Trash2, ShieldCheck, PenLine } from "lucide-react";
import { api } from "../lib/api";
import { useAuth, type Role } from "../auth/AuthProvider";

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  created_at: string;
}

export function Users() {
  const { me } = useAuth();
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
          <p>Administrá quién entra y con qué rol. Administrador: APIs y config. Gestor: contenidos.</p>
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
                      disabled={self}
                      onChange={(e) => changeRole(u, e.target.value as Role)}
                      style={{ width: 190 }}
                    >
                      <option value="admin">Administrador</option>
                      <option value="editor">Gestor de contenidos</option>
                    </select>
                  </td>
                  <td className="muted-note">{new Date(u.created_at).toLocaleDateString("es-AR")}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn danger-ghost" disabled={self} onClick={() => remove(u)}>
                      <Trash2 size={15} /> Eliminar
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !err && (
              <tr>
                <td colSpan={5} className="muted-note">
                  Sin usuarios todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card stat" style={{ marginTop: 18, display: "flex", gap: 22 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <ShieldCheck size={18} color="var(--accent)" />
          <div className="muted-note">
            <b style={{ color: "var(--text)" }}>Administrador</b>: gestiona usuarios, APIs y configuración avanzada.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <PenLine size={18} color="var(--muted)" />
          <div className="muted-note">
            <b style={{ color: "var(--text)" }}>Gestor de contenidos</b>: carga y edita el contenido al aire.
          </div>
        </div>
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("editor");
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
            <option value="editor">Gestor de contenidos</option>
            <option value="admin">Administrador</option>
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
