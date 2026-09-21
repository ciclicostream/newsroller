import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { CircleDot, LogIn } from "lucide-react";
import { useAuth, LOGOUT_MSG_KEY } from "../auth/AuthProvider";
import { supabase, supabaseConfigured } from "../lib/supabase";

export function Login() {
  const { me, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [info, setInfo] = useState<string | null>(() => { try { return sessionStorage.getItem(LOGOUT_MSG_KEY); } catch { return null; } });
  // Se llega con #type=recovery desde el mail de "olvidé mi contraseña": ahí
  // Supabase ya abrió una sesión de recuperación y toca elegir una nueva.
  // Los links nuevos vienen con el dominio del panel (?token_hash=…&type=invite|recovery) y se validan acá;
  // los viejos (que pasaban por Supabase) llegan con #type=… y la sesión ya abierta.
  const [query] = useState(() => new URLSearchParams(window.location.search));
  const tokenHash = query.get("token_hash");
  const linkType = query.get("type");
  const [invited] = useState(() => window.location.hash.includes("type=invite") || linkType === "invite");
  const [recovery] = useState(() => window.location.hash.includes("type=recovery") || window.location.hash.includes("type=invite") || linkType === "invite" || linkType === "recovery");
  const [verifying, setVerifying] = useState(!!tokenHash);
  const verified = useRef(false);
  useEffect(() => {
    if (!tokenHash || verified.current) return; // el token es de un solo uso: se valida una única vez
    verified.current = true;
    const type = linkType === "invite" ? "invite" : "recovery";
    supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      .then(({ error }) => {
        window.history.replaceState(null, "", window.location.pathname);
        if (error) setError("El link venció o ya se usó. Pedile a un administrador que te genere uno nuevo.");
      })
      .catch(() => setError("No se pudo validar el link. Probá de nuevo o pedí uno nuevo."))
      .finally(() => setVerifying(false));
  }, [tokenHash, linkType]);
  const [newPass, setNewPass] = useState("");
  const [done, setDone] = useState(false);

  if (!loading && me && !recovery) return <Navigate to="/" replace />;
  if (!loading && me && recovery && done) return <Navigate to={invited ? "/perfil?bienvenida=1" : "/"} replace />;

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null); setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/login` });
      if (error) throw error;
      setInfo("Listo: si el email existe, te mandamos un link para elegir una contraseña nueva.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "no se pudo enviar el mail");
    } finally { setBusy(false); }
  }

  async function onNewPass(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPass.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;
      window.history.replaceState(null, "", window.location.pathname);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "no se pudo cambiar la contraseña");
    } finally { setBusy(false); }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "no se pudo iniciar sesión");
    } finally {
      setBusy(false);
    }
  }

  const brand = (
    <div className="brand">
      <span className="mark"><CircleDot size={16} color="#fff" /></span>
      NewsRoller
    </div>
  );

  if (verifying) {
    return (
      <div className="login-wrap">
        <div className="login-card">{brand}<div className="muted-note">Validando tu invitación…</div></div>
      </div>
    );
  }

  if (recovery && !done && !(tokenHash && error)) {
    return (
      <div className="login-wrap">
        <form className="login-card" onSubmit={onNewPass}>
          {brand}
          {invited && <p style={{ fontSize: 13, color: "#6b7688", margin: "0 0 14px" }}>Bienvenido/a. Elegí tu contraseña para entrar; después completás tu perfil.</p>}
          {error && <div className="alert error">{error}</div>}
          <div className="field">
            <label>{invited ? "Elegí tu contraseña" : "Nueva contraseña"}</label>
            <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required autoFocus minLength={6} />
          </div>
          <button className="btn primary" type="submit" disabled={busy || !me} style={{ width: "100%", justifyContent: "center" }}>
            {busy ? "Guardando…" : me ? "Guardar contraseña" : "Validando link…"}
          </button>
        </form>
      </div>
    );
  }

  if (mode === "forgot") {
    return (
      <div className="login-wrap">
        <form className="login-card" onSubmit={onForgot}>
          {brand}
          <p style={{ fontSize: 13, color: "#6b7688", margin: "0 0 14px" }}>Ingresá tu email y te mandamos un link para elegir una contraseña nueva.</p>
          {error && <div className="alert error">{error}</div>}
          {info && <div className="alert info">{info}</div>}
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <button className="btn primary" type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
            {busy ? "Enviando…" : "Enviar link"}
          </button>
          <button type="button" onClick={() => { setMode("login"); setError(null); setInfo(null); }}
            style={{ marginTop: 14, background: "none", border: 0, color: "#185fa5", cursor: "pointer", font: "inherit", fontSize: 13, width: "100%" }}>
            Volver a ingresar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="brand">
          <span className="mark">
            <CircleDot size={16} color="#fff" />
          </span>
          NewsRoller
        </div>
        {!supabaseConfigured && (
          <div className="alert info">
            Falta configurar Supabase (<code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>).
          </div>
        )}
        {info && <div className="alert info">{info}</div>}
        {error && <div className="alert error">{error}</div>}
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label>Contraseña</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn primary" type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
          <LogIn size={16} /> {busy ? "Ingresando…" : "Ingresar"}
        </button>
        <button type="button" onClick={() => { setMode("forgot"); setError(null); }}
          style={{ marginTop: 14, background: "none", border: 0, color: "#185fa5", cursor: "pointer", font: "inherit", fontSize: 13, width: "100%" }}>
          ¿Olvidaste tu contraseña?
        </button>
      </form>
    </div>
  );
}
