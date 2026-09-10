import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, hasSupabase } from "../config/env.js";

let client: SupabaseClient | null = null;

// Cliente con service_role: solo se usa server-side, nunca se expone al front.
export function getSupabase(): SupabaseClient | null {
  if (!hasSupabase) return null;
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
