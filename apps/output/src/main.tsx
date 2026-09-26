import { P, applyLinkConfig, slugFromPath, type LinkConfig } from "./lib/params";
import { boot } from "./lib/boot";

// Arranque del output. Antes de cargar la app:
//  1. Si la ruta es un link con nombre (/output/<slug>), pide su configuración al server y la aplica.
//  2. Si es un link viejo con variables y en Ajustes se apagaron, muestra el aviso y no emite.
//     (Los monitores del panel van dentro de un iframe y las demos/previews son internas: siguen andando.)
//  3. Trae la colección por defecto (la primera habilitada) para los outputs sin suite.
const API = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function notice(text: string): void {
  const root = document.getElementById("root")!;
  root.innerHTML = "";
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;inset:0;background:#000;color:#8a93a6;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;font:500 18px Inter,system-ui,sans-serif";
  box.textContent = text;
  root.appendChild(box);
}

async function start(): Promise<void> {
  const slug = slugFromPath();
  const settings = await fetch(`${API}/api/settings`).then((r) => r.json()).catch(() => null) as Record<string, unknown> | null;
  if (slug) {
    const cfg = await fetch(`${API}/api/output/link/${encodeURIComponent(slug)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) as LinkConfig | null;
    if (!cfg) return notice("Este link no existe. Pedí el link correcto en el panel.");
    applyLinkConfig(cfg);
    boot.link = { ...cfg, slug };
  } else if (P.get("suite")) {
    // Iframe interno del Stream: sigue la colección de la suite que lo contiene, sin tomar su orientación ni audio.
    const s = P.get("suite")!;
    const cfg = await fetch(`${API}/api/output/link/${encodeURIComponent(s)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) as LinkConfig | null;
    if (cfg) boot.link = { ...cfg, slug: s };
  } else {
    const embedded = window.self !== window.top;
    const internal = P.has("demo") || P.has("draft") || P.has("preview");
    if (!embedded && !internal && settings?.legacyLinks === false) return notice("Este link ya no se usa. Pedí el link nuevo en el panel.");
  }
  const cols = settings?.collections;
  boot.defaultCollection = Array.isArray(cols) && typeof cols[0] === "string" ? cols[0] : null;
  await import("./app");
}

void start();
