import { useEffect, useState } from "react";
import { API_BASE } from "../lib/scene";
import qrCiclico from "../assets/qr-ciclico.png";

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

interface TickerItem { title: string; cats: string[] }
interface ClimaCity { city: string; tempC: number | null }

// Marco estándar PERSISTENTE compartido por todas las placas:
// pills reloj + temperatura (rota capitales cada 30s, desde la API de clima),
// y newsticker con titulares en vivo de somosciclico.com. No entra/sale con el contenido.
// tickerSpeed = segundos que tarda una vuelta completa del texto (mayor = más lento).
// Valor por defecto; el real se lee de /api/settings (editable desde AJUSTES).
export function Chrome({ tickerSpeed = 90, hideClockTemp = false }: { tickerSpeed?: number; hideClockTemp?: boolean } = {}) {
  const [now, setNow] = useState(() => new Date());
  const [ticker, setTicker] = useState<TickerItem[]>([]);
  const [cities, setCities] = useState<ClimaCity[]>([]);
  const [cityIdx, setCityIdx] = useState(0);
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
        if (items.length) setTicker(items);
      }).catch(() => {});
      fetch(`${API_BASE}/api/data/clima`).then((r) => r.json()).then((d) => {
        if (!on) return;
        const cs: ClimaCity[] = d?.payload?.cities ?? [];
        if (cs.length) setCities(cs);
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

  // Rotación de capital cada 30s.
  useEffect(() => {
    if (cities.length === 0) return;
    const t = setInterval(() => setCityIdx((i) => (i + 1) % cities.length), 30_000);
    return () => clearInterval(t);
  }, [cities.length]);

  const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const fecha = `${now.getDate()} ${MESES[now.getMonth()]}`;
  const cur = cities[cityIdx];

  return (
    <>
      <style>{CSS}</style>

      {!hideClockTemp && <div className="ck-clock">{clock} | {fecha}</div>}
      {!hideClockTemp && cur && cur.tempC != null && (
        <div className="ck-temp">
          <span className="ck-temp-val">{cur.tempC}°C</span>
          <span className="ck-temp-city">{cur.city.toUpperCase()}</span>
        </div>
      )}

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

const CSS = `
.ck-clock{position:absolute;top:78px;right:100px;z-index:30;background:linear-gradient(180deg,#3b82f6,#2f6bff);color:#fff;font-weight:800;font-size:30px;letter-spacing:.01em;padding:10px 20px;border-radius:12px;box-shadow:0 6px 16px rgba(0,0,0,.25)}
.ck-temp{position:absolute;top:150px;right:100px;z-index:30;min-width:120px;background:linear-gradient(180deg,#3b82f6,#2f6bff);color:#fff;line-height:1;padding:12px 22px;border-radius:12px;box-shadow:0 6px 16px rgba(0,0,0,.25);display:flex;flex-direction:column;align-items:flex-end;text-align:right;gap:6px}
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
