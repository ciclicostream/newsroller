import { useEffect, useState } from "react";
import { API_BASE } from "../../lib/scene";
import { IS_VERTICAL } from "../../lib/orientation";
import qrCiclico from "../../assets/qr-ciclico.png";
import ciclicoWhite from "../../assets/ciclico-white.png";

// Marco de la colección Modernas (persistente, no entra ni sale con el contenido):
//  - arriba, en pills translúcidas: hora y fecha, temperatura (rota capitales cada 30 s) y el logo;
//  - abajo, el newsticker en una barra blanca de extremo a extremo que pasa por debajo de la pieza QR de
//    Somos Cíclico; las letras se desvanecen en los bordes y la categoría va en rojo.
// `alert`: la barra se pone roja y repite "AHORA" (contenido Ahora). El Obituario directamente no usa marco.
const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const ROTATE_MS = 30_000;
interface TickerItem { title: string; cats: string[] }
interface City { city: string; tempC: number | null }
let tickerCache: TickerItem[] = [];
let citiesCache: City[] = [];

export function ModernChrome({ alert = false }: { alert?: boolean }) {
  const [now, setNow] = useState(() => new Date());
  const [ticker, setTicker] = useState<TickerItem[]>(tickerCache);
  const [cities, setCities] = useState<City[]>(citiesCache);
  const [speed, setSpeed] = useState(90);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    let on = true;
    const load = () => {
      fetch(`${API_BASE}/api/data/ticker`).then((r) => r.json()).then((d) => {
        const items: TickerItem[] = d?.payload?.items ?? (d?.payload?.headlines ?? []).map((t: string) => ({ title: t, cats: [] }));
        if (on && items.length) { tickerCache = items; setTicker(items); }
      }).catch(() => {});
      fetch(`${API_BASE}/api/data/clima`).then((r) => r.json()).then((d) => {
        const cs: City[] = d?.payload?.cities ?? [];
        if (on && cs.length) { citiesCache = cs; setCities(cs); }
      }).catch(() => {});
      fetch(`${API_BASE}/api/settings`).then((r) => r.json()).then((d) => {
        const s = Number(d?.tickerSpeed);
        if (on && Number.isFinite(s) && s > 0) setSpeed(s);
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
  const items = alert ? Array.from({ length: 12 }, () => ({ title: "AHORA", cats: [] as string[] })) : ticker;

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
      <div className={"nmc-tk" + (alert ? " alert" : "")}>
        <div className="nmc-rail">
          <div className="nmc-mask">
            <div className="nmc-track" style={{ animationDuration: `${alert ? 22 : speed}s` }}>
              {[0, 1].map((dup) => (
                <div className="nmc-seq" key={dup} aria-hidden={dup === 1}>
                  {items.map((it, i) => (
                    <span className="nmc-item" key={dup + "-" + i}>
                      {!alert && it.cats[0] && <b>{it.cats[0].toUpperCase()}</b>}
                      {it.title}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="nmc-qr"><img src={qrCiclico} alt="Somos Cíclico" /></div>
      </div>
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
.nmc-pill span{font-weight:500;font-stretch:112%;font-size:17px;letter-spacing:.24em;color:#A9B6D6;text-transform:uppercase}
.nmc-brand{padding:0 22px 0 12px}
.nmc-brand img{width:36px;height:auto;display:block}
.nmc-temp{animation:nmc-in .5s ease both}
@keyframes nmc-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
.nmc-tk{position:absolute;left:0;right:0;bottom:0;height:124px;z-index:30;background:linear-gradient(180deg,rgba(5,11,31,0) 0%,rgba(5,11,31,.6) 55%)}
.nmc-rail{position:absolute;left:0;right:0;bottom:44px;height:60px;background:#fff;box-shadow:0 -1px 0 rgba(255,255,255,.4),0 20px 40px -18px rgba(0,0,0,.8)}
.nmc-mask{position:absolute;inset:0;overflow:hidden;-webkit-mask:linear-gradient(90deg,transparent 0,#000 60px,#000 calc(100% - 60px),transparent 100%);mask:linear-gradient(90deg,transparent 0,#000 60px,#000 calc(100% - 60px),transparent 100%)}
.nmc-track{position:absolute;left:0;top:0;height:100%;display:flex;white-space:nowrap;animation:nmc-tick 90s linear infinite}
@keyframes nmc-tick{to{transform:translateX(-50%)}}
.nmc-seq{display:flex;align-items:center;height:100%}
.nmc-item{font-family:"Instrument Sans","Helvetica Neue",Arial,sans-serif;font-weight:600;font-size:25px;color:#0A1433;padding:0 36px;display:flex;align-items:center;gap:14px}
.nmc-item b{font-family:"Archivo","Helvetica Neue",Arial,sans-serif;font-weight:700;font-stretch:112%;font-size:15px;letter-spacing:.2em;color:#EE220C}
.nmc-item::after{content:"";width:5px;height:5px;border-radius:50%;background:rgba(10,20,51,.28);margin-left:36px}
.nmc-tk.alert .nmc-rail{background:#EE220C}
.nmc-tk.alert .nmc-item{color:#fff;font-family:"Archivo","Helvetica Neue",Arial,sans-serif;font-weight:800;font-stretch:112%;letter-spacing:.24em}
.nmc-tk.alert .nmc-item::after{background:rgba(255,255,255,.5)}
.nmc-qr{position:absolute;left:96px;bottom:38px;height:72px;background:#fff;border-radius:12px;padding:8px 12px;display:flex;align-items:center;z-index:3;box-shadow:0 18px 40px -16px rgba(0,0,0,.7)}
.nmc-qr img{height:56px;width:auto;display:block}
`;

// Vertical: hora a la izquierda, temperatura y logo a la derecha; ticker abajo, también con el QR.
const CSS_V = `
.nmc-top{top:64px;left:60px;right:60px;justify-content:flex-start;gap:12px}
.nmc-data{display:contents}
.nmc-cd{order:1}
.nmc-temp{order:3;margin-left:auto}
.nmc-brand{order:4;padding:0 14px}
.nmc-brand span{display:none}
.nmc-tk{height:150px}
.nmc-rail{bottom:64px;height:64px}
.nmc-qr{left:60px;bottom:60px}
`;
