import "dotenv/config";

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function str(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export const env = {
  port: num("PORT", 4000),
  corsOrigin: str("CORS_ORIGIN", "*"),

  supabaseUrl: str("SUPABASE_URL"),
  supabaseServiceKey: str("SUPABASE_SERVICE_ROLE_KEY"),

  pollDolarMs: num("POLL_DOLAR_MS", 60_000),
  pollCammesaMs: num("POLL_CAMMESA_MS", 60_000),
  pollDatosGobMs: num("POLL_DATOSGOB_MS", 6 * 60 * 60_000),

  cammesaRegion: str("CAMMESA_REGION", "1002"),
  datosGobSeries: str("DATOSGOB_SERIES"),

  // Emails que se promueven a rol admin automáticamente al arrancar (bootstrap).
  adminEmails: str("ADMIN_EMAILS")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
};

export const hasSupabase = Boolean(env.supabaseUrl && env.supabaseServiceKey);
