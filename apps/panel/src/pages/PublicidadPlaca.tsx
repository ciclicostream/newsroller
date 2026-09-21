import { useEffect, useRef, useState } from "react";
import { PreviewMonitor } from "../components/PreviewMonitor";
import { Plus, Trash2, Check, X, Loader2, Megaphone, Pencil } from "lucide-react";
import type { ContentItem, PublicidadData } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { uploadMedia } from "../lib/content";
import { api } from "../lib/api";

export function PublicidadPlaca() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [report, setReport] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<"full" | "vertical">("vertical");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<"image" | "video">("video");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dur, setDur] = useState(15);
  const [saving, setSaving] = useState(false);
  const mediaRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const qrRef = useRef<HTMLInputElement>(null);

  const load = () => contentItems.list("publicidad").then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    api.get<{ counts: Record<string, number> }>("/api/content/report/publicidad")
      .then((r) => setReport(r.counts))
      .catch(() => {});
  }, [items]);

  async function onMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setUploading(true);
    try {
      setMediaUrl(await uploadMedia(file, "media"));
      setMediaKind(file.type.startsWith("video") ? "video" : "image");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error subiendo");
    } finally {
      setUploading(false);
    }
  }
  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setLogoUrl(await uploadMedia(file, "media")); }
    catch (e) { setErr(e instanceof Error ? e.message : "error subiendo"); }
  }
  async function onQr(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setQrUrl(await uploadMedia(file, "media")); }
    catch (e) { setErr(e instanceof Error ? e.message : "error subiendo"); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (!title.trim()) return setErr("El título es obligatorio: sirve para identificar el aviso en la parrilla.");
    if (!mediaUrl) return setErr("El video o imagen del aviso es obligatorio.");
    setSaving(true);
    try {
      const data: PublicidadData = {
        title: title.trim().slice(0, 60),
        format, media_url: mediaUrl, media_kind: mediaKind,
        logo_url: format === "vertical" ? logoUrl ?? undefined : undefined,
        brand_qr_url: format === "vertical" ? qrUrl ?? undefined : undefined,
      };
      if (editingId) {
        await contentItems.patch(editingId, { data, duration_sec: dur });
        setMsg("Cambios guardados.");
      } else {
        await contentItems.create({ type: "publicidad", data, duration_sec: dur });
        setMsg("Guardado en el banco.");
      }
      cancelEdit();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(it: ContentItem) {
    const d = it.data as PublicidadData;
    setEditingId(it.id);
    setTitle(d.title ?? "");
    setFormat(d.format);
    setMediaUrl(d.media_url ?? null);
    setMediaKind(d.media_kind);
    setLogoUrl(d.logo_url ?? null);
    setQrUrl(d.brand_qr_url ?? null);
    setDur(it.duration_sec);
    setErr(null); setMsg(null);
  }
  function cancelEdit() {
    setEditingId(null);
    setTitle("");
    setMediaUrl(null); setLogoUrl(null); setQrUrl(null);
    if (mediaRef.current) mediaRef.current.value = "";
    if (logoRef.current) logoRef.current.value = "";
    if (qrRef.current) qrRef.current.value = "";
    setDur(15);
  }

  async function remove(it: ContentItem) {
    if (!confirm("¿Enviar este aviso a la papelera?")) return;
    await contentItems.remove(it.id);
    if (editingId === it.id) cancelEdit();
    await load();
  }
  async function toggleDisponible(it: ContentItem) {
    await contentItems.patch(it.id, { in_parrilla: !(it.in_parrilla !== false) });
    await load();
  }

  return (
    <>
      <div className="page-head pm-head">
        <div>
          <h1>Publicidad</h1>
          <p>Full (16:9, sin overlay) o Vertical (9:16 + marco + logo/QR de marca). Genera reporte de salidas al aire.</p>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div className="pm-layout">
        <form className="card" style={{ padding: 18 }} onSubmit={save}>
          <div style={{ fontWeight: 500, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {editingId ? "Editar aviso" : "Nuevo aviso"}
            {editingId && <button type="button" className="btn" onClick={cancelEdit}>Cancelar</button>}
          </div>

          <div className="field">
            <label>Título (para identificar el aviso)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} placeholder="Ej.: Avon — Promo septiembre" maxLength={60} required />
          </div>

          <div className="field">
            <label>Formato</label>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button type="button" className={"tab" + (format === "vertical" ? " active" : "")} onClick={() => setFormat("vertical")}>Vertical</button>
              <button type="button" className={"tab" + (format === "full" ? " active" : "")} onClick={() => setFormat("full")}>Full pantalla</button>
            </div>
          </div>

          <div className="field">
            <label>Video o imagen del aviso</label>
            {mediaUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {mediaKind === "video" ? <video src={mediaUrl} style={{ width: 72, height: 40, objectFit: "cover", borderRadius: 6 }} muted /> : <img src={mediaUrl} alt="" style={{ width: 72, height: 40, objectFit: "cover", borderRadius: 6 }} />}
                <button type="button" className="btn" onClick={() => { setMediaUrl(null); if (mediaRef.current) mediaRef.current.value = ""; }}><X size={14} /> quitar</button>
              </div>
            ) : (
              <input ref={mediaRef} type="file" accept="image/*,video/*" onChange={onMedia} disabled={uploading} />
            )}
            {uploading && <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}><Loader2 size={13} className="spin" /> subiendo…</div>}
          </div>

          {format === "vertical" && (
            <>
              <div className="field">
                <label>Logo de marca (opcional)</label>
                {logoUrl ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img src={logoUrl} alt="" style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 6, background: "#f3f3f3" }} />
                    <button type="button" className="btn" onClick={() => { setLogoUrl(null); if (logoRef.current) logoRef.current.value = ""; }}><X size={14} /> quitar</button>
                  </div>
                ) : (
                  <input ref={logoRef} type="file" accept="image/*" onChange={onLogo} />
                )}
              </div>
              <div className="field">
                <label>QR del anunciante (opcional)</label>
                {qrUrl ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img src={qrUrl} alt="" style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 6, background: "#f3f3f3" }} />
                    <button type="button" className="btn" onClick={() => { setQrUrl(null); if (qrRef.current) qrRef.current.value = ""; }}><X size={14} /> quitar</button>
                  </div>
                ) : (
                  <input ref={qrRef} type="file" accept="image/*" onChange={onQr} />
                )}
              </div>
            </>
          )}

          <div className="field">
            <label>Duración (segundos)</label>
            <input type="number" min={2} value={dur} onChange={(e) => setDur(Math.max(2, Number(e.target.value) || 15))} />
          </div>

          <button className="btn primary" type="submit" disabled={saving || uploading} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} /> {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar en el banco"}
          </button>
        </form>

        <div className="pm-col">
          <PreviewMonitor type="publicidad" data={{ format, media_url: mediaUrl, media_kind: mediaKind, logo_url: format === "vertical" ? logoUrl ?? undefined : undefined, brand_qr_url: format === "vertical" ? qrUrl ?? undefined : undefined }} dur={dur} ready={!!mediaUrl} />
          {items.length === 0 && <div className="card" style={{ padding: 18, color: "#6b7688" }}>Todavía no hay avisos.</div>}
          {items.map((it) => {
            const d = it.data as PublicidadData;
            const salidas = report[it.id] ?? 0;
            return (
              <div key={it.id} data-item={it.id} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: "#0d2168", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Megaphone size={20} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{d.title || `${d.format === "full" ? "Full" : "Vertical"} — ${d.media_kind === "video" ? "video" : "imagen"}`}</div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4, display: "flex", gap: 12 }}>
                    <span>{d.format === "full" ? "Full" : "Vertical"} · {d.media_kind === "video" ? "video" : "imagen"}</span>
                    <span>{it.duration_sec}s</span>
                    <span>{salidas} salida{salidas === 1 ? "" : "s"} (últimos 30 días)</span>
                  </div>
                </div>
                <button className={"toggle-pill" + (it.in_parrilla !== false ? " on" : "")} onClick={() => toggleDisponible(it)}>
                  {it.in_parrilla !== false && <Check size={14} />} {it.in_parrilla !== false ? "En parrilla" : "Disponible: no"}
                </button>
                <button className="btn" onClick={() => startEdit(it)}><Pencil size={15} /></button>
                <button className="btn" onClick={() => remove(it)}><Trash2 size={15} /></button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
