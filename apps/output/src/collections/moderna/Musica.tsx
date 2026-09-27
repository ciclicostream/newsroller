import { useEffect, useRef, useState } from "react";
import type { MusicaData } from "@newsroller/shared";
import { musicaLineIndex } from "@newsroller/shared";
import { IS_VERTICAL } from "../../lib/orientation";
import { P } from "../../lib/params";
import { Grain, Lights, NM_CSS, Words, fechaCompleta, useFit, useFitMax, useLife } from "./base";
import { ModernChrome } from "./Chrome";

const WANT_AUDIO = P.has("audio");
// ?t=SEGUNDOS (sólo para revisar demos): arranca el reloj de la canción en ese segundo.
// Máximo de caracteres de la descripción del álbum (el formulario del panel usa el mismo).
const DESC_MAX = 350;
const START_AT = Number(P.get("t")) || 0;

// Segundo de la canción en cada cuadro. Con el audio sonando manda su reloj; si todavía no arrancó (o se cortó) sigue
// el reloj del navegador desde donde estaba, así la letra no se traba y en el monitor de edición (sin audio) también corre.
// También mueve la barra de avance directo en el DOM (sin re-renderizar).
// Ángulo del disco en el segundo `sec`: gira a velocidad pareja y frena como un tocadiscos real en los últimos
// `BRAKE_S` segundos (o menos si el tema dura menos), hasta quedar del todo detenido justo al terminar. La
// desaceleración es cuadrática (r² con r = tiempo que falta / ventana de frenado): arranca suave, sin salto de
// velocidad al entrar en la frenada, y llega a velocidad 0 exactamente en total.
const DISC_SPEED = 180; // grados/seg a velocidad plena (2s por vuelta, igual que antes)
const BRAKE_S = 30;
function discAngle(sec: number, total: number): number {
  const t = Math.min(sec, total);
  const bw = Math.max(0.001, Math.min(BRAKE_S, total)); // ventana de frenado (no más larga que el propio tema)
  const brakeStart = Math.max(0, total - bw);
  if (t <= brakeStart) return DISC_SPEED * t;
  const r = Math.max(0, (total - t) / bw);
  return DISC_SPEED * brakeStart + (DISC_SPEED * bw / 3) * (1 - r ** 3);
}

