import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { can as canRole, type Perm, type Role } from "@newsroller/shared";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";

export type { Role };
export interface Me {
  id: string;
  email: string | null;
  role: Role;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  perms: Perm[];
  idleMinutes: number;
}

interface AuthState {
  me: Me | null;
  loading: boolean;
  can: (perm: Perm) => boolean;
  reload: () => Promise<void>; // vuelve a leer el perfil (después de editarlo)
  signIn: (email: string, password: string) => Promise<void>;
  signOut: (reason?: "idle" | "disabled") => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);
export const LOGOUT_MSG_KEY = "ciclico-logout-msg";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadMe() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setMe(null);
      return;
    }
    try {
      setMe(await api.get<Me>("/api/me"));
    } catch {
      setMe(null);
    }
  }

  useEffect(() => {
    void loadMe().finally(() => setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void loadMe();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Se avisa al server para el reporte de seguridad (ingresos fallidos). Nunca frena el mensaje de error.
      void api.post("/api/security/login-attempt", { email }).catch(() => {});
      throw new Error(error.message);
    }
    try { sessionStorage.removeItem(LOGOUT_MSG_KEY); } catch { /* noop */ }
    // Abre la sesión registrada (inactividad y reportes). Si falla, se entra igual.
    try { await api.post("/api/session/start", {}); } catch { /* noop */ }
    await loadMe();
  }

  const signOut = useCallback(async (reason?: "idle" | "disabled") => {
    if (reason) {
      try {
        sessionStorage.setItem(LOGOUT_MSG_KEY, reason === "idle" ? "Tu sesión se cerró por inactividad. Volvé a ingresar." : "Tu usuario está desactivado. Consultá con un administrador.");
      } catch { /* noop */ }
    } else {
      try { await api.post("/api/session/end", {}); } catch { /* noop */ }
    }
    await supabase.auth.signOut();
    setMe(null);
  }, []);

  // El servidor avisa (401 "idle" / 403 "disabled") que la sesión terminó.
  useEffect(() => {
    const onEnded = (e: Event) => void signOut((e as CustomEvent<string>).detail === "disabled" ? "disabled" : "idle");
    window.addEventListener("ciclico:session-ended", onEnded);
    return () => window.removeEventListener("ciclico:session-ended", onEnded);
  }, [signOut]);

  const can = useCallback((perm: Perm) => canRole(me?.role, perm), [me]);

  return <Ctx.Provider value={{ me, loading, can, reload: loadMe, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth fuera de AuthProvider");
  return ctx;
}
