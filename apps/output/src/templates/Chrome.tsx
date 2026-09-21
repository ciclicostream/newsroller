import { useEffect, useRef, useState } from "react";
import { API_BASE } from "../lib/scene";
import qrCiclico from "../assets/qr-ciclico.png";
import ciclicoWhite from "../assets/ciclico-white.png";
import { IS_VERTICAL } from "../lib/orientation";

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

interface TickerItem { title: string; cats: string[] }
interface ClimaCity { city: string; tempC: number | null }

// El marco se monta de nuevo con cada contenido de la parrilla. Para que el módulo de temperatura rote por su cuenta
// (sin volver a empezar por CABA en cada cambio) la capital que toca sale del RELOJ, no de un contador del componente,
// y los últimos datos quedan en memoria para que el marco no arranque vacío.
const ROTATE_MS = 30_000;
const cityIdxNow = (n: number) => (n > 0 ? Math.floor(Date.now() / ROTATE_MS) % n : 0);
let citiesCache: ClimaCity[] = [];
let tickerCache: TickerItem[] = [];

// Marco estándar PERSISTENTE compartido por todas las placas:
// pills reloj + temperatura (rota capitales cada 30s, desde la API de clima),
// y newsticker con titulares en vivo de somosciclico.com. No entra/sale con el contenido.
// tickerSpeed = segundos que tarda una vuelta completa del texto (mayor = más lento).
// Valor por defecto; el real se lee de /api/settings (editable desde AJUSTES).
// hideLogo: la card con el logo blanco de Cíclico va debajo de la de temperatura (o de la hora, o en la esquina, según lo que
// esté oculto). No se muestra en Clima ni cuando la placa libera toda la esquina (hora y temperatura ocultas).
export function Chrome({ tickerSpeed = 90, hideClock = false, hideTemp = false, hideLogo = false }: { tickerSpeed?: number; hideClock?: boolean; hideTemp?: boolean; hideLogo?: boolean } = {}) {
  const [now, setNow] = useState(() => new Date());
  const [ticker, setTicker] = useState<TickerItem[]>(tickerCache);
  const [cities, setCities] = useState<ClimaCity[]>(citiesCache);
  const [shownIdx, setShownIdx] = useState(() => cityIdxNow(citiesCache.length)); // capital que se ve
  const [leaving, setLeaving] = useState(false); // fase de salida del cambio de capital
  const [swapped, setSwapped] = useState(false); // ya hubo un cambio (anima la entrada de la nueva)
  const citiesRef = useRef(cities);
  citiesRef.current = cities;
  const [speed, setSpeed] = useState(tickerSpeed);

  // Reloj.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Datos en vivo (ticker + clima). Refresca cada 5 min.
  useEffect(() => {
    let on = true;
    const load = () => {
      fetch(`${API_BASE}/api/data/ticker`).then((r) => r.json()).then((d) => {
        if (!on) return;
        const items: TickerItem[] = d?.payload?.items ?? (d?.payload?.headlines ?? []).map((t: string) => ({ title: t, cats: [] }));
        if (items.length) { tickerCache = items; setTicker(items); }
      }).catch(() => {});
      fetch(`${API_BASE}/api/data/clima`).then((r) => r.json()).then((d) => {
        if (!on) return;
        const cs: ClimaCity[] = d?.payload?.cities ?? [];
        if (cs.length) { citiesCache = cs; setCities(cs); }
      }).catch(() => {});
      // Velocidad del ticker configurada desde AJUSTES.
      fetch(`${API_BASE}/api/settings`).then((r) => r.json()).then((d) => {
        if (!on) return;
        const s = Number(d?.tickerSpeed);
        if (Number.isFinite(s) && s > 0) setSpeed(s);
      }).catch(() => {});
    };
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => { on = false; clearInterval(iv); };
  }, []);

  // Rotación de capital cada 30s, alineada al reloj: si toca otra, la actual sale (fade + sube) y entra la nueva.
  const shownRef = useRef(shownIdx);
  shownRef.current = shownIdx;
  const busy = useRef(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const iv = setInterval(() => {
      const n = citiesRef.current.length;
      if (n < 2 || busy.current) return;
      const target = cityIdxNow(n);
      if (shownRef.current % n === target) return;
      busy.current = true;
      setLeaving(true);
      timer = setTimeout(() => { setShownIdx(target); setSwapped(true); setLeaving(false); busy.current = false; }, 320);
    }, 1000);
    return () => { clearInterval(iv); if (timer) clearTimeout(timer); busy.current = false; };
  }, []);

  const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const fecha = `${now.getDate()} ${MESES[now.getMonth()]}`;
  const cur = cities.length ? cities[shownIdx % cities.length] : undefined;

  return (
    <>
      <style>{CSS + (IS_VERTICAL ? CSS_V : "")}</style>

      {!hideClock && <div className="ck-clock">{clock} | {fecha}</div>}
      {/* Columna temperatura + logo: las dos cards comparten el ancho (la del logo se estira al de la temperatura). */}
      <div className="ck-tl">
        {!hideTemp && cur && cur.tempC != null && (
          <div className="ck-temp">
            <div key={cur.city} className={"ck-temp-in" + (leaving ? " out" : swapped ? " in" : "")}>
              <span className="ck-temp-val">{cur.tempC}°C</span>
              <span className="ck-temp-city">{cur.city.toUpperCase()}</span>
            </div>
          </div>
        )}
        {!hideLogo && !(hideClock && hideTemp) && (
          <div className="ck-logo">
            <img src={ciclicoWhite} alt="Cíclico" />
          </div>
        )}
      </div>

      <div className="ck-ticker">
        <div className="ck-track" style={{ animationDuration: `${speed}s` }}>
          {[0, 1].map((dup) => (
            <div className="ck-seq" key={dup} aria-hidden={dup === 1}>
              {ticker.map((it, i) => (
                <span className="ck-item" key={dup + "-" + i}>
                  {it.cats[0] && <b className="ck-cat">{it.cats[0].toUpperCase()}:</b>}
                  {it.title}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <img className="ck-qr" src={qrCiclico} alt="Somos Cíclico" />
    </>
  );
}

// Vertical (1080x1920): hora a la izquierda y temperatura + logo a la derecha, en una sola fila arriba; ticker abajo.
const CSS_V = `
.ck-clock{top:56px;left:60px;right:auto}
.ck-tl{top:56px;right:60px;flex-direction:row;align-items:stretch;gap:12px}
.ck-temp{flex-direction:row;align-items:center;padding:10px 20px;min-width:0}
.ck-temp-in{flex-direction:row;align-items:center;gap:14px}
.ck-temp-val{font-size:30px}
.ck-temp-city{font-size:18px}
.ck-logo{align-self:stretch;width:auto;min-width:0;padding:6px 14px}
.ck-logo img{height:44px}
.ck-clock{z-index:200}
.ck-tl{z-index:200}
.ck-ticker{z-index:190}
.ck-qr{display:none}
`;

const CSS = `
.ck-clock{position:absolute;top:78px;right:100px;z-index:30;background:linear-gradient(180deg,#3b82f6,#2f6bff);color:#fff;font-weight:800;font-size:30px;letter-spacing:.01em;padding:10px 20px;border-radius:12px;box-shadow:0 6px 16px rgba(0,0,0,.25)}
.ck-tl{position:absolute;top:150px;right:100px;z-index:30;display:flex;flex-direction:column;align-items:stretch;gap:10px}
.ck-temp{min-width:120px;background:linear-gradient(180deg,#3b82f6,#2f6bff);color:#fff;line-height:1;padding:12px 22px;border-radius:12px;box-shadow:0 6px 16px rgba(0,0,0,.25);display:flex;flex-direction:column;align-items:flex-end;text-align:right;gap:6px}
.ck-logo{align-self:flex-end;width:50%;min-width:92px;box-sizing:border-box;background:linear-gradient(180deg,#3b82f6,#2f6bff);padding:8px 14px;border-radius:12px;box-shadow:0 6px 16px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center}
.ck-logo img{height:46px;width:auto;display:block}
.ck-temp-in{display:flex;flex-direction:column;align-items:flex-end;gap:6px;transition:opacity .3s ease,transform .3s ease}
.ck-temp-in.out{opacity:0;transform:translateY(-14px)}
.ck-temp-in.in{animation:ck-swap-in .5s cubic-bezier(.2,.8,.2,1)}
@keyframes ck-swap-in{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.ck-temp-val{font-size:36px;font-weight:800}
.ck-temp-city{font-size:20px;font-weight:700;opacity:.95}

/* Barra del ticker: CENTRADA en el mismo eje que la pastilla del QR (que mide ~139px de alto
   a 270px de ancho, con bottom:12px → centro ≈81px). Franja fina, NO pegada al borde inferior. */
.ck-ticker{position:absolute;left:0;right:0;bottom:52px;height:58px;z-index:28;background:#fff;overflow:hidden;display:flex;align-items:center;box-shadow:0 6px 18px rgba(0,0,0,.18)}
.ck-track{display:flex;white-space:nowrap;will-change:transform;animation:ck-scroll 60s linear infinite}
.ck-seq{display:flex}
.ck-item{color:#1a3aa8;font-weight:700;font-size:24px;letter-spacing:.01em;padding:0 34px}
.ck-cat{color:#EE220C;font-weight:900;margin-right:12px}
@keyframes ck-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.ck-qr{position:absolute;left:34px;bottom:12px;width:270px;height:auto;z-index:29;filter:drop-shadow(0 6px 16px rgba(0,0,0,.3))}
`;