// Segundo de la canción en cada cuadro. Con el audio sonando manda su reloj; si todavía no arrancó (o se cortó) sigue
// el reloj del navegador desde donde estaba, así la letra no se traba y en el monitor de edición (sin audio) también corre.
// También mueve la barra de avance y el giro del disco directo en el DOM (sin re-renderizar).
function useSong(audio: React.RefObject<HTMLAudioElement>, bar: React.RefObject<HTMLDivElement>, disc: React.RefObject<HTMLDivElement>, lines: MusicaData["lyrics"], total: number): number {
  const [idx, setIdx] = useState(-1);
  useEffect(() => {
    let raf = 0;
    let t0 = performance.now() - START_AT * 1000;
    const tick = (now: number) => {
      const a = audio.current;
      let sec: number;
      if (a && !a.paused && a.currentTime > 0) { sec = a.currentTime; t0 = now - sec * 1000; }
      else sec = (now - t0) / 1000;
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, Math.max(0, sec / Math.max(1, total)))})`;
      if (disc.current) disc.current.style.transform = `rotate(${discAngle(Math.max(0, sec), total)}deg)`;
      if (lines?.length) {
        const i = musicaLineIndex(lines, sec, total);
        setIdx((cur) => (cur === i ? cur : i));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audio, bar, disc, lines, total]);
  return idx;
}

// Cada barra del ecualizador sube y baja a su propio ritmo y con alturas distintas (valores fijos pseudoaleatorios por barra).
const EQ_BARS = 8;
const eqR = (i: number, k: number) => 0.12 + 0.88 * (((i * 7919 + k * 104729 + 13) % 101) / 100);
const eqStyle = (i: number): React.CSSProperties => ({
  ["--a" as string]: eqR(i, 1), ["--b" as string]: eqR(i, 2), ["--c" as string]: eqR(i, 3), ["--e" as string]: eqR(i, 4), ["--f" as string]: eqR(i, 5),
  ["--s" as string]: `${0.9 + eqR(i, 6) * 1.1}s`, ["--d" as string]: `${-eqR(i, 7) * 2}s`,
});

// Una línea de la letra, con su propio ajuste de tamaño. La que se va sale con un fundido mientras entra la nueva.
function Line({ text, old }: { text: string; old: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useFit(ref, 46, 22, [text]);
  return <div className={"nmm-l" + (old ? " old" : "")} ref={ref}><span>{text}</span></div>;
}

// Música (canción), colección Modernas: la portada es el único módulo girado, con un disco que sale de atrás y gira.
// Tema en grande, álbum en la volanta, géneros y fecha en píldoras, y descripción y créditos en paneles de vidrio.
// La letra va de a una línea, sin resaltado, sincronizada con el audio, dentro de un panel con una barra de avance del
// tema; mientras no se canta (intro, pausas o sin letra) late un ecualizador.
export function Musica({ data, durationSec }: { data: MusicaData; durationSec?: number }) {
  const { cls } = useLife(durationSec, 3);
  const audioRef = useRef<HTMLAudioElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const eqRef = useRef<HTMLDivElement>(null);
  const discSpinRef = useRef<HTMLDivElement>(null);
  const [noCors, setNoCors] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const credRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  // Ecualizador real: con el audio sonando en el aire (?audio=1) las barras siguen las frecuencias del tema (Web Audio API,
  // sin bibliotecas). En los monitores (audio mudo) o si el archivo no permite el análisis (CORS), se queda con la animación propia.
  useEffect(() => {
    const a = audioRef.current;
    const box = eqRef.current;
    if (!WANT_AUDIO || !a || !box || noCors) return;
    let ctx: AudioContext | undefined, an: AnalyserNode | undefined, raf = 0;
    const bars = Array.from(box.children) as HTMLElement[];
    const buf = new Uint8Array(32);
    const loop = () => {
      an!.getByteFrequencyData(buf);
      let sum = 0;
      bars.forEach((b, i) => {
        const v = Math.min(1, Math.pow(buf[Math.round(1 + i * (28 / bars.length))]! / 255, 1.5) * 1.3);
        sum += v;
        b.style.transform = `scaleY(${Math.max(0.08, v)})`;
      });
      box.classList.toggle("live", sum > 0.05);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (ctx) return;
      try {
        ctx = new AudioContext();
        const src = ctx.createMediaElementSource(a);
        an = ctx.createAnalyser();
        an.fftSize = 64; an.smoothingTimeConstant = 0.72;
        src.connect(an); an.connect(ctx.destination);
        void ctx.resume();
        loop();
      } catch { /* sin análisis: queda la animación propia */ }
    };
    a.addEventListener("playing", start);
    if (!a.paused) start();
    return () => { a.removeEventListener("playing", start); cancelAnimationFrame(raf); void ctx?.close(); };
  }, [data.audio_url, noCors]);

  const lines = data.lyrics?.filter((l) => l.text.trim());
  const idx = useSong(audioRef, barRef, discSpinRef, lines?.length ? lines : undefined, durationSec ?? 180);
  const credits = data.credits?.trim();
  const ig = data.instagram?.trim().replace(/^@*/, "");
  const desc = data.description?.trim().slice(0, DESC_MAX);
  const date = fechaCompleta(data.release_date);

  // La portada rota con las fotos extra (fundido cada 6 s).
  const imgs = [data.cover_url, ...(data.photos ?? [])].filter(Boolean);
  const [ph, setPh] = useState(0);
  useEffect(() => {
    if (imgs.length < 2) return;
    const iv = setInterval(() => setPh((k) => (k + 1) % imgs.length), 6000);
    return () => clearInterval(iv);
  }, [imgs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // La línea vigente y las que están saliendo (se quitan a los 500 ms).
  const [shown, setShown] = useState<{ i: number; text: string }[]>([]);
  useEffect(() => {
    const text = idx >= 0 ? lines?.[idx]?.text : undefined;
    setShown((cur) => {
      const keep = cur.filter((s) => s.i !== idx);
      return text ? [...keep, { i: idx, text }] : keep;
    });
    const t = setTimeout(() => setShown((cur) => cur.filter((s) => s.i === idx)), 520);
    return () => clearTimeout(t);
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  useFitMax(titleRef, 92, 44, IS_VERTICAL ? 175 : 172, [data.title]);
  // Arranca cuando la última palabra del título ya cayó (t0 del título + su cascada de 28ms/palabra + settle).
  const artistT0 = 1.15 + Math.max(0, (data.title ?? "").trim().split(/\s+/).filter(Boolean).length - 1) * 0.028 + 0.45;
  useFit(credRef, 21, 13, [credits]);

  // Vertical: el conjunto se centra en el alto disponible (entre el marco de arriba y la pill de abajo), así con pocos datos
  // no queda un hueco grande abajo. Es el desplazamiento vertical de portada, disco y cards.
  const nolyr = !lines?.length;
  const crTop = nolyr && !desc ? 1134 : nolyr ? 1432 : !desc ? 1252 : 1550;
  const vy = IS_VERTICAL ? Math.max(0, Math.round((190 + 1720 - (200 + crTop + 108)) / 2)) : 0;
  useFit(descRef, 30, 15, [desc]);

  // Letra: card chica con el avance del tema arriba. En 16:9 va en el mismo plano que la portada; en 9:16, suelta.
  const lyricCard = (
    <div className="nmm-glass nmm-lz">
      <div className="nmm-bar" />
      <div className="nmm-pr"><div className="nmm-pf2" ref={barRef} /></div>
      <div className="nmm-ly">{shown.map((s) => <Line key={s.i} text={s.text} old={s.i !== idx} />)}</div>
    </div>
  );
  const slabH = nolyr ? 614 : 728; // 16:9: portada 560 + hueco 20 + card de la letra (148, o 34 sin letra)

  return (
    <div style={{ ["--vy" as string]: `${vy}px` }} className={"nm nmm" + cls + (IS_VERTICAL ? " v" : "") + (lines?.length ? "" : " nolyr") + (desc ? "" : " nodesc")}>
      <style>{NM_CSS + CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <div className="nm-bg" />
      <div className="nmm-blob a" /><div className="nmm-blob b" />
      <Grain />
      {/* Luces con los colores de la portada (sólo de ella, no de las fotos que rotan), detrás de las cards. Sólo en 16:9. */}
      {!IS_VERTICAL && <>
        <div className="nmm-cg a"><img src={data.cover_url} alt="" /></div>
        <div className="nmm-cg b"><img src={data.cover_url} alt="" /></div>
        <div className="nmm-cg c"><img src={data.cover_url} alt="" /></div>
      </>}
      <div className="nmm-disc"><div className="nmm-spin" ref={discSpinRef}><div className="nmm-label"><img src={data.cover_url} alt="" /></div></div></div>

      {/* Portada (y en 16:9 la card de la letra) en un solo plano con perspectiva. Lo demás va fuera de la escena 3D. */}
      <div className="nm-sc" style={IS_VERTICAL ? undefined : { perspectiveOrigin: `50% ${170 + slabH / 2}px` }}>
        <div className="nmm-slab" style={IS_VERTICAL ? undefined : { height: slabH }}>
          <div className="nmm-p">
            <div className="nm-pe" />
            <div className="nm-pf">{imgs.map((u, k) => <img key={u + k} className={"nmm-ph" + (k === ph ? " on" : "")} src={u} alt="" />)}<div className="nm-sheen" /></div>
          </div>
          {!IS_VERTICAL && lyricCard}
        </div>
      </div>

      <div className="nmm-flat">
        {/* Álbum + tema anclados abajo: el título crece hacia arriba y siempre queda pegado a las píldoras de género */}
        <div className="nmm-head">
          <div className="nm-kick nmm-k"><span className="rule" /><span className="nmm-alb">{data.album}</span></div>
          <div className="nmm-tw" ref={titleRef}><Words text={data.title} t0={1.15} /></div>
          {data.artist && (
            <div className="nmm-artist">
              <span className="nmm-artist-lb">Intérprete:</span>
              <Words text={data.artist} t0={artistT0} className="nm-ttl nmm-artist-name" />
            </div>
          )}
        </div>
        {(data.genres?.length > 0 || date) && (
          <div className="nmm-gens">
            {(data.genres ?? []).map((g, i) => <span className="nmm-g" key={g} style={{ ["--dl" as string]: `${1.5 + i * 0.12}s` }}>{g}</span>)}
            {date && <span className="nmm-dt" style={{ ["--dl" as string]: `${1.5 + (data.genres?.length ?? 0) * 0.12}s` }}>{date}</span>}
          </div>
        )}

        {desc && (
          <div className="nmm-glass nmm-ds">
            <div className="nm-lab">Sobre el álbum</div>
            <div className="nmm-dst" ref={descRef}>{desc}</div>
          </div>
        )}

        {IS_VERTICAL && lyricCard}

        <div className={"nmm-glass nmm-cr" + (credits ? "" : " solo") + (ig ? " hasig" : "") + (!credits && !ig ? " solo2" : "")}>
          <div className="nmm-ceq" ref={eqRef}>{Array.from({ length: EQ_BARS }, (_, i) => <i key={i} style={eqStyle(i)} />)}</div>
          {ig && (
            <div className="nmm-ig">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5.5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.4" cy="6.6" r=".9" fill="currentColor" stroke="none" /></svg>
              <span>@{ig}</span>
            </div>
          )}
          {credits && <div className="nmm-ct"><div className="nm-lab">Créditos</div><div className="nmm-crt" ref={credRef}>{credits}</div></div>}
        </div>
      </div>

      <div className="nmm-arg">Música independiente argentina</div>
      <Lights />
      {data.audio_url && <audio key={String(noCors)} ref={audioRef} src={data.audio_url} autoPlay muted={!WANT_AUDIO} crossOrigin={WANT_AUDIO && !noCors ? "anonymous" : undefined} onError={() => { if (WANT_AUDIO && !noCors) setNoCors(true); }} />}
      <ModernChrome />
    </div>
  );
}

const CSS = `
/* Luces de ambiente (azul, sin imagen): dos manchas que respiran despacio */
.nmm-blob{position:absolute;border-radius:50%;pointer-events:none;opacity:0;filter:blur(20px)}
.nmm-blob.a{left:980px;top:-260px;width:1100px;height:900px;background:radial-gradient(closest-side,rgba(47,107,255,.34),transparent)}
.nmm-blob.b{left:-260px;top:420px;width:1000px;height:900px;background:radial-gradient(closest-side,rgba(60,110,255,.26),transparent)}
.in .nmm-blob{animation:nm-fade 1.6s ease .2s forwards}
.in .nmm-blob.b{animation-delay:.5s}

/* Vidrio: panel translúcido con borde de luz, reflejo arriba y resplandor azul */
.nmm-flat{position:absolute;inset:0;z-index:21;transform:translateY(var(--vy,0px))}
.nmm-glass{position:absolute;border-radius:18px;opacity:0;
  background:linear-gradient(155deg,rgba(58,96,196,.30) 0%,rgba(14,28,72,.42) 55%,rgba(6,12,34,.52) 100%);
  -webkit-backdrop-filter:blur(16px) saturate(1.35);backdrop-filter:blur(16px) saturate(1.35);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.30),inset 0 0 0 1px rgba(127,162,255,.22),0 40px 80px -30px rgba(0,0,0,.75),0 0 70px -24px rgba(47,107,255,.55)}
