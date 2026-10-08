import { useEffect, useMemo, useRef } from "react";
import type { ClimaCiudad, ClimaData, ClimaPayload } from "@newsroller/shared";
import { climaEstado, climaWithPreview } from "@newsroller/shared";
import { IS_VERTICAL } from "../../lib/orientation";
import { P } from "../../lib/params";
import { climaBigUrl, climaDayUrl, useClimaIcons } from "../../templates/Clima";
import { Grain, NM_CSS, useLife } from "./base";
import { ModernChrome } from "./Chrome";

// Clima, colección Modernas: todo de frente y sólo con los datos de la API (Open-Meteo). Card principal con la
// temperatura, el estado, la ciudad y máx/mín de hoy; card chica con sensación, humedad y viento; debajo, la franja
// del estado actual que corre (del borde izquierdo de la card de temperatura al borde derecho de la de la derecha,
// con los extremos oscurecidos como todos los tickers) y los tres días, que se dan vuelta como cartas.
// El ícono grande (el de Ajustes, según el cielo) va SIEMPRE por encima de las cards, pisándolas un poco, y flota.
// Entra de izquierda a derecha. Con sol gira apenas y, ya ubicado, le salen rayos y luz amarilla detrás; de fondo,
// lluvia, nieve o brisa según el tiempo (ver WeatherFx), y relámpago con lluvia o tormenta.
// Al salir, el ícono se va hacia arriba.
const DIAS = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
const FREEZE = P.has("freeze");

