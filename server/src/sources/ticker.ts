import { env } from "../config/env.js";
import type { DataSource } from "./types.js";

interface TickerPayload {
  headlines: string[];
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
    const items = xml.split(/<item[\s>]/i).slice(1);
    const headlines: string[] = [];
    for (const it of items) {
      const m = /<title>([\s\S]*?)<\/title>/i.exec(it);
      if (m) {
        const t = decode(m[1]!);
        if (t) headlines.push(t);
      }
      if (headlines.length >= 12) break;
    }
    return { headlines, source: "somosciclico.com" };
  },
};
