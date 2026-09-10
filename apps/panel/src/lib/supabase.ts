import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anon);

// Cliente de auth del front (clave anon). La service_role jamás vive en el front.
export const supabase = createClient(url ?? "http://localhost", anon ?? "anon-key-missing", {
  auth: { persistSession: true, autoRefreshToken: true },
});
