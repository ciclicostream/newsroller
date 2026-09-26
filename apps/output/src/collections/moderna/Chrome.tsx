import { useEffect, useState } from "react";
import { API_BASE } from "../../lib/scene";
import { IS_VERTICAL } from "../../lib/orientation";
import qrCiclico from "../../assets/qr-ciclico.png";
import ciclicoWhite from "../../assets/ciclico-white.png";
import { Chrome as ClassicChrome } from "../../templates/Chrome";

// Marco de la colección Modernas (persistente, no entra ni sale con el contenido):
//  - arriba, en pills translúcidas: hora y fecha, temperatura (rota capitales cada 30 s) y el logo;
//  - abajo, el MISMO newsticker del marco clásico (templates/Chrome.tsx): barra blanca de extremo a extremo con los
//    titulares de somosciclico.com en vivo, la categoría en rojo, la velocidad de Ajustes y la pieza QR de Somos Cíclico.
// `alert` (contenido Ahora): la misma barra, repitiendo "AHORA" como el ticker de la Última Hora clásica.
// El Obituario directamente no usa marco.
const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const ROTATE_MS = 30_000;
interface City { city: string; tempC: number | null }
let citiesCache: City[] = [];

export function ModernChrome({ alert = false }: { alert?: boolean }) {
  const [now, setNow] = useState(() => new Date());
  const [cities, setCities] = useState<City[]>(citiesCache);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    let on = true;
    const load = () => {
      fetch(`${API_BASE}/api/data/clima`).then((r) => r.json()).then((d) => {
        const cs: City[] = d?.payload?.cities ?? [];
        if (on && cs.length) { citiesCache = cs; setCities(cs); }
      }).catch(() => {});
    };
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => { on = false; clearInterval(iv); };
  }, []);

  const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const fecha = `${now.getDate()} ${MESES[now.getMonth()]}`;
  const withTemp = cities.filter((c) => c.tempC != null);
  const cur = withTemp.length ? withTemp[Math.floor(now.getTime() / ROTATE_MS) % withTemp.length] : undefined;
  const cityName = (c: City) => (c.city === "Buenos Aires" ? "CABA" : c.city.toUpperCase());

  return (
    <>
      <style>{CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <div className="nmc-top">
        <div className="nmc-pill nmc-brand"><img src={ciclicoWhite} alt="Cíclico" /><span>Somos Cíclico</span></div>
        <div className="nmc-data">
          <div className="nmc-pill nmc-cd"><b>{clock}</b><span>{fecha}</span></div>
          {cur && <div className="nmc-pill nmc-temp" key={cur.city}><b>{cur.tempC}°</b><span>{cityName(cur)}</span></div>}
        </div>
      </div>
      {alert ? (
        <>
          <div className="nmc-uh"><div className="nmc-uh-track">{Array.from({ length: 16 }, (_, i) => <span key={i}>AHORA</span>)}</div></div>
          <img className="nmc-qr" src={qrCiclico} alt="Somos Cíclico" />
        </>
      ) : (
        <ClassicChrome hideClock hideTemp hideLogo />
      )}
    </>
  );
}

const CSS = `
.nmc-top{position:absolute;top:56px;left:96px;right:96px;display:flex;align-items:center;justify-content:space-between;z-index:30;font-family:"Archivo","Helvetica Neue",Arial,sans-serif;font-variant-numeric:tabular-nums}
.nmc-data{display:flex;align-items:center;gap:12px}
.nmc-pill{display:flex;align-items:center;gap:12px;height:58px;padding:0 24px;border-radius:999px;color:#F4F6FB;
  background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);-webkit-backdrop-filter:blur(14px) saturate(1.3);backdrop-filter:blur(14px) saturate(1.3);
  box-shadow:0 10px 30px -12px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.18)}
.nmc-pill b{font-weight:600;font-size:30px;letter-spacing:.01em}
.nmc-pill span{font-weight:500;font-stretch:112%;font-size:17px;letter-spacing:.24em;color:#A9B6D6;text-transform:uppercase;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nmc-brand{padding:0 22px 0 12px}
.nmc-brand img{width:36px;height:auto;display:block}
.nmc-temp{animation:nmc-in .5s ease both}
@keyframes nmc-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
/* Ahora: misma barra y misma pieza QR que el ticker clásico, con "AHORA" como la Última Hora clásica. */
.nmc-uh{position:absolute;left:0;right:0;bottom:52px;height:58px;z-index:28;background:#fff;overflow:hidden;display:flex;align-items:center;box-shadow:inset 0 0 24px rgba(0,0,0,.28),inset 0 2px 6px rgba(0,0,0,.2),0 6px 18px rgba(0,0,0,.18)}
.nmc-uh::before,.nmc-uh::after{content:"";position:absolute;top:0;bottom:0;width:140px;z-index:2;pointer-events:none}
.nmc-uh::before{left:0;background:linear-gradient(90deg,rgba(0,0,0,.5) 0%,rgba(0,0,0,.18) 45%,rgba(0,0,0,0) 100%)}
.nmc-uh::after{right:0;background:linear-gradient(270deg,rgba(0,0,0,.5) 0%,rgba(0,0,0,.18) 45%,rgba(0,0,0,0) 100%)}
.nmc-uh-track{display:flex;white-space:nowrap;will-change:transform;animation:nmc-tick 30s linear infinite}
.nmc-uh-track span{font-family:"Zilla Slab",Georgia,serif;font-weight:700;color:#0E0E0E;font-size:32px;letter-spacing:.02em;padding:0 26px}
@keyframes nmc-tick{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.nmc-qr{position:absolute;left:34px;bottom:12px;width:270px;height:auto;z-index:29;filter:drop-shadow(0 6px 16px rgba(0,0,0,.3))}
`;

// Vertical: hora a la izquierda, temperatura y logo a la derecha; ticker abajo, también con el QR.
const CSS_V = `
.nmc-top{top:64px;left:60px;right:60px;justify-content:flex-start;gap:12px}
.nmc-data{display:contents}
.nmc-cd{order:1}
.nmc-temp{order:3;margin-left:auto}
.nmc-brand{order:4;padding:0 14px}
.nmc-brand span{display:none}
.nmc-uh{z-index:190}
/* En vertical el marco clásico oculta la pieza QR; en Modernas va siempre. */
.nm .ck-qr{display:block!important;z-index:191}
.nmc-qr{z-index:191}
`;