// Fondo animado según el tiempo: lluvia (más gotas y más largas si es lluvia que si es llovizna), nieve que
// revolotea, y brisa (rachas finas y polvo que cruzan) cuando el viento pasa de 20 km/h (más fuerte desde 40).
// El viento también inclina la lluvia y arrastra la nieve.
type FxKind = "rain" | "drizzle" | "snow" | null;
function WeatherFx({ kind, wind }: { kind: FxKind; wind: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const W = IS_VERTICAL ? 540 : 960;
  const H = IS_VERTICAL ? 960 : 540;
  useEffect(() => {
    const c = ref.current;
    const x = c?.getContext("2d");
    if (!c || !x) return;
    const R = Math.random;
    const breeze = wind >= 40 ? 2 : wind >= 20 ? 1 : 0;
    const slant = kind ? 0.28 + breeze * 0.22 : 0;
    const drops = kind === "rain" || kind === "drizzle"
      ? Array.from({ length: kind === "rain" ? 320 : 150 }, () => ({
          x: R() * (W + 200), y: R() * H,
          l: kind === "rain" ? 12 + R() * 20 : 6 + R() * 8,
          v: kind === "rain" ? 10 + R() * 10 : 5 + R() * 4,
        }))
      : [];
    const flakes = kind === "snow"
      ? Array.from({ length: 170 }, () => ({ x: R() * W, y: R() * H, r: 0.8 + R() * 2.6, v: 0.5 + R() * 1.1, ph: R() * 6.3, sw: 0.4 + R() * 1.2 }))
      : [];
    const gusts = breeze
      ? Array.from({ length: (kind ? 10 : 24) * breeze }, () => ({ x: R() * W, y: R() * H, l: 80 + R() * 180, v: (5 + R() * 6) * breeze, a: 0.22 + R() * 0.3, ph: R() * 6.3 }))
      : [];
    const dust = breeze && !kind
      ? Array.from({ length: 30 * breeze }, () => ({ x: R() * W, y: R() * H, v: (2 + R() * 3) * breeze, ph: R() * 6.3, r: 0.6 + R() * 1.4 }))
      : [];
    let raf = 0;
    let t = 0;
    const tick = () => {
      t++;
      x.clearRect(0, 0, W, H);
      if (drops.length) {
        x.strokeStyle = kind === "rain" ? "rgba(170,195,255,.6)" : "rgba(170,195,255,.45)";
        x.lineWidth = kind === "rain" ? 1.3 : 1;
        x.beginPath();
        for (const d of drops) {
          x.moveTo(d.x, d.y);
          x.lineTo(d.x - d.l * slant, d.y + d.l);
          d.y += d.v; d.x -= d.v * slant;
          if (d.y > H + 20) { d.y = -30; d.x = R() * (W + 200); }
        }
        x.stroke();
      }
      if (flakes.length) {
        x.fillStyle = "rgba(235,242,255,.85)";
        for (const f of flakes) {
          x.beginPath(); x.arc(f.x, f.y, f.r, 0, 6.3); x.fill();
          f.y += f.v; f.x += Math.sin(t * 0.02 + f.ph) * f.sw + breeze * 0.9;
          if (f.y > H + 6) { f.y = -6; f.x = R() * W; }
          if (f.x > W + 6) f.x = -6; else if (f.x < -6) f.x = W + 6;
        }
      }
      for (const g of gusts) {
        const a = g.a * (0.6 + 0.4 * Math.sin(t * 0.03 + g.ph));
        const gr = x.createLinearGradient(g.x, 0, g.x + g.l, 0);
        gr.addColorStop(0, "rgba(200,215,255,0)"); gr.addColorStop(0.5, `rgba(200,215,255,${a})`); gr.addColorStop(1, "rgba(200,215,255,0)");
        x.strokeStyle = gr; x.lineWidth = 1.6;
        x.beginPath(); x.moveTo(g.x, g.y); x.quadraticCurveTo(g.x + g.l / 2, g.y - 6 * Math.sin(t * 0.05 + g.ph), g.x + g.l, g.y); x.stroke();
        g.x += g.v;
        if (g.x > W + 20) { g.x = -g.l - R() * 200; g.y = R() * H; }
      }
      if (dust.length) {
        x.fillStyle = "rgba(220,228,255,.6)";
        for (const d of dust) {
          x.beginPath(); x.arc(d.x, d.y, d.r, 0, 6.3); x.fill();
          d.x += d.v; d.y += Math.sin(t * 0.04 + d.ph) * 0.6;
          if (d.x > W + 4) { d.x = -4; d.y = R() * H; }
        }
      }
      if (!FREEZE) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [kind, wind, W, H]);
  return <canvas ref={ref} className={"nmw-fx" + (kind === "snow" ? " snow" : !kind ? " wind" : "")} width={W} height={H} />;
}

export function Clima({ data, live, durationSec }: { data: ClimaData; live?: ClimaPayload; durationSec?: number }) {
  const { cls } = useLife(durationSec, 1.1);
  const { custom, day, loaded } = useClimaIcons();
  // Franja del estado: velocidad pareja y lenta (~45 px/s) sea cual sea el largo del texto (se mide la mitad del recorrido).
  const trkRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = trkRef.current;
    if (el) el.style.animationDuration = `${Math.max(20, Math.round(el.scrollWidth / 2 / 45))}s`;
  });
  const c: ClimaCiudad | undefined = useMemo(() => {
    const x = live?.cities.find((y) => y.city === data.city) ?? live?.cities[0];
    return x && climaWithPreview(x, data.preview); // vista previa de Ajustes: estado forzado
  }, [live, data.city, data.preview]);

  if (!c) {
    return (
      <div className={"nm nmw" + cls}>
        <style>{NM_CSS}</style>
        <div className="nm-bg" /><Grain />
        <ModernChrome />
      </div>
    );
  }

  const estado = climaEstado(c.code);
  const night = c.isDay === false;
  const sun = estado === "despejado" && !night;
  const fx: FxKind = /nevada|granos_nieve|chaparrones_nieve/.test(estado) ? "snow" : /llovizna/.test(estado) ? "drizzle" : /lluvia|chaparrones$|tormenta/.test(estado) ? "rain" : null;
  const wind = c.windKmh ?? 0;
  const bolt = /^lluvia|chaparrones$|tormenta/.test(estado);
  const days = c.days.slice(0, 3);
  const cityName = c.city === "Buenos Aires" ? "CABA" : c.city;
  const citySize = cityName.length > 26 ? 24 : cityName.length > 16 ? 30 : 40;
  const n = (v: number | null | undefined, u = "°") => (v == null ? "--" : `${v}${u}`);
  const items = Array.from({ length: 12 }, (_, i) => <span key={i}>{c.desc}</span>);

  return (
    <div className={"nm nmw" + cls + (sun ? " sun" : "") + (IS_VERTICAL ? " v" : "")}>
      <style>{NM_CSS + CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <div className="nm-bg" /><div className="nmw-sky" /><Grain />
      {sun && <div className="nmw-glow" />}
      {(fx || wind >= 20) && <WeatherFx kind={fx} wind={wind} />}
      {bolt && <div className="nmw-bolt" />}
      <div className="nm-sc nmw-sc">
        <div className="nm-panel nmw-x">
          <div className="nm-inner">
            <div className="nmw-r"><span>Sensación</span><b>{n(c.feelsLike)}</b></div>
            <div className="nmw-r"><span>Humedad</span><b>{n(c.humidity, "%")}</b></div>
            <div className="nmw-r"><span>Viento</span><b>{n(c.windKmh, " km/h")}</b></div>
          </div>
        </div>
        <div className="nm-panel nmw-m">
          <div className="nm-inner">
            <div className="nmw-t">{c.tempC ?? "--"}<sup>°C</sup></div>
            <div className="nmw-side">
              <div className="nm-lab">{c.desc}</div>
              <div className="nmw-city" style={{ fontSize: citySize }}>{cityName}</div>
              <div className="nmw-mm">Máx <b>{n(days[0]?.max)}</b> · Mín <b>{n(days[0]?.min)}</b></div>
            </div>
          </div>
        </div>
        <div className="nmw-tk"><div className="nmw-trk" ref={trkRef}>{items}{items}</div></div>
        <div className="nmw-days">
          {days.map((d, i) => (
            <div key={d.date} className="nmw-d" style={{ ["--dl" as string]: `${1.25 + i * 0.15}s`, ["--xo" as string]: `${0.2 - i * 0.1}s` }}>
              <div className="nm-panel">
                <div className="nmw-dn">{i === 0 ? "HOY" : i === 1 ? "MAÑANA" : DIAS[new Date(d.date + "T12:00:00").getDay()]}</div>
                <img decoding="async" src={climaDayUrl(climaEstado(d.code), day)} alt="" />
                <div className="nmw-cond">{d.desc}</div>
                <div className="nmw-dt">{n(d.max)} <small>/ {n(d.min)}</small></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* El ícono grande va en su propia capa, por encima de todas las cards. */}
      <div className="nmw-big">
        {sun && <div className="nmw-rays" />}
        {loaded && <img decoding="async" src={climaBigUrl(estado, night, custom)} alt="" />}
      </div>
      <ModernChrome />
    </div>
  );
}

const CSS = `
.nmw-sc{transform-style:flat}
.nmw-sky{position:absolute;inset:0;opacity:0;background:radial-gradient(1400px 700px at 20% 0%,rgba(40,70,140,.55),transparent 70%)}
.nmw.sun .nmw-sky{background:radial-gradient(1400px 700px at 20% 0%,rgba(80,140,255,.45),transparent 70%)}
.in .nmw-sky{animation:nm-fade 1s ease both}
.nmw-fx{position:absolute;inset:0;width:100%;height:100%;opacity:.55;mix-blend-mode:screen;z-index:1;pointer-events:none}
.nmw-fx.snow{opacity:.85}
.nmw-fx.wind{opacity:.8}
.in .nmw-fx{animation:nm-fade 1s ease both}
.nmw-bolt{position:absolute;inset:0;z-index:2;background:#DCE6FF;mix-blend-mode:screen;opacity:0;pointer-events:none}
.in .nmw-bolt{animation:nmw-bolt 1.3s linear .45s both}
@keyframes nmw-bolt{0%{opacity:0}6%{opacity:.55}10%{opacity:0}18%{opacity:.35}24%{opacity:0}100%{opacity:0}}
.nmw-glow{position:absolute;left:-80px;top:-60px;width:1000px;height:900px;z-index:1;opacity:0;mix-blend-mode:screen;background:radial-gradient(closest-side,rgba(255,206,84,.55),rgba(255,170,40,.18) 50%,transparent)}
.in .nmw-glow{animation:nm-fade 1.2s ease .2s both,nmw-pulse 4s ease-in-out 1.4s infinite alternate}
@keyframes nmw-pulse{from{opacity:1}to{opacity:.7}}

/* Card principal y card de datos */
.nmw-m{left:520px;top:160px;width:800px;height:380px;opacity:0}
.nmw-m .nm-inner{padding:40px 48px 86px 172px;flex-direction:row;align-items:flex-end;justify-content:space-between}
.in .nmw-m{animation:nm-up .9s cubic-bezier(.2,.8,.2,1) .15s both}
.nmw-t{font-family:var(--display);font-weight:800;font-stretch:80%;font-size:240px;line-height:.8;letter-spacing:-.04em;color:var(--paper);font-variant-numeric:tabular-nums}
.nmw-t sup{font-size:.4em;vertical-align:.95em;color:var(--blue-soft)}
.nmw-side{display:flex;flex-direction:column;align-items:flex-end;gap:8px;text-align:right;padding-bottom:10px;min-width:0;max-width:340px}
.nmw-side .nm-lab{color:var(--blue-soft)}
.nmw-city{font-family:var(--display);font-weight:800;font-stretch:112%;font-size:40px;line-height:1.05;letter-spacing:.06em;color:var(--paper);text-transform:uppercase}
.nmw-mm{font-family:var(--display);font-weight:600;font-size:26px;color:var(--mist);font-variant-numeric:tabular-nums;white-space:nowrap}
.nmw-mm b{color:var(--paper)}
.nmw-x{left:1360px;top:190px;width:464px;height:300px;opacity:0}
.nmw-x .nm-inner{padding:34px 42px 34px 70px;gap:0;justify-content:center}
.in .nmw-x{animation:nmw-fromR .9s cubic-bezier(.16,.9,.2,1) .5s both}
@keyframes nmw-fromR{from{opacity:0;transform:translateX(500px)}to{opacity:1;transform:none}}
.nmw-r{display:flex;justify-content:space-between;align-items:baseline;padding:12px 0;border-bottom:1px solid var(--line)}
.nmw-r:last-child{border-bottom:0}
.nmw-r span{font-family:var(--display);font-weight:600;font-stretch:112%;font-size:15px;letter-spacing:.22em;text-transform:uppercase;color:var(--mist)}
.nmw-r b{font-family:var(--display);font-weight:700;font-size:32px;color:var(--paper);font-variant-numeric:tabular-nums}

/* Franja del estado actual: del borde izquierdo de la card principal al borde derecho de la de datos.
   Mismo tratamiento que los tickers de la casa: barra blanca, sombra interna y extremos oscurecidos. */
.nmw-tk{position:absolute;left:520px;top:570px;width:1304px;height:74px;overflow:hidden;display:flex;align-items:center;background:#fff;
  box-shadow:inset 0 0 24px rgba(0,0,0,.28),inset 0 2px 6px rgba(0,0,0,.2);
  -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 13%,#000 87%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 13%,#000 87%,transparent 100%)}
/* Extremos bien marcados: la barra se oscurece y a la vez se vuelve transparente hacia los bordes. */
.nmw-tk::before,.nmw-tk::after{content:"";position:absolute;top:0;bottom:0;width:26%;z-index:2;pointer-events:none}
.nmw-tk::before{left:0;background:linear-gradient(90deg,rgba(2,6,20,.95) 0%,rgba(2,6,20,.6) 35%,rgba(2,6,20,0) 100%)}
.nmw-tk::after{right:0;background:linear-gradient(270deg,rgba(2,6,20,.95) 0%,rgba(2,6,20,.6) 35%,rgba(2,6,20,0) 100%)}
.nmw-trk{display:flex;align-items:center;white-space:nowrap;will-change:transform;animation:nm-tick 40s linear infinite}
.nmw-trk span{display:flex;align-items:center;gap:14px;padding:0 28px;font-family:var(--display);font-weight:800;font-stretch:112%;font-size:26px;letter-spacing:.24em;text-transform:uppercase;color:#0A1433}
.nmw-trk span::after{content:"";width:6px;height:6px;border-radius:50%;background:rgba(10,20,51,.25);margin-left:14px}
.in .nmw-tk{animation:nmw-wipe .8s cubic-bezier(.7,0,.2,1) .95s both}
@keyframes nmw-wipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}

/* Días: cartas que se dan vuelta */
.nmw-days{position:absolute;left:520px;top:680px;width:1304px;height:240px;display:grid;grid-template-columns:repeat(3,1fr);gap:28px;perspective:1600px}
.nmw-d{position:relative;opacity:0}
.nmw-d .nm-panel{inset:0;padding:24px 28px;display:grid;grid-template-columns:1fr auto;grid-template-rows:auto 1fr auto;gap:4px 12px}
.in .nmw-d{animation:nmw-flip .9s cubic-bezier(.2,.8,.2,1) var(--dl) both}
@keyframes nmw-flip{from{opacity:0;transform:rotateY(-95deg)}to{opacity:1;transform:none}}
.nmw-dn{font-family:var(--display);font-weight:800;font-stretch:115%;font-size:17px;letter-spacing:.28em;color:var(--blue-soft)}
.nmw-d img{grid-row:1/3;grid-column:2;width:96px;height:96px;object-fit:contain;filter:drop-shadow(0 10px 14px rgba(0,0,0,.5))}
.nmw-cond{font-size:21px;color:var(--mist);align-self:start}
.nmw-dt{grid-column:1/3;font-family:var(--display);font-weight:800;font-size:54px;color:var(--paper);font-variant-numeric:tabular-nums}
.nmw-dt small{font-size:.6em;color:var(--mist);font-weight:600}

/* Ícono grande: capa propia por encima de las cards (z 22 > escena 20), flotando. */
.nmw-big{position:absolute;left:50px;top:118px;width:640px;z-index:22;pointer-events:none;filter:drop-shadow(0 50px 60px rgba(0,0,0,.55))}
.nmw-big img{position:relative;width:100%;display:block;opacity:0}
.in .nmw-big img{animation:nmw-bigIn 1.2s cubic-bezier(.2,.8,.2,1) .25s both,nmw-bob 6s ease-in-out 1.5s infinite alternate}
/* Entra de izquierda a derecha con un poco de fade (sin caer desde arriba). */
@keyframes nmw-bigIn{0%{opacity:0;transform:translateX(-260px) scale(.94)}55%{opacity:1}100%{opacity:1;transform:none}}
@keyframes nmw-bob{from{opacity:1;transform:none}to{opacity:1;transform:translateY(-16px) rotate(-1.2deg)}}
.nmw.sun .nmw-big{width:560px;left:70px;top:110px;filter:drop-shadow(0 30px 50px rgba(0,0,0,.35))}
.in.nmw.sun .nmw-big img{animation:nmw-bigIn 1.2s cubic-bezier(.2,.8,.2,1) .25s both,nmw-sunTurn 10s ease-in-out 1.5s infinite alternate}
@keyframes nmw-sunTurn{from{opacity:1;transform:rotate(-5deg) translateY(0)}to{opacity:1;transform:rotate(7deg) translateY(-12px)}}
.nmw-rays{position:absolute;inset:-22%;border-radius:50%;opacity:0;
  background:repeating-conic-gradient(rgba(255,214,100,.34) 0 5deg,transparent 5deg 15deg);
  -webkit-mask:radial-gradient(closest-side,transparent 34%,#000 42%,transparent 100%);mask:radial-gradient(closest-side,transparent 34%,#000 42%,transparent 100%)}
/* Los rayos aparecen cuando el sol ya llegó a su lugar (termina de entrar a los 1,45 s): se abren y giran. */
.in .nmw-rays{animation:nmw-raysIn 1s cubic-bezier(.2,.8,.2,1) 1.45s both,nmw-spin 50s linear 1.45s infinite}
@keyframes nmw-raysIn{from{opacity:0;scale:.55}to{opacity:1;scale:1}}
@keyframes nmw-spin{to{transform:rotate(360deg)}}

/* Salida */
.out .nmw-tk{animation:nm-fadeOut .5s ease .3s both}
.out .nmw-d{animation:nm-fadeOut .5s ease var(--xo) both}
.out .nmw-m,.out .nmw-x{animation:nm-fadeOut .6s ease .45s both}
.out .nmw-big img,.out.nmw.sun .nmw-big img{animation:nmw-bigOut 1s cubic-bezier(.5,0,.8,.4) .1s both}
.out .nmw-rays{animation:nm-fadeOut .6s ease both}
@keyframes nmw-bigOut{from{opacity:1;transform:none}to{opacity:0;transform:translate(-80px,-480px) scale(.9) rotate(6deg)}}
.out .nmw-fx,.out .nmw-sky,.out .nmw-glow{animation:nm-fadeOut .8s ease .5s both}
`;

// Vertical: ícono arriba a la izquierda pisando la card principal; debajo, datos en fila, la franja al ancho de las
// cards y los tres días.
const CSS_V = `
.nmw-big{left:30px;top:170px;width:560px}
.nmw.sun .nmw-big{left:50px;top:190px;width:470px}
.nmw-m{left:60px;top:330px;width:960px;height:420px}
.nmw-m .nm-inner{flex-direction:column;align-items:flex-end;justify-content:center;gap:14px;padding:40px 50px}
.nmw-side{max-width:none}
.nmw-x{left:60px;top:790px;width:960px;height:170px}
.nmw-x .nm-inner{flex-direction:row;padding:0 20px}
.nmw-r{flex:1;flex-direction:column;align-items:center;justify-content:center;gap:10px;border-bottom:0;border-right:1px solid var(--line)}
.nmw-r:last-child{border-right:0}
.nmw-tk{left:60px;top:1000px;width:960px}
.nmw-days{left:60px;top:1114px;width:960px;height:330px;gap:20px}
.nmw-d .nm-panel{padding:22px;grid-template-columns:1fr;grid-template-rows:auto auto 1fr auto}
.nmw-d img{grid-row:auto;grid-column:auto;width:84px;height:84px}
.nmw-dt{grid-column:auto}
`;
