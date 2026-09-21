import { getSupabase } from "./db/supabase.js";
import type { AuthUser } from "./auth/middleware.js";

// Registro de actividad: quién hizo qué y cuándo. Nunca frena ni rompe la acción que lo origina.
export interface ActivityInput {
  action: string; // ej. "contenido.crear", "parrilla.publicar"
  entity?: string; // ej. "content_item", "usuario"
  entityId?: string | null;
  summary?: string;
  meta?: Record<string, unknown>;
}
let warned = false;

export function logActivity(actor: AuthUser | null | undefined, a: ActivityInput): void {
  const sb = getSupabase();
  if (!sb) return;
  void (async () => {
    try {
      const { error } = await sb.from("activity_log").insert({
        actor_id: actor?.id ?? null,
        actor_name: actor ? actor.full_name || [actor.first_name, actor.last_name].filter(Boolean).join(" ") || actor.email : "sistema",
        actor_role: actor?.role ?? "sistema",
        action: a.action, entity: a.entity ?? null, entity_id: a.entityId ?? null, summary: a.summary ?? null, meta: a.meta ?? {},
      });
      if (error && !warned) { warned = true; console.warn(`[actividad] no se pudo registrar (${error.message}); ¿falta la migración 0016?`); }
    } catch { /* noop */ }
  })();
}
