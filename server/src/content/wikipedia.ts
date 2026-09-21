// Sugerencias de efemérides desde el feed público "On this day" de Wikimedia (sin API key):
//   https://api.wikimedia.org/feed/v1/wikipedia/es/onthisday/{holidays|events}/MM/DD
// Se normalizan a algo directamente usable por el formulario de Efemérides. El texto es de Wikipedia
// (CC BY-SA) y colaborativo: el editor lo revisa/edita antes de guardar.

export interface EfemerideSugerida {
  id: string;
  kind: "holiday" | "event";
  group: "internacional" | "argentina" | "santoral" | "otros";
  region: string | null; // país (sólo días propios de un país)
  title: string;
  description: string;
  year?: number; // sólo hechos históricos
  image: { url: string; width: number; height: number } | null;
  page: string | null; // artículo de Wikipedia
}
export interface WikiEfemerides {
  date: string; // MM-DD
  holidays: EfemerideSugerida[];
  events: EfemerideSugerida[];
}

interface WikiImg { source: string; width: number; height: number }
interface WikiPage {
  titles?: { normalized?: string };
  originalimage?: WikiImg;
  thumbnail?: WikiImg;
  content_urls?: { desktop?: { page?: string } };
}
interface WikiItem { text?: string; year?: number; pages?: WikiPage[] }

const BASE = "https://api.wikimedia.org/feed/v1/wikipedia/es/onthisday";
const TTL_MS = 6 * 3600_000;
const cache = new Map<string, { at: number; data: WikiEfemerides }>();

async function feed(kind: "holidays" | "events", mm: string, dd: string): Promise<WikiItem[]> {
  const res = await fetch(`${BASE}/${kind}/${mm}/${dd}`, {
    headers: { accept: "application/json", "user-agent": "NewsRoller/1.0 (efemerides; contacto: paulcaballero@gmail.com)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Wikipedia respondió ${res.status}`);
  const j = (await res.json()) as Record<string, WikiItem[]>;
  return j[kind] ?? [];
}

// Foto del primer artículo relacionado que tenga. Si la original es enorme se pide una miniatura de 960px
// (Wikimedia sólo sirve anchos estándar); si es chica se usa la original.
function pickImage(pages: WikiPage[] | undefined): EfemerideSugerida["image"] {
  for (const p of pages ?? []) {
    const o = p.originalimage, t = p.thumbnail;
    if (!o && !t) continue;
    // Se descartan banderas, escudos, mapas e imágenes diminutas (no sirven de foto vertical en pantalla).
    const probe = (o ?? t)!;
    if (/Flag_of|Bandera|Coat_of_arms|Escudo|Location_map|Mapa|Map_of|\bLogo\b|Blank/i.test(decodeURIComponent(probe.source)) || Math.max(probe.width, probe.height) < 300) continue;
    if (o && t && o.width > 1200 && /\/\d+px-/.test(t.source)) {
      const w = 960;
      return { url: t.source.replace(/\/\d+px-/, `/${w}px-`).split("?")[0]!, width: w, height: Math.round((o.height * w) / o.width) };
    }
    const img = o ?? t!;
    return { url: img.source.split("?")[0]!, width: img.width, height: img.height };
  }
  return null;
}

const SANTORAL = /^(san|santo|santa|santos|santas|beato|beata|beatos|beatas|san\s)/i;
const clean = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
const cut = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…");

// "Argentina Argentina:\nDía del Estudiante.Recuerda…" → { region:"Argentina", title, description }.
// El feed pega el título con la descripción con un "." sin espacio ("Alzheimer.Jornada…").
function parseHoliday(text: string): { region: string | null; title: string; description: string } | null {
  let rest = text;
  let region: string | null = null;
  // Encabezado de país: "Argentina" + bandera + "Argentina:" (con espacio duro) o "México México:".
  const m = /^([^\n]*?):\n/.exec(rest);
  if (m) {
    const head = m[1]!;
    const dup = /^(.+?)[\s\u00a0]+\1$/.exec(head);
    if (head.includes("\u00a0") || dup) {
      region = clean(dup ? dup[1]! : head.split("\u00a0").pop() ?? "") || null;
      rest = rest.slice(m[0].length);
    }
  }
  const lines = rest.split("\n").map((l) => l.trim()).filter(Boolean);
  // Los renglones que terminan en ":" son encabezados ("Celebraciones de san Mateo:"): se anteponen al título.
  const heads: string[] = [];
  let line = "";
  for (const l of lines) {
    if (/:$/.test(l) || /^Por provincias/i.test(l)) { if (!/^Por provincias/i.test(l)) heads.push(l.replace(/:$/, "")); continue; }
    line = l; break;
  }
  if (!line) return null;
  const mm = /^(.{3,160}?)\.(?=[A-ZÁÉÍÓÚÑ¿¡"«])/.exec(line);
  let title = clean((mm ? mm[1]! : line).replace(/\s*\(imagen[^)]*\)\.?/gi, "").replace(/\.$/, ""));
  const description = clean(mm ? line.slice(mm[0].length) : "");
  if (heads.length) title = `${heads.join(": ")}: ${title}`;
  return { region, title, description };
}

const groupOf = (region: string | null, title: string): EfemerideSugerida["group"] =>
  region === "Argentina" ? "argentina" : region ? "otros" : SANTORAL.test(title) ? "santoral" : "internacional";

export async function efemeridesDeWikipedia(mm: string, dd: string): Promise<WikiEfemerides> {
  const key = `${mm}-${dd}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const [hol, ev] = await Promise.all([feed("holidays", mm, dd), feed("events", mm, dd)]);

  const seen = new Set<string>();
  const holidays: EfemerideSugerida[] = [];
  hol.forEach((it, i) => {
    const p = parseHoliday(it.text ?? "");
    if (!p) return;
    const k = `${p.region}|${p.title}`;
    if (seen.has(k)) return; // el mismo día repetido por provincias
    seen.add(k);
    holidays.push({
      id: `h${i}`, kind: "holiday", group: groupOf(p.region, p.title), region: p.region,
      title: p.title, description: p.description, image: pickImage(it.pages),
      page: it.pages?.[0]?.content_urls?.desktop?.page ?? null,
    });
  });
  const order = { internacional: 0, argentina: 1, santoral: 2, otros: 3 } as const;
  holidays.sort((a, b) => order[a.group] - order[b.group]);

  const events: EfemerideSugerida[] = ev
    .filter((it) => it.text && it.year != null)
    .map((it, i) => {
      const text = clean(it.text!).replace(/^\w/, (c) => c.toUpperCase());
      return {
        id: `e${i}`, kind: "event" as const, group: "internacional" as const, region: null,
        title: cut(text, 60), description: cut(text, 400), year: it.year,
        image: pickImage(it.pages), page: it.pages?.[0]?.content_urls?.desktop?.page ?? null,
      };
    })
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

  const data = { date: key, holidays, events };
  cache.set(key, { at: Date.now(), data });
  return data;
}
