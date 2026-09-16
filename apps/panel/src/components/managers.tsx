import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, Loader2, Image as ImageIcon, RefreshCw, Youtube } from "lucide-react";
import type { Asset, AssetKind, Short } from "@newsroller/shared";
import { content, uploadAsset } from "../lib/content";

export function ShortsManager() {
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

export function AssetManager({ kind }: { kind: AssetKind }) {
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
