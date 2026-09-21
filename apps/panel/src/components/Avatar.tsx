// Foto de perfil o, si no hay, iniciales sobre un color estable por persona.
const COLORS = ["#2f6bff", "#0ea5a3", "#8b5cf6", "#e08a1e", "#d6456b", "#3b7a57", "#5b6577"];

export function initialsOf(name: string | null | undefined, email?: string | null): string {
  const base = (name && name.trim()) || (email ?? "?");
  const parts = base.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1]![0] : "")).toUpperCase();
}
const colorOf = (seed: string) => COLORS[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length]!;

export function Avatar({ url, name, email, size = 32, ring = false }: { url?: string | null; name?: string | null; email?: string | null; size?: number; ring?: boolean }) {
  const ini = initialsOf(name, email);
  return (
    <span
      title={name || email || ""}
      style={{
        width: size, height: size, borderRadius: "50%", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", background: url ? "#e9ecf3" : colorOf(name || email || "?"), color: "#fff", fontWeight: 800, fontSize: Math.round(size * 0.4),
        boxShadow: ring ? "0 0 0 2px #fff" : undefined,
      }}
    >
      {url ? <img src={url} alt={ini} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini}
    </span>
  );
}
