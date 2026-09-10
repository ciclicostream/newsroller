import type { SourceId } from "@newsroller/shared";

// Contrato de toda fuente de datos. fetch() devuelve el payload YA normalizado.
export interface DataSource<T = unknown> {
  id: SourceId;
  label: string;
  intervalMs: number;
  fetch(): Promise<T>;
}

// Helper de fetch con timeout, para no colgar el poller si una API no responde.
export async function fetchJson<T>(url: string, timeoutMs = 12_000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}