.nmm-glass::before{content:"";position:absolute;left:24px;right:24px;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(190,210,255,.95),transparent);opacity:.8}

/* Tres luces amplias y suaves con los colores de la portada (sólo de ella, no de las fotos que rotan), detrás de las cards para que se
   note el cristal: A del lado de "Somos Cíclico", B sobre el disco y la card de descripción, C hacia el extremo del Instagram.
   Cada una toma otra zona de la imagen. Quietas (sólo fundido de entrada): animar capas con desenfoque las hace parpadear. */
.nmm-cg{position:absolute;z-index:18;pointer-events:none;opacity:0;mix-blend-mode:screen;overflow:hidden;
  -webkit-mask-image:radial-gradient(closest-side,rgba(0,0,0,.95),rgba(0,0,0,.55) 45%,transparent 100%);mask-image:radial-gradient(closest-side,rgba(0,0,0,.95),rgba(0,0,0,.55) 45%,transparent 100%)}
.nmm-cg img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:blur(90px) saturate(1.8) brightness(1.15);transform:scale(var(--z,1));object-position:var(--op,50% 50%)}
.nmm-cg.a{left:-380px;top:-360px;width:1100px;height:900px;--o:.4;--z:1.6;--op:0 0}
.nmm-cg.b{left:20px;top:330px;width:1200px;height:960px;--o:.28;--z:1.5;--op:100% 60%}
.nmm-cg.c{left:1240px;top:480px;width:1000px;height:800px;--o:.36;--z:1.8;--op:100% 100%}
.in .nmm-cg{animation:nmm-cgIn 2.2s ease .3s forwards}
.in .nmm-cg.b{animation-delay:.8s}
.in .nmm-cg.c{animation-delay:1.2s}
@keyframes nmm-cgIn{to{opacity:var(--o)}}
.out .nmm-cg{animation:nm-fadeOut 1s ease both}

