import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Camera, Loader2, Trash2, Save, KeyRound } from "lucide-react";
import { ROLE_LABEL } from "@newsroller/shared";
import { useAuth } from "../auth/AuthProvider";
import { Avatar } from "../components/Avatar";
import { profileApi, uploadAvatar } from "../lib/profile";
import { supabase } from "../lib/supabase";

// Mi perfil: lo ve y lo edita cada persona (también el Generador de contenidos): foto, nombre, apellido,
// teléfono y contraseña.
export function Perfil() {
  const { me, reload } = useAuth();
  const [params] = useSearchParams();
  const [first, setFirst] = useState(me?.first_name ?? "");
  const [last, setLast] = useState(me?.last_name ?? "");
  const [phone, setPhone] = useState(me?.phone ?? "");
  const [photo, setPhoto] = useState<string | null>(me?.avatar_url ?? null);
  const [busy, setBusy] = useState<"save" | "photo" | "pass" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Si el perfil se cargó después de montar la página.
  useEffect(() => { if (me) { setFirst(me.first_name ?? ""); setLast(me.last_name ?? ""); setPhone(me.phone ?? ""); setPhoto(me.avatar_url ?? null); } }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const ok = (m: string) => { setMsg(m); setErr(null); setTimeout(() => setMsg(null), 3000); };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save"); setErr(null);
    try { await profileApi.update({ first_name: first, last_name: last, phone }); await reload(); ok("Perfil guardado."); }
    catch (er) { setErr(er instanceof Error ? er.message : "error"); }
    finally { setBusy(null); }
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("photo"); setErr(null);
    try {
      const url = await uploadAvatar(file);
      await profileApi.update({ avatar_url: url });
      setPhoto(url); await reload(); ok("Foto actualizada.");
    } catch (er) { setErr(er instanceof Error ? er.message : "no se pudo subir la foto"); }
    finally { setBusy(null); }
  }
  async function removePhoto() {
    setBusy("photo"); setErr(null);
    try { await profileApi.update({ avatar_url: "" as unknown as null }); setPhoto(null); await reload(); ok("Foto quitada."); }
    catch (er) { setErr(er instanceof Error ? er.message : "error"); }
    finally { setBusy(null); }
  }

  async function changePass(e: React.FormEvent) {
    e.preventDefault();
    if (pass.length < 8) return setErr("La contraseña debe tener al menos 8 caracteres.");
    if (pass !== pass2) return setErr("Las contraseñas no coinciden.");
    setBusy("pass"); setErr(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) throw new Error(error.message);
      setPass(""); setPass2(""); ok("Contraseña cambiada.");
    } catch (er) { setErr(er instanceof Error ? er.message : "error"); }
    finally { setBusy(null); }
  }

  const incomplete = !me?.first_name || !me?.last_name;
  const fullName = `${first} ${last}`.trim();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mi perfil</h1>
          <p>Tus datos personales y tu contraseña.</p>
        </div>
      </div>

      {(params.get("bienvenida") || incomplete) && <div className="alert info">Completá tu perfil: nombre, apellido, teléfono y foto, así el equipo sabe quién es quién.</div>}
      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,300px) minmax(0,1fr)", gap: 20, alignItems: "start", maxWidth: 900 }}>
        <div className="card" style={{ padding: 22, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
            <Avatar url={photo} name={fullName || me?.full_name} email={me?.email} size={132} />
            {busy === "photo" && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 size={26} className="spin" /></div>}
          </div>
          <div style={{ fontWeight: 700, marginTop: 14 }}>{fullName || me?.email}</div>
          <div className="muted-note">{me ? ROLE_LABEL[me.role] : ""}</div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPhoto} />
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
            <button className="btn" disabled={busy != null} onClick={() => fileRef.current?.click()}><Camera size={15} /> {photo ? "Cambiar foto" : "Subir foto"}</button>
            {photo && <button className="btn" disabled={busy != null} onClick={removePhoto} title="Quitar la foto"><Trash2 size={15} /></button>}
          </div>
          <div className="muted-note" style={{ marginTop: 10, fontSize: 12 }}>Se recorta en cuadrado. Cualquier imagen sirve.</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <form className="card" style={{ padding: 20 }} onSubmit={save}>
            <div style={{ fontWeight: 600, marginBottom: 14 }}>Datos personales</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field"><label>Nombre</label><input value={first} onChange={(e) => setFirst(e.target.value)} maxLength={60} required /></div>
              <div className="field"><label>Apellido</label><input value={last} onChange={(e) => setLast(e.target.value)} maxLength={60} required /></div>
            </div>
            <div className="field"><label>Teléfono</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+54 9 11 5555 5555" maxLength={30} /></div>
            <div className="field"><label>Email</label><input value={me?.email ?? ""} disabled /></div>
            <button className="btn primary" type="submit" disabled={busy != null}><Save size={15} /> {busy === "save" ? "Guardando…" : "Guardar"}</button>
          </form>

          <form className="card" style={{ padding: 20 }} onSubmit={changePass}>
            <div style={{ fontWeight: 600, marginBottom: 14 }}>Contraseña</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field"><label>Nueva contraseña</label><input type="password" value={pass} onChange={(e) => setPass(e.target.value)} minLength={8} autoComplete="new-password" /></div>
              <div className="field"><label>Repetirla</label><input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} minLength={8} autoComplete="new-password" /></div>
            </div>
            <button className="btn" type="submit" disabled={busy != null || !pass}><KeyRound size={15} /> {busy === "pass" ? "Cambiando…" : "Cambiar contraseña"}</button>
          </form>
        </div>
      </div>
    </>
  );
}
