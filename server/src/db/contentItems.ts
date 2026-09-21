import type { SupabaseClient } from "@supabase/supabase-js";

// La papelera agrega la columna `deleted_at` con una migración. Mientras no esté corrida, todo sigue
// funcionando como antes (sin papelera): se detecta la falta de la columna y se cae al comportamiento viejo.
let trashReady: boolean | null = null;
export const isTrashReady = () => trashReady !== false;
export const markTrashMissing = () => { trashReady = false; };
export const isMissingTrashColumn = (msg?: string) => !!msg && /deleted_at|deleted_by/.test(msg);

// Consulta sobre los contenidos VIVOS (no borrados). `build` arma el select/filtros/orden.
export async function liveContentItems(sb: SupabaseClient, build: (q: any) => any): Promise<{ data: Array<Record<string, any>> | null; error: { message: string } | null }> {
  const attempt = (filter: boolean) => {
    let q = build(sb.from("content_items"));
    if (filter) q = q.is("deleted_at", null);
    return q;
  };
  if (trashReady !== false) {
    const r = await attempt(true);
    if (!r.error) { trashReady = true; return r; }
    if (!isMissingTrashColumn(r.error.message)) return r;
    trashReady = false;
  }
  return attempt(false);
}
