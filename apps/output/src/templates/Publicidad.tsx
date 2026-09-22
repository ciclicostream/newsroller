import type { PublicidadData } from "@newsroller/shared";
import fondo from "../assets/fondo2.jpg";
import { Chrome } from "./Chrome";
import { IS_VERTICAL } from "../lib/orientation";
import { useForcePlay } from "../lib/autoplay";

const WANT_AUDIO = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("audio");

// Placa Publicidad: Full (16:9, sin overlay) o Vertical (9:16 + marco estándar
// + logo/QR de marca opcionales). Entrada y salida por CORTE. Única familia
// que genera reporte de avisos; la salida al aire se registra en Output.tsx (todos los tipos).
export function Publicidad({ data }: { id?: string; data: PublicidadData }) {
  const mediaRef = useForcePlay<HTMLVideoElement>();
  const vMediaRef = useForcePlay<HTMLVideoElement>();
  const media =
    data.media_kind === "video" ? (
      <video key={data.media_url} ref={mediaRef} src={data.media_url} autoPlay loop muted={!WANT_AUDIO} playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    ) : (
      <img src={data.media_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    );

  if (data.format === "full") {
    // Output vertical: el aviso Full sale con su versión 9:16 (sin ella no se emite).
    const vMedia = data.vertical_url
      ? data.vertical_kind === "video"
        ? <video key={data.vertical_url} ref={vMediaRef} src={data.vertical_url} autoPlay loop muted={!WANT_AUDIO} playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        : <img src={data.vertical_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      : null;
    return (
      <div style={{ position: "absolute", inset: 0, background: "#000" }}>
        {IS_VERTICAL ? vMedia : media}
      </div>
    );
  }

  return (
    <div className={IS_VERTICAL ? "pbv" : ""} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS + (IS_VERTICAL ? CSS_V : "")}</style>
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

// Vertical: el aviso 9:16 arriba y las cards de marca (logo y QR) una al lado de la otra debajo.
const CSS_V = `
.pbv .pb-vad{left:194px;top:150px;width:692px;height:1230px}
.pbv .pb-brand{width:300px;height:300px;padding:26px;bottom:auto;top:1440px}
.pbv .pb-brand.pb-logo{left:225px}
.pbv .pb-brand.pb-qr{left:555px}
`;

const CSS = `
.pb-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.pb-vad{position:absolute;left:300px;top:150px;width:405px;height:720px;background:#fff;border-radius:24px;padding:12px;box-sizing:border-box;box-shadow:0 16px 40px rgba(0,0,0,.4)}
.pb-m{width:100%;height:100%;border-radius:14px;overflow:hidden;background:#0b1330}
.pb-brand{position:absolute;bottom:210px;width:300px;height:300px;background:#fff;border-radius:24px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:28px;box-shadow:0 10px 26px rgba(0,0,0,.28)}
.pb-brand img{max-width:100%;max-height:100%;object-fit:contain;display:block}
.pb-brand.pb-logo{left:735px}
.pb-brand.pb-qr{left:1065px}
`;