/* Disco: sale de atrás de la portada y gira, con un halo azul detrás. Va fuera de la escena 3D para quedar siempre detrás. */
.nmm-disc{position:absolute;left:380px;top:200px;width:500px;height:500px;z-index:19;opacity:0;border-radius:50%;box-shadow:0 40px 80px -20px rgba(0,0,0,.8),0 0 50px rgba(47,107,255,.35)}
.nmm-disc::before{content:"";position:absolute;inset:-70px;border-radius:50%;background:radial-gradient(closest-side,rgba(47,107,255,.5),rgba(47,107,255,.12) 62%,transparent)}
.in .nmm-disc{animation:nmm-discIn 1.2s cubic-bezier(.2,.8,.2,1) 1s both}
@keyframes nmm-discIn{from{opacity:0;transform:translateX(-220px)}to{opacity:1;transform:none}}
.nmm-spin{position:absolute;inset:0;border-radius:50%;will-change:transform;
  background:conic-gradient(from 0deg,rgba(255,255,255,0) 0 18%,rgba(160,190,255,.32) 25%,rgba(255,255,255,0) 32% 68%,rgba(160,190,255,.32) 75%,rgba(255,255,255,0) 82%),
    repeating-radial-gradient(circle at 50% 50%,#070a14 0 3px,#14204a 3px 4px);
  box-shadow:inset 0 0 0 2px rgba(127,162,255,.35)}
.nmm-label{position:absolute;left:50%;top:50%;width:170px;height:170px;margin:-85px 0 0 -85px;border-radius:50%;overflow:hidden;box-shadow:0 0 0 6px #050B1F,0 0 0 8px rgba(127,162,255,.5)}
.nmm-label img{width:100%;height:100%;object-fit:cover;display:block}

/* Portada: el único módulo girado. */
.nmm-slab{position:absolute;left:130px;top:170px;width:560px;height:728px;transform-style:preserve-3d;transform-origin:0 50%;transform:rotateY(21deg);will-change:transform}
.nmm-p{position:absolute;left:0;top:0;width:560px;height:560px;transform-style:preserve-3d}
.nmm-p .nm-pf img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.nmm-ph{opacity:0;transition:opacity 1.3s ease}
.nmm-ph.on{opacity:1}
.nmm-p .nm-pe{box-shadow:0 70px 140px -30px rgba(0,0,0,.85),0 0 100px -6px rgba(47,107,255,.6)}
.nmm-p>*{opacity:0}
.in .nmm-p>*{animation:nmm-lit 1.3s ease-out .35s both}
.in .nmm-p .nm-sheen{animation:nm-sheen 1.2s cubic-bezier(.4,0,.2,1) 1.1s both}
@keyframes nmm-lit{0%{opacity:0;filter:brightness(0)}50%{opacity:1;filter:brightness(1.6)}100%{opacity:1;filter:brightness(1)}}

/* Pill del marco, entre "Somos Cíclico" y la hora (en vertical, en una fila propia bajo el marco) */
.nmm-arg{position:absolute;top:56px;left:480px;z-index:31;height:58px;padding:0 26px;border-radius:999px;display:flex;align-items:center;white-space:nowrap;
  font-family:var(--display);font-weight:500;font-stretch:112%;font-size:17px;letter-spacing:.24em;text-transform:uppercase;color:#DCE6FF;
  background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);-webkit-backdrop-filter:blur(14px) saturate(1.3);backdrop-filter:blur(14px) saturate(1.3);
  box-shadow:0 10px 30px -12px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.18),0 0 26px -8px rgba(47,107,255,.6);opacity:0}
