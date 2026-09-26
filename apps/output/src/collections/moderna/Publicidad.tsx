import type { PublicidadData } from "@newsroller/shared";
import { IS_VERTICAL } from "../../lib/orientation";
import { P } from "../../lib/params";
import { useForcePlay } from "../../lib/autoplay";
import { Publicidad as PublicidadFull } from "../../templates/Publicidad";
import { Grain, NM_CSS } from "./base";
import { ModernChrome } from "./Chrome";

const WANT_AUDIO = P.has("audio");

// Publicidad, colección Modernas. Full: igual que la clásica (pantalla completa, sin marco ni nada encima).
// Vertical: corte seco, todo de frente. Rótulo PUBLICIDAD fijo arriba del aviso, el aviso 9:16 con marco blanco y
// una luz ambiente hecha con el mismo aviso desenfocado detrás; logo y QR de la marca (opcionales) en cards
// blancas al lado (en el output 9:16, debajo). El reporte de salidas lo registra el output para todos los tipos.
export function Publicidad({ id, data }: { id?: string; data: PublicidadData }) {
  const ref = useForcePlay<HTMLVideoElement>();
  if (data.format === "full") return <PublicidadFull id={id} data={data} />;
  const video = data.media_kind === "video";
  const cards = [data.logo_url, data.brand_qr_url].filter(Boolean).length;
  return (
    <div className={"nm nmb in" + (IS_VERTICAL ? " v" : "") + " c" + cards}>
      <style>{NM_CSS + CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <div className="nm-bg" /><Grain />
      {!video && <img className="nmb-amb" src={data.media_url} alt="" />}
      <div className="nmb-tag">PUBLICIDAD</div>
      <div className="nmb-v">
        {video
          ? <video key={data.media_url} ref={ref} src={data.media_url} autoPlay loop muted={!WANT_AUDIO} playsInline />
          : <img src={data.media_url} alt="" />}
      </div>
      {data.logo_url && <div className="nmb-card nmb-logo"><img src={data.logo_url} alt="" /></div>}
      {data.brand_qr_url && <div className="nmb-card nmb-qr"><img src={data.brand_qr_url} alt="" /></div>}
      <ModernChrome hideTemp />
    </div>
  );
}

const CSS = `
.nmb-amb{position:absolute;left:340px;top:40px;width:900px;height:1000px;object-fit:cover;filter:blur(90px) saturate(1.4);opacity:.5;pointer-events:none;animation:nmb-amb 3.2s ease-in-out infinite alternate}
@keyframes nmb-amb{from{opacity:.4;transform:scale(1)}to{opacity:.65;transform:scale(1.06)}}
.nmb-tag{position:absolute;left:560px;top:130px;z-index:21;font-family:var(--display);font-weight:700;font-stretch:115%;font-size:13px;letter-spacing:.3em;color:var(--mist)}
.nmb-v{position:absolute;left:560px;top:170px;width:405px;height:720px;z-index:21;border-radius:14px;overflow:hidden;background:#0A1636;box-shadow:0 0 0 6px #fff,0 50px 90px -30px #000}
.nmb-v img,.nmb-v video{width:100%;height:100%;object-fit:cover;display:block}
.nmb-card{position:absolute;z-index:21;background:#fff;border-radius:14px;display:flex;align-items:center;justify-content:center;padding:30px;box-sizing:border-box;box-shadow:0 40px 80px -30px #000}
.nmb-card img{max-width:100%;max-height:100%;object-fit:contain;display:block}
.nmb-logo{left:995px;top:630px;width:260px;height:260px}
.nmb-qr{left:1271px;top:550px;width:340px;height:340px}
.nmb.c1 .nmb-qr{left:995px}
/* Sin cards de marca, el aviso va al centro. */
.nmb.c0 .nmb-v,.nmb.c0 .nmb-tag{left:757px}
.nmb.c0 .nmb-amb{left:510px}
`;

const CSS_V = `
.nmb-amb{left:90px;top:220px}
.nmb-tag{left:240px;top:160px}
.nmb-v{left:240px;top:200px;width:600px;height:1066px}
.nmb-logo{left:60px;top:1310px;width:450px;height:400px}
.nmb-qr,.nmb.c1 .nmb-qr{left:570px;top:1310px;width:450px;height:400px}
.nmb.c1 .nmb-logo,.nmb.c1 .nmb-qr{left:315px}
.nmb.c0 .nmb-v,.nmb.c0 .nmb-tag{left:240px}
.nmb.c0 .nmb-v{top:260px;height:1066px}
.nmb.c0 .nmb-tag{top:220px}
.nmb.c0 .nmb-amb{left:90px}
`;
