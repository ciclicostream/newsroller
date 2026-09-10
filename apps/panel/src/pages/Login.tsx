import { useState } from "react";
import { Navigate } from "react-router-dom";
import { CircleDot, LogIn } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { supabaseConfigured } from "../lib/supabase";

export function Login() {
  const { me, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && me) return <Navigate to="/" replace />;

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
      </form>
    </div>
  );
}
