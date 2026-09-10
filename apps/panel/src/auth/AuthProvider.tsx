import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";

export type Role = "admin" | "editor";
export interface Me {
  id: string;
  email: string | null;
  role: Role;
}

interface AuthState {
  me: Me | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

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
    if (error) throw new Error(error.message);
    await loadMe();
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMe(null);
  }

  return <Ctx.Provider value={{ me, loading, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth fuera de AuthProvider");
  return ctx;
}
