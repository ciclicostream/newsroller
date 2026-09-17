import { env } from "../config/env.js";
import type { DataSource } from "./types.js";

interface TickerItem {
  title: string;
  cats: string[];
}
interface TickerPayload {
  headlines: string[];         // compat
  items: TickerItem[];         // título + categorías (prefijo rojo)
  source: string;
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8230;/g, "…")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .trim();
}

// Titulares del sitio de Cíclico (WordPress RSS) para el zócalo.
export const tickerSource: DataSource<TickerPayload> = {
  id: "ticker",
  label: "Titulares (somosciclico.com)",
  intervalMs: env.tickerFeedMs,
  async fetch() {
    const res = await fetch(env.tickerFeedUrl, { headers: { "user-agent": "NewsRoller/1.0" } });
    if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
    const xml = await res.text();
    const rawItems = xml.split(/<item[\s>]/i).slice(1);
    const items: TickerItem[] = [];
    for (const it of rawItems) {
      const m = /<title>([\s\S]*?)<\/title>/i.exec(it);
      if (!m) continue;
      const title = decode(m[1]!);
      if (!title) continue;
      // Categorías del ítem (WordPress RSS trae varias <category>).
      const cats: string[] = [];
      const re = /<category>([\s\S]*?)<\/category>/gi;
      let cm: RegExpExecArray | null;
      while ((cm = re.exec(it))) {
        const c = decode(cm[1]!);
        if (c) cats.push(c);
      }
      // Si hay 2+, descartar "Actualidad" y quedarse con una.
      const filtered = cats.length > 1 ? cats.filter((c) => c.toLowerCase() !== "actualidad") : cats;
      items.push({ title, cats: filtered.slice(0, 1) });
      if (items.length >= 12) break;
    }
    return { headlines: items.map((i) => i.title), items, source: "somosciclico.com" };
  },
};
