import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

const API = "https://www.googleapis.com/youtube/v3";

// Duración ISO 8601 (PT#H#M#S) -> segundos.
function isoToSec(d: string): number {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d);
  if (!m) return 0;
  return (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + (+(m[3] ?? 0));
}

async function yt<T>(path: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${API}/${path}${sep}key=${env.youtubeApiKey}`);
  const json = (await res.json()) as { error?: { message?: string } } & T;
  if (!res.ok) throw new Error(json?.error?.message ?? `YouTube HTTP ${res.status}`);
  return json as T;
}

interface ChannelsResp {
  items?: { contentDetails: { relatedPlaylists: { uploads: string } } }[];
}
interface PlaylistItem {
  snippet: {
    title: string;
    publishedAt: string;
    resourceId: { videoId: string };
    thumbnails?: Record<string, { url: string }>;
  };
}
interface PlaylistResp {
  items?: PlaylistItem[];
}
interface VideosResp {
  items?: { id: string; contentDetails: { duration: string } }[];
}

// Umbral de duración para considerar "short" (YouTube: hasta 3 min).
const SHORT_MAX_SEC = 180;

// Trae los últimos uploads del canal, filtra shorts y los upsertea preservando
// custom_title / active / sort de los que ya estaban.
export async function syncShorts(sb: SupabaseClient): Promise<number> {
  if (!env.youtubeApiKey) throw new Error("falta YOUTUBE_API_KEY");

  const ch = await yt<ChannelsResp>(
    `channels?part=contentDetails&forHandle=${encodeURIComponent(env.youtubeChannelHandle)}`,
  );
  const uploads = ch.items?.[0]?.contentDetails.relatedPlaylists.uploads;
  if (!uploads) throw new Error(`no se encontró el canal @${env.youtubeChannelHandle}`);

  const list = await yt<PlaylistResp>(
    `playlistItems?part=snippet&maxResults=50&playlistId=${uploads}`,
  );
  const items = list.items ?? [];
  if (items.length === 0) return 0;

  const ids = items.map((i) => i.snippet.resourceId.videoId);
  const vids = await yt<VideosResp>(`videos?part=contentDetails&id=${ids.join(",")}`);
  const durById = new Map(vids.items?.map((v) => [v.id, isoToSec(v.contentDetails.duration)]));

  const rows = items
    .map((i) => {
      const id = i.snippet.resourceId.videoId;
      const dur = durById.get(id) ?? 0;
      const th = i.snippet.thumbnails ?? {};
      const thumb = (th.medium ?? th.high ?? th.default)?.url ?? null;
      return {
        id,
        title: i.snippet.title,
        thumbnail_url: thumb,
        duration_sec: dur,
        published_at: i.snippet.publishedAt,
        synced_at: new Date().toISOString(),
      };
    })
    .filter((r) => r.duration_sec > 0 && r.duration_sec <= SHORT_MAX_SEC);

  if (rows.length === 0) return 0;

  // upsert por id: no incluye custom_title/active/sort, así se preservan los editados.
  const { error } = await sb.from("shorts").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`supabase upsert shorts: ${error.message}`);
  return rows.length;
}
