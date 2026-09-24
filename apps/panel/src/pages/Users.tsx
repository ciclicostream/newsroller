import { useEffect, useState } from "react";
import { UserPlus, Trash2, UserX, UserCheck, ShieldCheck, Link2, Copy, Check } from "lucide-react";
import { ROLE_LABEL, assignableRoles } from "@newsroller/shared";
import { api } from "../lib/api";
import { useAuth, type Role } from "../auth/AuthProvider";
import { Avatar } from "../components/Avatar";

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: Role;
  active: boolean;
  created_at: string;
}

export function Users() {
  const { me, can } = useAuth();
  const roles = me ? assignableRoles(me.role) : [];
  const [rows, setRows] = useState<UserRow[]>([]);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [linkFor, setLinkFor] = useState<{ email: string; link: string; kind: string } | null>(null);

  async function load() {
    try {
      setRows(await api.get<UserRow[]>("/api/users"));
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    }
    api.get<{ id: string }[]>("/api/presence").then((l) => setOnline(new Set(l.map((x) => x.id)))).catch(() => {});
  }
  useEffect(() => {
    void load();
    const t = setInterval(() => api.get<{ id: string }[]>("/api/presence").then((l) => setOnline(new Set(l.map((x) => x.id)))).catch(() => {}), 30_000);
    return () => clearInterval(t);
  }, []);

  async function changeRole(u: UserRow, role: Role) {
    try { await api.patch(`/api/users/${u.id}`, { role }); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "error"); }
  }
  async function setActive(u: UserRow, active: boolean) {
    if (!active && !confirm(`¿Desactivar a ${u.email}? No podrá ingresar hasta que lo actives de nuevo (su historial se conserva).`)) return;
    try { await api.patch(`/api/users/${u.id}`, { active }); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "error"); }
  }
  async function remove(u: UserRow) {
    if (!confirm(`¿Eliminar a ${u.email}? Esta acción no se puede deshacer.`)) return;
    try { await api.del(`/api/users/${u.id}`); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "error"); }
  }
  async function accessLink(u: UserRow) {
    try {
      const r = await api.post<{ link: string; kind: string; email: string }>(`/api/users/${u.id}/link`, {});
      setLinkFor({ email: r.email, link: r.link, kind: r.kind });
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
  }

  const nameOf = (u: UserRow) => u.full_name || [u.first_name, u.last_name].filter(Boolean).join(" ") || null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Usuarios</h1>
          <p>Invitá a alguien con un link, cambiale el rol o desactivalo. Borrar personas es solo del Master.</p>
        </div>
        <button className="btn primary" onClick={() => setShowInvite(true)} style={{ whiteSpace: "nowrap", flex: "none" }}>
          <UserPlus size={16} /> Invitar persona
        </button>
      </div>

      {err && <div className="alert error">{err}</div>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Persona</th>
              <th>Teléfono</th>
              <th>Rol</th>
              <th>Estado</th>
              <th style={{ textAlign: "right" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const self = u.id === me?.id;
              const isOn = online.has(u.id);
              return (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ position: "relative", display: "inline-flex" }}>
                        <Avatar url={u.avatar_url} name={nameOf(u)} email={u.email} size={36} />
                        {isOn && <i className="presence-dot" style={{ width: 11, height: 11 }} />}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{nameOf(u) ?? "Sin nombre"} {self && <span className="muted-note">(vos)</span>}</div>
                        <div className="muted-note" style={{ fontSize: 12 }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="muted-note">{u.phone ?? "—"}</td>
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
                  <td>{!u.active ? <span className="muted-note">Desactivado</span> : isOn ? <span className="pill">Conectado</span> : <span className="muted-note">Activo</span>}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {!self && <button className="btn" onClick={() => accessLink(u)} title="Genera un link para que entre (o cambie su contraseña)"><Link2 size={15} /> Link</button>}
                    {u.active ? (
                      <button className="btn" disabled={self} onClick={() => setActive(u, false)} style={{ marginLeft: 8 }}><UserX size={15} /> Desactivar</button>
                    ) : (
                      <button className="btn" onClick={() => setActive(u, true)} style={{ marginLeft: 8 }}><UserCheck size={15} /> Activar</button>
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
              <tr><td colSpan={5} className="muted-note">Sin usuarios todavía.</td></tr>
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
          ["host", "Como un Programador pero sin programar (no usa Copiloto): opera Stream (la radio manual) y prepara contenidos, sesiones y cámaras. En Ajustes solo ve Shorts, Música y Programas."],
        ].map(([r, d]) => (
          <div key={r} style={{ display: "flex", gap: 10 }}>
            <ShieldCheck size={18} color="var(--accent)" style={{ flex: "none", marginTop: 2 }} />
            <div className="muted-note"><b style={{ color: "var(--text)" }}>{ROLE_LABEL[r as Role]}</b>: {d}</div>
          </div>
        ))}
      </div>

      {showInvite && <InviteModal roles={roles} onClose={() => setShowInvite(false)} onCreated={async (r) => { setShowInvite(false); setLinkFor(r); await load(); }} />}
      {linkFor && <LinkModal {...linkFor} onClose={() => setLinkFor(null)} />}
    </>
  );
}

function InviteModal({ roles, onClose, onCreated }: { roles: Role[]; onClose: () => void; onCreated: (r: { email: string; link: string; kind: string }) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [role, setRole] = useState<Role>(roles.includes("generador") ? "generador" : roles[0]!);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const r = await api.post<{ email: string; link: string }>("/api/users/invite", { email: email.trim(), role, first_name: first.trim(), last_name: last.trim() });
      await onCreated({ email: r.email, link: r.link, kind: "invite" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "no se pudo invitar");
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Invitar persona</h2>
        {err && <div className="alert error">{err}</div>}
        <div className="field"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field"><label>Nombre <i style={{ fontStyle: "normal", color: "#9aa3b8" }}>(opcional)</i></label><input value={first} onChange={(e) => setFirst(e.target.value)} /></div>
          <div className="field"><label>Apellido <i style={{ fontStyle: "normal", color: "#9aa3b8" }}>(opcional)</i></label><input value={last} onChange={(e) => setLast(e.target.value)} /></div>
        </div>
        <div className="field">
          <label>Rol</label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </div>
        <div className="muted-note" style={{ marginBottom: 8 }}>Se genera un link de un solo uso (no se manda ningún mail): lo copiás y se lo pasás por WhatsApp o donde quieras.</div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? "Generando…" : "Generar link"}</button>
        </div>
      </form>
    </div>
  );
}

function LinkModal({ email, link, kind, onClose }: { email: string; link: string; kind: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(link); } catch { /* el navegador no dejó: queda seleccionable */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 520 }}>
        <h2>{kind === "invite" ? "Link de invitación" : "Link para cambiar la contraseña"}</h2>
        <div className="muted-note" style={{ marginBottom: 10 }}>
          Para <b style={{ color: "var(--text)" }}>{email}</b>. Sirve <b>una sola vez</b> y vence en unas 24 horas; si caduca, generá otro. Al abrirlo, la persona elige su contraseña{kind === "invite" ? " y completa su perfil" : ""}.
        </div>
        <textarea readOnly value={link} rows={4} onFocus={(e) => e.currentTarget.select()} style={{ fontSize: 12 }} />
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cerrar</button>
          <button className="btn primary" onClick={copy}>{copied ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar link</>}</button>
        </div>
      </div>
    </div>
  );
}
