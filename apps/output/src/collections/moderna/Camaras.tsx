import { useEffect, useState } from "react";
import type { CamarasData } from "@newsroller/shared";
import type { Camera } from "../../lib/scene";
import { CameraView } from "../../templates/render";
import { Grain, NM_CSS, useLife } from "./base";
import { ModernChrome } from "./Chrome";

// Cámaras, colección Modernas (sólo 16:9: las cámaras nunca salen en vertical). Todo de frente: la cámara en vivo
// (nunca con audio) en un monitor con visor, reflejo y un brillo que la recorre, con la hora corriendo; entra por
// corte con una señal que engancha. EN VIVO + ubicación pisan el borde de la cámara. A la derecha los avisos
// (rótulo PUBLICIDAD fijo), que rotan en fade repartiéndose la duración, con rayitas de progreso. Sale en fade.
export function Camaras({ data, durationSec, cameras }: { data: CamarasData; durationSec?: number; cameras: Camera[] }) {
  const { cls } = useLife(durationSec, 0.8);
  const cam = cameras.find((c) => c.id === data.camera_id);
  const ads = data.ads ?? [];
  const [ad, setAd] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const per = ads.length > 1 && durationSec ? durationSec / ads.length : 0;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!per) return;
    const timers = ads.slice(1).map((_, k) => setTimeout(() => setAd(k + 1), (k + 1) * per * 1000));
    return () => timers.forEach(clearTimeout);
  }, [per, ads.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const ts = [now.getHours(), now.getMinutes(), now.getSeconds()].map((v) => String(v).padStart(2, "0")).join(":");

  return (
    <div className={"nm nmc" + cls} style={{ ["--per" as string]: `${per}s` }}>
      <style>{NM_CSS + CSS}</style>
      <div className="nm-bg" /><Grain />
      <div className="nmc-sc">
        <div className="nmc-cam">
          <div className="nmc-feed">{cam ? <CameraView cam={cam} /> : <div className="nmc-no">Sin cámara</div>}</div>
          <div className="glass" /><div className="sweep" /><div className="vf" />
          <div className="ts">{ts}</div>
          <div className="gl" />
        </div>
        <div className="nmc-live"><div className="r"><i />EN VIVO</div>{data.location?.trim() && <div className="p">{data.location}</div>}</div>
        {ads.length > 0 && (
          <div className="nmc-ads">
            <div className="hd">
              <b>PUBLICIDAD</b>
              {ads.length > 1 && <div className="seg">{ads.map((_, i) => <span key={i} className={i < ad ? "done" : i === ad ? "on" : ""}><i /></span>)}</div>}
            </div>
            {ads.map((src, i) => <div key={i} className={"nmc-ad" + (i === ad ? " on" : "")}><img src={src} alt="" /></div>)}
          </div>
        )}
      </div>
      <ModernChrome hideTemp />
    </div>
  );
}

