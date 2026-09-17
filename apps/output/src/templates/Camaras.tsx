import { useEffect, useRef, useState } from "react";
import type { CamarasData } from "@newsroller/shared";
import type { Camera } from "../lib/scene";
import fondo from "../assets/fondo2.jpg";
import { Chrome } from "./Chrome";
import { CameraView } from "./render";

// Placa Cámaras: cámara en vivo (nunca con audio) + EN VIVO/ubicación (entran
// desde la izquierda) + uno o más avisos de imagen que rotan en fade con
// rayitas de progreso. Header: sólo hora. Entrada por CORTE (salvo EN VIVO+
// ubicación); salida: todo con fade. No genera reporte.
export function Camaras({ data, durationSec, cameras }: { data: CamarasData; durationSec?: number; cameras: Camera[] }) {
  const cam = cameras.find((c) => c.id === data.camera_id);
  const [play, setPlay] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [adIdx, setAdIdx] = useState(0);
  const raf = useRef<number | undefined>(undefined);
  const [adProgress, setAdProgress] = useState(0); // 0..1 del aviso actual

  useEffect(() => {
    const id = requestAnimationFrame(() => setPlay(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (!durationSec) return;
    const t = setTimeout(() => setExiting(true), Math.max(1000, durationSec * 1000 - 700));
    return () => clearTimeout(t);
  }, [durationSec]);

  // Rotación de avisos en fade, repartiendo la duración del bloque en partes iguales.
  const ads = data.ads.length ? data.ads : [];
  useEffect(() => {
    if (ads.length < 2 || !durationSec) return;
    const perAd = (durationSec * 1000) / ads.length;
    const t0 = performance.now();
    function tick(now: number) {
      const elapsed = now - t0;
      const idx = Math.min(ads.length - 1, Math.floor(elapsed / perAd));
      setAdIdx(idx);
      setAdProgress((elapsed % perAd) / perAd);
      raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [ads.length, durationSec]);

  return (
    <div className={"ca" + (play ? " play" : "") + (exiting ? " exit" : "")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS}</style>
      <img className="ca-bg" src={fondo} alt="" />
      <Chrome hideTemp />

      <div className="ca-cam">
        {cam ? <CameraView cam={cam} /> : <div className="ca-nocam">Sin cámara</div>}
      </div>

      <div className="ca-label ca-el">
        <div className="ca-live">EN VIVO</div>
        <div className="ca-loc">{data.location}</div>
      </div>

      {ads.length > 0 && (
        <div className="ca-adbox">
          <div className="ca-adpub">PUBLICIDAD</div>
          <div className="ca-adstack">
            {ads.map((url, i) => (
              <img key={url + i} src={url} alt="" style={{ opacity: i === adIdx ? 1 : 0 }} />
            ))}
          </div>
          {ads.length > 1 && (
            <div className="ca-adprog">
              {ads.map((_, i) => (
                <div className="ca-adseg" key={i}>
                  <div className="ca-adfill" style={{ width: i < adIdx ? "100%" : i === adIdx ? `${adProgress * 100}%` : "0%" }} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const CSS = `
.ca{font-family:Inter,system-ui,sans-serif}
.ca-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}

.ca-cam{position:absolute;left:300px;top:153px;width:1058px;height:774px;z-index:5;border-radius:20px;
  overflow:hidden;background:#0b1330;box-shadow:0 16px 40px rgba(0,0,0,.45)}
.ca-cam > *{width:100%;height:100%}
.ca-nocam{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#6b7688;font-size:26px}

.ca-el{opacity:0;transform:translateX(-520px);transition:transform .6s cubic-bezier(.2,.8,.2,1), opacity .6s ease}
.ca.play .ca-el{opacity:1;transform:translateX(0)}
.ca-label{position:absolute;left:320px;top:843px;z-index:6;display:flex}
.ca-live{background:#EE220C;color:#fff;font-weight:800;font-size:34px;letter-spacing:.03em;padding:14px 30px;border-radius:14px 0 0 14px}
.ca-loc{background:#fff;color:#0b2b6b;font-weight:800;font-size:34px;padding:14px 34px;border-radius:0 14px 14px 0}

.ca-adbox{position:absolute;right:60px;top:462px;width:372px;z-index:8}
.ca-adpub{position:absolute;left:-8px;top:-26px;background:#fff;color:#2f80ed;font-weight:800;font-size:20px;
  letter-spacing:.06em;padding:6px 16px;border-radius:10px;box-shadow:0 6px 16px rgba(0,0,0,.25);z-index:2}
.ca-adstack{position:relative;width:372px;height:465px;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,.35)}
.ca-adstack img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:opacity .5s ease}
.ca-adprog{display:flex;gap:8px;margin-top:12px}
.ca-adseg{flex:1;height:7px;background:rgba(255,255,255,.30);border-radius:4px;overflow:hidden}
.ca-adfill{height:100%;background:#fff;border-radius:4px}

.ca.exit .ca-cam,.ca.exit .ca-el,.ca.exit .ca-adbox{transition:opacity .7s ease;opacity:0!important}
`;
