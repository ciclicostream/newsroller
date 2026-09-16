import { env } from "../config/env.js";
import type { DataSource } from "./types.js";

export interface CiclicoPost {
  id: number;
  title: string;
  excerpt: string;
  link: string;
  date: string;
  image: string | null;
  categories: string[];
  youtube: string | null;
}

interface CiclicoWebPayload {
  posts: CiclicoPost[];
  source: string;
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8217;|&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8230;/g, "…")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&hellip;/g, "…")
    .replace(/\s+/g, " ")
    .trim();
}

function ytId(html: string): string | null {
  const m =
    html.match(/youtube\.com\/embed\/([\w-]{11})/) ||
    html.match(/youtu\.be\/([\w-]{11})/) ||
    html.match(/[?&]v=([\w-]{11})/);
  return m ? m[1]! : null;
}

// Notas del sitio de Cíclico vía WordPress REST API (title, bajada, imagen, categorías, YouTube).
export const ciclicoWebSource: DataSource<CiclicoWebPayload> = {
  id: "ciclico-web",
  label: "Notas (somosciclico.com)",
  intervalMs: env.ciclicoWebMs,
  async fetch() {
    const url = `${env.ciclicoWebUrl}?per_page=12&_embed=1`;
    const res = await fetch(url, { headers: { "user-agent": "NewsRoller/1.0", accept: "application/json" } });
    if (!res.ok) throw new Error(`ciclico-web HTTP ${res.status}`);
    const raw = (await res.json()) as any[];

    const posts: CiclicoPost[] = raw.map((p) => {
      const embedded = p._embedded ?? {};
      const media = embedded["wp:featuredmedia"]?.[0];
      const image: string | null =
        media?.media_details?.sizes?.medium_large?.source_url ??
        media?.source_url ??
        null;
      const termGroups: any[][] = embedded["wp:term"] ?? [];
      const categories = termGroups
        .flat()
        .filter((t) => t?.taxonomy === "category")
        .map((t) => t.name as string);
      const contentHtml = p.content?.rendered ?? "";
      return {
        id: p.id,
        title: stripHtml(p.title?.rendered ?? ""),
        excerpt: stripHtml(p.excerpt?.rendered ?? ""),
        link: p.link ?? "",
        date: p.date ?? "",
        image,
        categories,
        youtube: ytId(contentHtml),
      };
    });

    return { posts, source: "somosciclico.com" };
  },
};
