import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, Loader2, Plus, Image as ImageIcon, RefreshCw, Youtube, Wand2 } from "lucide-react";
import type { Asset, AssetKind, Placa, Short } from "@newsroller/shared";
import { content, uploadAsset, uploadMedia } from "../lib/content";

type Tab = AssetKind | "placa" | "short";
const TABS: { key: Tab; label: string }[] = [
  { key: "short", label: "Shorts" },
  { key: "background", label: "Fondos" },
  { key: "logo", label: "Logos" },
  { key: "ad", label: "Publicidad" },
  { key: "placa", label: "Placas" },
];

export function Content() {
  const [tab, setTab] = useState<Tab>("background");
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Contenido</h1>
          <p>Cargá y administrá lo que rota al aire: fondos, logos, publicidad y placas.</p>
        </div>
      </div>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={"tab" + (tab === t.key ? " active" : "")} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "placa" ? <PlacasManager /> : tab === "short" ? <ShortsManager /> : <AssetManager kind={tab} />}
    </>
  );
}

function ShortsManager() {
  const [items, setItems] = useState<Short[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [titles, setTitles] = useState<Record<string, string>>({});

  const load = () => content.listShorts().then(setItems).catch((e) => setErr(e.message));
  useEffect(() => {
    void load();
  }, []);

  async function sync() {
    setBusy(true);
    setErr(null);
    try {
      const res = await content.syncShorts();
      setItems(res.shorts);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error al sincronizar");
    } finally {
      setBusy(false);
    }
  }
  async function saveTitle(s: Short) {
    const val = titles[s.id];
    if (val === undefined || val === (s.custom_title ?? "")) return;
    await content.patchShort(s.id, { custom_title: val || null });
    await load();
  }
  async function toggle(s: Short) {
    await content.patchShort(s.id, { active: !s.active });
    await load();
  }
  async function remove(s: Short) {
    if (!confirm("¿Quitar este short de la lista? (no se borra de YouTube)")) return;
    await content.deleteShort(s.id);
    await load();
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 16, justifyContent: "space-between" }}>
        <div className="muted-note">{items.length} short{items.length === 1 ? "" : "s"} · el título editado es el que sale al aire</div>
        <button className="btn primary" onClick={sync} disabled={busy}>
          {busy ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />} Sincronizar con YouTube
        </button>
      </div>
      {err && <div className="alert error">{err}</div>}
      {items.length === 0 && !busy && !err && (
        <div className="muted-note" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Youtube size={18} /> Todavía no hay shorts. Tocá "Sincronizar con YouTube".
        </div>
      )}
      <div className="asset-grid">
        {items.map((s) => (
          <div key={s.id} className={"asset-card" + (s.active ? " on" : "")}>
            <div className="short-thumb">
              {s.thumbnail_url ? <img src={s.thumbnail_url} alt={s.title} /> : <Youtube size={26} />}
              {s.duration_sec != null && <span className="short-dur">{s.duration_sec}s</span>}
            </div>
            <div className="asset-body">
              <input
                value={titles[s.id] ?? s.custom_title ?? s.title}
                onChange={(e) => setTitles((t) => ({ ...t, [s.id]: e.target.value }))}
                onBlur={() => saveTitle(s)}
                style={{ fontSize: 13, marginBottom: 4 }}
              />
              <div className="muted-note" style={{ fontSize: 11, marginBottom: 8 }} title={s.title}>
                original: {s.title.length > 40 ? s.title.slice(0, 40) + "…" : s.title}
              </div>
              <div className="asset-actions">
                <button className={"toggle-pill" + (s.active ? " on" : "")} onClick={() => toggle(s)}>
                  {s.active && <span className="live-dot" />}
                  {s.active ? "Al aire" : "Poner al aire"}
                </button>
                <button className="icon-btn" onClick={() => remove(s)} aria-label="Quitar">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const ACCEPT: Record<AssetKind, string> = {
  background: "image/*,video/*",
  logo: "image/*",
  ad: "image/*,video/*",
};

function AssetManager({ kind }: { kind: AssetKind }) {
  const [items, setItems] = useState<Asset[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => content.listAssets(kind).then(setItems).catch((e) => setErr(e.message));
  useEffect(() => {
    setItems([]);
    setErr(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setErr(null);
    try {
      for (const f of Array.from(files)) await uploadAsset(kind, f);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error al subir");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function toggle(a: Asset) {
    await content.patchAsset(a.id, { active: !a.active });
    await load();
  }
  async function remove(a: Asset) {
    if (!confirm(`¿Eliminar "${a.name}"?`)) return;
    await content.deleteAsset(a.id);
    await load();
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 16, justifyContent: "space-between" }}>
        <div className="muted-note">
          {items.length} elemento{items.length === 1 ? "" : "s"}
        </div>
        <button className="btn primary" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Upload size={16} /> Subir
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          multiple
          accept={ACCEPT[kind]}
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      {busy && (
        <div className="uploading">
          <Loader2 size={16} className="spin" /> Subiendo…
        </div>
      )}
      {err && <div className="alert error">{err}</div>}

      <div className="asset-grid">
        {items.map((a) => (
          <div key={a.id} className={"asset-card" + (a.active ? " on" : "")}>
            <div className={"asset-thumb" + (kind === "logo" ? " logo" : "")}>
              {a.mime?.startsWith("image/") ? (
                <img src={a.url} alt={a.name ?? ""} />
              ) : a.mime?.startsWith("video/") ? (
                <video src={a.url} muted />
              ) : (
                <ImageIcon size={26} />
              )}
            </div>
            <div className="asset-body">
              <div className="asset-name">{a.name}</div>
              <div className="asset-actions">
                <button className={"toggle-pill" + (a.active ? " on" : "")} onClick={() => toggle(a)}>
                  {a.active && <span className="live-dot" />}
                  {a.active ? "Al aire" : "Poner al aire"}
                </button>
                <button className="icon-btn" onClick={() => remove(a)} aria-label="Eliminar">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && !busy && <div className="muted-note">Todavía no hay nada acá. Subí el primero.</div>}
      </div>
    </>
  );
}

function PlacasManager() {
  const [items, setItems] = useState<Placa[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [accent, setAccent] = useState("#e8542f");
  const [origFile, setOrigFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFit, setImageFit] = useState("contain");
  const [photoBusy, setPhotoBusy] = useState<string | null>(null);

  const load = () => content.listPlacas().then(setItems).catch((e) => setErr(e.message));
  useEffect(() => {
    void load();
  }, []);

  async function onPhoto(file: File | null) {
    if (!file) return;
    setOrigFile(file);
    setPhotoBusy("Subiendo…");
    setErr(null);
    try {
      setImageUrl(await uploadMedia(file, "ad"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally {
      setPhotoBusy(null);
    }
  }

  async function quitarFondo() {
    if (!origFile) return;
    setPhotoBusy("Quitando fondo…");
    setErr(null);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(origFile);
      const png = new File([blob], (origFile.name.replace(/\.[^.]+$/, "") || "foto") + ".png", { type: "image/png" });
      setImageUrl(await uploadMedia(png, "ad"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "no se pudo quitar el fondo");
    } finally {
      setPhotoBusy(null);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await content.createPlaca({
        title: title.trim(),
        body: body.trim() || undefined,
        accent,
        image_url: imageUrl,
        image_fit: imageFit,
      });
      setTitle("");
      setBody("");
      setImageUrl(null);
      setOrigFile(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    }
  }
  async function toggle(p: Placa) {
    await content.patchPlaca(p.id, { active: !p.active });
    await load();
  }
  async function remove(p: Placa) {
    if (!confirm(`¿Eliminar la placa "${p.title}"?`)) return;
    await content.deletePlaca(p.id);
    await load();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>
      <form className="card" style={{ padding: 18 }} onSubmit={create}>
        <div style={{ fontWeight: 500, marginBottom: 14 }}>Nueva placa</div>
        <div className="field">
          <label>Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="field">
          <label>Cuerpo</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} style={{ resize: "vertical" }} />
        </div>
        <div className="field">
          <label>Color de acento</label>
          <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ height: 40, padding: 4 }} />
        </div>
        <div className="field">
          <label>Foto (opcional)</label>
          <input type="file" accept="image/*" onChange={(e) => onPhoto(e.target.files?.[0] ?? null)} />
          {imageUrl && (
            <div style={{ marginTop: 10 }}>
              <div style={{ height: 120, background: "#f0f2f5 repeating-conic-gradient(#e3e6ea 0% 25%, transparent 0% 50%) 0/16px 16px", borderRadius: 8, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img src={imageUrl} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: imageFit as any }} />
              </div>
              <div className="row" style={{ marginTop: 8, gap: 8 }}>
                <button type="button" className="btn" onClick={quitarFondo} disabled={!!photoBusy || !origFile}>
                  <Wand2 size={14} /> Quitar fondo
                </button>
                <select value={imageFit} onChange={(e) => setImageFit(e.target.value)} style={{ width: 120 }}>
                  <option value="contain">Contener</option>
                  <option value="cover">Cubrir</option>
                </select>
              </div>
            </div>
          )}
          {photoBusy && <div className="uploading" style={{ marginTop: 8 }}><Loader2 size={14} className="spin" /> {photoBusy}</div>}
        </div>
        <button className="btn primary" type="submit" style={{ width: "100%", justifyContent: "center" }}>
          <Plus size={16} /> Crear placa
        </button>
      </form>

      <div className="card">
        {err && <div className="alert error" style={{ margin: 14 }}>{err}</div>}
        {items.map((p) => (
          <div className="placa-item" key={p.id}>
            <div className="placa-accent" style={{ background: p.accent ?? "var(--accent)" }} />
            {p.image_url && (
              <img src={p.image_url} style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 6, flex: "none" }} />
            )}
            <div className="placa-main">
              <div className="placa-title">{p.title}</div>
              {p.body && <div className="placa-body">{p.body}</div>}
            </div>
            <button className={"toggle-pill" + (p.active ? " on" : "")} onClick={() => toggle(p)}>
              {p.active && <span className="live-dot" />}
              {p.active ? "Al aire" : "Poner al aire"}
            </button>
            <button className="icon-btn" onClick={() => remove(p)} aria-label="Eliminar">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {items.length === 0 && !err && <div className="muted-note" style={{ padding: 16 }}>Sin placas todavía.</div>}
      </div>
    </div>
  );
}
