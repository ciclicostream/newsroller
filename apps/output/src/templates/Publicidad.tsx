import { useEffect } from "react";
import type { PublicidadData } from "@newsroller/shared";
import fondo from "../assets/fondo2.jpg";
import { Chrome } from "./Chrome";
import { API_BASE } from "../lib/scene";

const WANT_AUDIO = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("audio");

// Placa Publicidad: Full (16:9, sin overlay) o Vertical (9:16 + marco estándar
// + logo/QR de marca opcionales). Entrada y salida por CORTE. Única familia
// que genera reporte: registra cada salida al aire en /api/output/airing.
export function Publicidad({ id, data }: { id?: string; data: PublicidadData }) {
  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE}/api/output/airing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content_item_id: id }),
    }).catch(() => {});
  }, [id]);

  const media =
    data.media_kind === "video" ? (
      <video src={data.media_url} autoPlay loop muted={!WANT_AUDIO} playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    ) : (
      <img src={data.media_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    );

  if (data.format === "full") {
    return (
      <div style={{ position: "absolute", inset: 0, background: "#000" }}>
        {media}
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <style>{CSS}</style>
      <img className="pb-bg" src={fondo} alt="" />
      <Chrome hideTemp />
      <div className="pb-vad">
        <div className="pb-m">{media}</div>
      </div>
      {data.logo_url && (
        <div className="pb-brand pb-logo">
          <img src={data.logo_url} alt="marca" />
        </div>
      )}
      {data.brand_qr_url && (
        <div className="pb-brand pb-qr">
          <img src={data.brand_qr_url} alt="QR marca" />
        </div>
      )}
    </div>
  );
}

const CSS = `
.pb-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.pb-vad{position:absolute;left:300px;top:150px;width:405px;height:720px;background:#fff;border-radius:24px;padding:12px;box-sizing:border-box;box-shadow:0 16px 40px rgba(0,0,0,.4)}
.pb-m{width:100%;height:100%;border-radius:14px;overflow:hidden;background:#0b1330}
.pb-brand{position:absolute;bottom:210px;width:300px;height:300px;background:#fff;border-radius:24px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:28px;box-shadow:0 10px 26px rgba(0,0,0,.28)}
.pb-brand img{max-width:100%;max-height:100%;object-fit:contain;display:block}
.pb-brand.pb-logo{left:735px}
.pb-brand.pb-qr{left:1065px}
`;