.in .nmm-arg{animation:nm-fade .8s ease .5s forwards}
.out .nmm-arg{animation:nm-fadeOut .5s ease both}

/* Volanta (álbum), tema y géneros */
.nmm-head{position:absolute;left:940px;top:170px;width:880px;height:226px;display:flex;flex-direction:column;justify-content:flex-end;gap:14px}
.nmm-k{width:100%;letter-spacing:.14em}
.nmm-k .rule{box-shadow:0 0 16px 2px rgba(47,107,255,.95)}
.nmm-alb{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 0 22px rgba(47,107,255,.7)}
.nmm-tw{width:100%;font-size:92px}
.nmm-artist{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;width:100%;font-size:30px;font-weight:700;color:#9fb4ff;letter-spacing:.01em;margin-top:4px}
.nmm-artist-lb{flex:none}
.nmm-artist-name{font-size:inherit;line-height:1.2}
.nmm-tw .nm-ttl{font-size:inherit;line-height:1.02;text-shadow:0 0 44px rgba(47,107,255,.35),0 4px 0 rgba(0,0,0,.18)}
.nmm-gens{position:absolute;left:940px;top:406px;width:880px;display:flex;flex-wrap:wrap;gap:10px}
.nmm-g{padding:8px 18px 7px;border-radius:999px;border:1px solid rgba(127,162,255,.55);
  background:linear-gradient(160deg,rgba(60,100,210,.42),rgba(10,22,54,.6));-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 0 22px -6px rgba(47,107,255,.7);color:#DCE6FF;
  font-family:var(--display);font-weight:700;font-stretch:112%;font-size:15px;letter-spacing:.16em;text-transform:uppercase;white-space:nowrap;opacity:0}
.nmm-dt{align-self:center;margin-left:8px;color:var(--mist);font-family:var(--display);font-weight:500;font-stretch:112%;font-size:15px;letter-spacing:.16em;text-transform:uppercase;white-space:nowrap;opacity:0}
.in .nmm-g,.in .nmm-dt{animation:nm-fade .6s ease var(--dl) forwards}

/* Letra: card chica debajo del disco. Avance del tema arriba, líneas celestes que entran y salen con un fundido. */
/* La card de la letra tiene la misma perspectiva que la portada (16:9): el contenedor pone el punto de fuga de la escena. */
.nmm-lz{opacity:0}
.nmm-slab .nmm-lz{left:0;top:580px;width:560px;height:148px;-webkit-backdrop-filter:none;backdrop-filter:none;backface-visibility:hidden;outline:1px solid transparent;
  box-shadow:inset 0 0 0 2px rgba(127,162,255,.13),0 40px 80px -30px rgba(0,0,0,.75),0 0 70px -24px rgba(47,107,255,.55)}
/* Dentro del plano girado las líneas de 1 px se ven escalonadas: reflejo y barra de avance más gruesos y con borde suave. */
.nmm-slab .nmm-lz::before{height:3px;top:-1px;left:30px;right:30px;border-radius:2px;background:linear-gradient(90deg,transparent,rgba(190,210,255,.55) 20%,rgba(215,228,255,.8) 50%,rgba(190,210,255,.55) 80%,transparent);filter:blur(.7px);opacity:.7}
.nmm-slab .nmm-pr{height:6px;top:14px;border-radius:3px}
.nmm-slab .nmm-pf2{border-radius:3px}
.in .nmm-lz{animation:nm-up .9s cubic-bezier(.2,.8,.2,1) 1.75s forwards}
.nmm-lz::after{content:"";position:absolute;left:0;top:0;bottom:0;width:260px;border-radius:18px 0 0 18px;background:linear-gradient(90deg,rgba(80,150,255,.16),transparent);pointer-events:none}
.nmm-pr{position:absolute;left:30px;right:30px;top:16px;height:3px;border-radius:2px;background:rgba(169,182,214,.2)}
.nmm-pf2{height:100%;border-radius:2px;transform-origin:left;transform:scaleX(0);background:linear-gradient(90deg,var(--blue),#9CCBFF 80%,#fff);box-shadow:0 0 14px 2px rgba(90,160,255,.9)}
.nmm-ly{position:absolute;left:30px;right:30px;top:26px;bottom:26px}
.nmm-l{position:absolute;inset:0;display:flex;align-items:center;overflow:hidden;font-family:var(--display);font-weight:600;font-stretch:96%;font-size:46px;line-height:1.15;color:#9CCBFF;text-wrap:balance;
  text-shadow:0 0 22px rgba(90,170,255,.6),0 2px 0 rgba(0,0,0,.25)}
.nmm-l span{display:block;animation:nmm-in .55s ease both}
.nmm-l.old{pointer-events:none}
.nmm-l.old span{animation:nmm-out .45s ease both}
@keyframes nmm-in{from{opacity:0}to{opacity:1}}
@keyframes nmm-out{from{opacity:1}to{opacity:0}}

/* Sin letra: queda sólo la card finita con el avance del tema */
.nolyr .nmm-lz{height:34px}
.nolyr .nmm-lz .nmm-bar,.nolyr .nmm-lz .nmm-ly{display:none}
.nolyr .nmm-lz::after{display:none}
.nolyr .nmm-pr{top:15px}

/* Sobre el álbum: donde estaba la letra */
.nmm-ds{left:940px;top:502px;width:880px;height:290px;padding:28px 36px 24px;box-sizing:border-box;display:flex;flex-direction:column;gap:12px}
.in .nmm-ds{animation:nm-up .8s cubic-bezier(.2,.8,.2,1) 1.6s forwards}
.nmm-dst{flex:1;min-height:0;overflow:hidden;font-size:30px;line-height:1.32;color:#DCE6FF}

/* Sin descripción, sube la card de créditos a su lugar; sin créditos ni Instagram queda una card chica con el ecualizador */
.nodesc .nmm-cr{top:502px}
.nmm-cr.solo2{width:150px}

/* Créditos, con un ecualizador a la izquierda dentro de la card */
.nmm-cr{left:940px;top:812px;width:880px;height:100px;box-sizing:border-box}
.in .nmm-cr{animation:nm-up .8s cubic-bezier(.2,.8,.2,1) 1.95s forwards}
.nmm-ceq{position:absolute;left:28px;top:50%;height:54px;margin-top:-27px;display:flex;align-items:flex-end;gap:4px}
.nmm-ceq i{display:block;width:8px;height:100%;border-radius:3px;background:linear-gradient(180deg,#DCE6FF,var(--blue-soft) 35%,var(--blue));box-shadow:0 0 12px rgba(47,107,255,.75);
  transform-origin:bottom;animation:nmm-eq var(--s) ease-in-out var(--d) infinite}
.nmm-ceq.live i{animation:none;transition:transform .07s linear}
@keyframes nmm-eq{0%{transform:scaleY(var(--a))}22%{transform:scaleY(var(--b))}47%{transform:scaleY(var(--c))}71%{transform:scaleY(var(--e))}100%{transform:scaleY(var(--a))}}
.nmm-ct{position:absolute;left:150px;right:28px;top:10px;bottom:10px;display:flex;flex-direction:column;justify-content:center;gap:4px}
.nmm-cr.hasig .nmm-ct{right:340px}
.nmm-ig{position:absolute;right:28px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:12px;color:#DCE6FF;filter:drop-shadow(0 0 12px rgba(47,107,255,.6))}
.nmm-ig span{font-family:var(--display);font-weight:600;font-size:26px;letter-spacing:.02em;white-space:nowrap}
.nmm-crt{flex:0 1 auto;min-height:0;overflow:hidden;font-size:21px;line-height:1.3;color:#C9D5F0;white-space:pre-line}

/* Salida pieza por pieza */
.out .nmm-lz,.out .nmm-cr,.out .nmm-ds{animation:nm-fadeOut .5s ease both}
.out .nmm-g,.out .nmm-dt,.out .nmm-head{animation:nm-fadeOut .5s ease .2s both}
.out .nmm-disc{animation:nm-fadeOut .7s ease .35s both}
.out .nmm-p>*{animation:nm-fadeOut .6s ease .5s both}
.out .nmm-blob{animation:nm-fadeOut 1s ease both}
`;

const CSS_V = `
.nmm-arg{top:1735px;left:50%;transform:translateX(-50%);height:44px;padding:0 22px;font-size:14px;letter-spacing:.2em}
.nmm-blob.a{left:380px;top:-200px}
.nmm-blob.b{left:-300px;top:1100px}
.nmm-disc{left:425px;top:calc(220px + var(--vy,0px));width:500px;height:500px}
.nmm-slab{left:155px;top:calc(200px + var(--vy,0px));width:520px;height:520px}
.nmm-p{width:520px;height:520px}
.nmm-head{left:60px;top:740px;width:960px;height:250px}
.nmm-gens{left:60px;top:1004px;width:960px}
.nmm-flat .nmm-lz{left:60px;top:1082px;width:960px;height:150px}
.nolyr .nmm-flat .nmm-lz{height:34px}
.nmm-ds{left:60px;top:1252px;width:960px;height:270px}
.nmm-cr{left:60px;top:1550px;width:960px;height:108px}
.nmm-cr.solo2{width:150px;left:465px}
.nolyr .nmm-ds{top:1134px}
.nolyr .nmm-cr{top:1432px}
.nodesc .nmm-cr{top:1252px}
.nolyr.nodesc .nmm-cr{top:1134px}

/* Todo centrado al dispositivo */
.nmm-head{align-items:center;text-align:center}
.nmm-k{justify-content:center}
.nmm-tw .nm-ttl{text-wrap:balance}
.nmm-artist{justify-content:center}
.nmm-gens{justify-content:center}
.nmm-dt{margin-left:0}
.nmm-l{justify-content:center;text-align:center}
.nmm-ds{text-align:center}
.nmm-dst{text-align:center}
.nmm-ct{text-align:center}
.nmm-cr.hasig .nmm-ct{right:340px}
`;
