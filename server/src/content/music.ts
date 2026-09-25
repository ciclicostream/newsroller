// Búsqueda de temas para el audio de Listas. Sin API key: Deezer devuelve un preview de 30 s por tema y
// iTunes Search hace de respaldo. Los links de preview vencen, así que el panel los importa al bucket
// "media" en cuanto el editor elige un tema (importRemote).
//   Deezer:  https://api.deezer.com/search?q=...
//   iTunes:  https://itunes.apple.com/search?term=...&media=music&entity=song

export interface MusicResult {
  id: string;
  title: string; // tema
  artist: string;
  album: string;
  cover: string | null; // tapa grande
  preview: string; // mp3/m4a de ~30 s
  source: "deezer" | "itunes";
}

const UA = { "User-Agent": "NewsRoller/1.0" };
const TIMEOUT_MS = 8000;

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${new URL(url).hostname} respondió ${res.status}`);
  return res.json();
}

async function deezer(q: string): Promise<MusicResult[]> {
  const j = await getJson(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=10`);
  if (j?.error) throw new Error(String(j.error.message ?? "deezer"));
  return ((j?.data ?? []) as any[])
    .filter((t) => t?.preview)
    .map((t) => ({
      id: `dz-${t.id}`,
      title: String(t.title ?? ""),
      artist: String(t.artist?.name ?? ""),
      album: String(t.album?.title ?? ""),
      cover: t.album?.cover_xl ?? t.album?.cover_big ?? t.album?.cover_medium ?? null,
      preview: String(t.preview),
      source: "deezer" as const,
    }));
}

async function itunes(q: string): Promise<MusicResult[]> {
  const j = await getJson(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=10&country=AR`);
  return ((j?.results ?? []) as any[])
    .filter((t) => t?.previewUrl)
    .map((t) => ({
      id: `it-${t.trackId}`,
      title: String(t.trackName ?? ""),
      artist: String(t.artistName ?? ""),
      album: String(t.collectionName ?? ""),
      cover: typeof t.artworkUrl100 === "string" ? t.artworkUrl100.replace(/\/\d+x\d+bb\./, "/600x600bb.") : null,
      preview: String(t.previewUrl),
      source: "itunes" as const,
    }));
}

// Deezer primero; si falla o no trae nada, iTunes.
export async function searchMusic(q: string): Promise<MusicResult[]> {
  const query = q.trim();
  if (!query) return [];
  let err: unknown = null;
  try {
    const r = await deezer(query);
    if (r.length) return r;
  } catch (e) { err = e; }
  try {
    return await itunes(query);
  } catch (e) {
    throw err ?? e;
  }
}

// Sólo se descargan previews y tapas de estos dominios (el endpoint de importación no es un proxy abierto).
const ALLOWED_HOSTS = /(^|\.)(dzcdn\.net|deezer\.com|mzstatic\.com|itunes\.apple\.com)$/i;
const MAX_BYTES = 8 * 1024 * 1024;
const EXT: Record<string, string> = { "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "m4a", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function importRemote(url: string, kind: "audio" | "image"): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  let u: URL;
  try { u = new URL(url); } catch { throw new Error("url inválida"); }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("url inválida");
  if (!ALLOWED_HOSTS.test(u.hostname)) throw new Error("origen no permitido");
  const res = await fetch(u, { headers: UA, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`no se pudo descargar (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_BYTES) throw new Error("el archivo es demasiado grande");
  const ct = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  const contentType = ct.startsWith(kind + "/") ? ct : kind === "audio" ? "audio/mpeg" : "image/jpeg";
  return { buffer, contentType, ext: EXT[contentType] ?? (kind === "audio" ? "mp3" : "jpg") };
}
