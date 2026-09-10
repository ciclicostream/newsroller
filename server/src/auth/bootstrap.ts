import { env } from "../config/env.js";
import { getSupabase } from "../db/supabase.js";

// Promueve a admin los emails de ADMIN_EMAILS (idempotente).
// Sólo afecta a usuarios que ya existen; los que aún no se registraron se ignoran.
export async function ensureAdmins(): Promise<void> {
  const sb = getSupabase();
  if (!sb || env.adminEmails.length === 0) return;
  const { error, data } = await sb
    .from("profiles")
    .update({ role: "admin" })
    .in("email", env.adminEmails)
    .select("email");
  if (error) {
    console.error(`[auth] no se pudieron promover admins: ${error.message}`);
    return;
  }
  if (data?.length) console.log(`[auth] admins asegurados: ${data.map((r) => r.email).join(", ")}`);
}