const CSS = `
.nmc-sc{position:absolute;inset:0;z-index:20}
.nm:not(.in) .nmc-sc{visibility:hidden}
.out .nmc-sc{animation:nm-fadeOut .8s ease both}
.nmc-cam{position:absolute;left:96px;top:150px;width:1180px;height:740px;border-radius:14px;overflow:hidden;background:#000;box-shadow:0 40px 90px -30px #000,0 0 0 1px rgba(255,255,255,.1)}
.nmc-feed{position:absolute;inset:0}
.nmc-feed>*{width:100%;height:100%;object-fit:cover;display:block}
.nmc-feed iframe,.nmc-feed video,.nmc-feed img{width:100%;height:100%;object-fit:cover;border:0;display:block}
.nmc-no{display:flex;align-items:center;justify-content:center;font-family:var(--display);font-weight:700;font-size:28px;letter-spacing:.2em;color:var(--mist);text-transform:uppercase}
.in .nmc-feed{animation:nmc-sig .55s steps(4) both}
@keyframes nmc-sig{0%{filter:contrast(2.2) hue-rotate(90deg) brightness(1.8)}50%{filter:contrast(1.4) hue-rotate(-40deg)}100%{filter:none}}
.nmc-cam .gl{position:absolute;inset:0;pointer-events:none;opacity:0;mix-blend-mode:screen;background:repeating-linear-gradient(0deg,rgba(255,255,255,.14) 0 2px,transparent 2px 6px)}
.in .nmc-cam .gl{animation:nmc-glitch .55s steps(5) both}
@keyframes nmc-glitch{0%{opacity:1;transform:translateY(0)}40%{opacity:.8;transform:translateY(-30px)}80%{opacity:.4;transform:translateY(12px)}100%{opacity:0}}
.nmc-cam .vf{position:absolute;inset:26px;pointer-events:none;opacity:.85;background-repeat:no-repeat;
  background:linear-gradient(#fff,#fff) 0 0/46px 3px no-repeat,linear-gradient(#fff,#fff) 0 0/3px 46px no-repeat,
  linear-gradient(#fff,#fff) 100% 0/46px 3px no-repeat,linear-gradient(#fff,#fff) 100% 0/3px 46px no-repeat,
  linear-gradient(#fff,#fff) 0 100%/46px 3px no-repeat,linear-gradient(#fff,#fff) 0 100%/3px 46px no-repeat,
  linear-gradient(#fff,#fff) 100% 100%/46px 3px no-repeat,linear-gradient(#fff,#fff) 100% 100%/3px 46px no-repeat}
.nmc-cam .glass{position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,rgba(255,255,255,.14) 0%,rgba(255,255,255,0) 30%)}
.nmc-cam .sweep{position:absolute;top:0;bottom:0;width:180px;left:-200px;pointer-events:none;background:linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent);animation:nmc-sweep 7s ease-in-out 1.5s infinite}
@keyframes nmc-sweep{0%{left:-200px}40%,100%{left:110%}}
.nmc-cam .ts{position:absolute;right:52px;top:44px;font:600 20px/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em;color:#fff;text-shadow:0 1px 3px #000}
.nmc-live{position:absolute;left:56px;top:800px;display:flex;align-items:stretch;z-index:4;max-width:1180px;box-shadow:0 24px 50px -20px #000;opacity:0}
.in .nmc-live{animation:nmc-fromL .7s cubic-bezier(.2,.8,.2,1) .15s both}
@keyframes nmc-fromL{from{opacity:0;transform:translateX(-300px)}to{opacity:1;transform:none}}
.nmc-live .r{flex:none;display:flex;align-items:center;gap:12px;background:var(--red);color:#fff;font-family:var(--display);font-weight:800;font-stretch:112%;font-size:20px;letter-spacing:.22em;padding:0 20px;border-radius:8px 0 0 8px}
.nmc-live .r:last-child{border-radius:8px;padding:16px 20px}
.nmc-live .r i{width:11px;height:11px;border-radius:50%;background:#fff;animation:nm-blink 1s steps(1) infinite}
.nmc-live .p{min-width:0;background:#fff;color:#0A1433;font-family:var(--display);font-weight:800;font-size:36px;padding:16px 28px 14px;border-radius:0 8px 8px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nmc-ads{position:absolute;left:1236px;top:236px;width:520px;height:600px}
.nmc-ads .hd{display:flex;align-items:center;justify-content:space-between;height:34px}
.nmc-ads .hd b{background:#fff;color:var(--blue);font-family:var(--display);font-weight:800;font-stretch:112%;font-size:13px;letter-spacing:.26em;padding:7px 10px 6px;border-radius:5px}
.nmc-ads .seg{display:flex;gap:6px;width:120px}
.nmc-ads .seg span{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.25);overflow:hidden}
.nmc-ads .seg span i{display:block;height:100%;width:0;background:#fff}
.nmc-ads .seg span.on i{animation:nmc-fill var(--per) linear forwards}
.nmc-ads .seg span.done i{width:100%}
@keyframes nmc-fill{to{width:100%}}
.nmc-ad{position:absolute;left:0;right:0;top:48px;bottom:0;border-radius:12px;overflow:hidden;opacity:0;transition:opacity .8s ease;background:#0A1636;box-shadow:0 50px 90px -30px #000,0 0 0 1px rgba(255,255,255,.15)}
.nmc-ad.on{opacity:1}
.nmc-ad img{width:100%;height:100%;object-fit:cover;display:block}
`;
