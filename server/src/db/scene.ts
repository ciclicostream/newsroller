import type { SupabaseClient } from "@supabase/supabase-js";
import { liveContentItems } from "./contentItems.js";

// Resuelve una lista de bloques (playlist_items o session_items, mismo esquema) a algo auto-contenido
// que el output puede renderizar sin más consultas. Lo usan tanto el aire principal como cada Sesión.
// `depth` evita que una Sesión contenga a otra (el bloque "session" sólo se resuelve en el nivel 0).
export async function resolveSceneItems(sb: SupabaseClient, rows: Array<Record<string, any>>, depth = 0) {
  const publicUrl = (bucket: string, path: string) => sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;

  const [{ data: assets }, { data: placas }, { data: shorts }, { data: templates }, { data: contentItems }] = await Promise.all([
    sb.from("assets").select("*"),
    sb.from("placas").select("*"),
    sb.from("shorts").select("*"),
    sb.from("templates").select("*"),
    liveContentItems(sb, (q) => q.select("*")),
  ]);

  const assetById = new Map((assets ?? []).map((a) => [a.id, a]));
  const placaById = new Map((placas ?? []).map((p) => [p.id, p]));
  const shortById = new Map((shorts ?? []).map((s) => [s.id, s]));
  const templateById = new Map((templates ?? []).map((t) => [t.id, t]));
  const itemById = new Map((contentItems ?? []).map((c) => [c.id, c]));

  const items: Record<string, any>[] = [];
  for (const it of rows) {
    const base = { id: it.id, template: it.template, duration_sec: it.duration_sec, content_type: it.content_type };
    switch (it.content_type) {
      case "short": {
        const s = shortById.get(it.content_id);
        if (s) items.push({ ...base, short: { videoId: s.id, title: s.custom_title ?? s.title, thumb: s.thumbnail_url } });
        break;
      }
      case "placa": {
        const p = placaById.get(it.content_id);
        if (p) items.push({ ...base, placa: { title: p.title, body: p.body, accent: p.accent, image_url: p.image_url, image_fit: p.image_fit } });
        break;
      }
      case "ad":
      case "background": {
        const a = assetById.get(it.content_id);
        if (a) items.push({ ...base, media: { url: publicUrl(a.bucket, a.path), mime: a.mime } });
        break;
      }
      case "data":
        items.push({ ...base, data: { source: it.content_id } });
        break;
      case "template": {
        const t = templateById.get(it.content_id);
        if (t) items.push({ ...base, tpl: { id: t.id, name: t.name, background: t.background, elements: t.elements } });
        break;
      }
      case "content_item": {
        const ci = itemById.get(it.content_id);
        if (ci) items.push({ ...base, item: { id: ci.id, type: ci.type, data: ci.data } });
        break;
      }
      case "session": {
        // Una Sesión detenida, borrada o vacía se saltea acá mismo: el aire principal no llega a mostrarla.
        if (depth > 0) break; // una Sesión no puede contener a otra
        const { data: sess } = await sb.from("sessions").select("id, active").eq("id", it.content_id).maybeSingle();
        if (!sess || sess.active === false) break;
        const { data: subRows } = await sb.from("session_items").select("*").eq("session_id", sess.id).eq("enabled", true).order("sort");
        if (!subRows?.length) break;
        const sub = await resolveSceneItems(sb, subRows, depth + 1);
        if (sub.items.length) items.push({ ...base, session: { id: sess.id, items: sub.items } });
        break;
      }
      default:
        break;
    }
  }

  // Fondo y logos activos (capas globales, compartidas por el aire y las sesiones).
  const activeBg = (assets ?? []).find((a) => a.kind === "background" && a.active);
  const background = activeBg ? { url: publicUrl(activeBg.bucket, activeBg.path), mime: activeBg.mime } : null;
  const logos = (assets ?? []).filter((a) => a.kind === "logo" && a.active).map((a) => ({ url: publicUrl(a.bucket, a.path), name: a.name }));

  return { items, background, logos };
}
