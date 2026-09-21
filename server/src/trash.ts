import { getSupabase } from "./db/supabase.js";
import { isTrashReady } from "./db/contentItems.js";
import { logActivity } from "./activity.js";

export const TRASH_DAYS = 30;

// Borra definitivamente lo que lleva más de 30 días en la papelera.
export async function purgeOldTrash(): Promise<number> {
  const sb = getSupabase();
  if (!sb || !isTrashReady()) return 0;
  const cutoff = new Date(Date.now() - TRASH_DAYS * 86_400_000).toISOString();
  const { data, error } = await sb.from("content_items").delete().lt("deleted_at", cutoff).select("id");
  if (error) return 0;
  const n = data?.length ?? 0;
  if (n > 0) logActivity(null, { action: "contenido.purgar", entity: "content_item", summary: `Se eliminaron ${n} contenido(s) con más de ${TRASH_DAYS} días en la papelera`, meta: { count: n } });
  return n;
}
export function startTrashPurger(): void {
  const run = () => void purgeOldTrash().catch(() => {});
  setTimeout(run, 60_000);
  setInterval(run, 6 * 3_600_000);
}
