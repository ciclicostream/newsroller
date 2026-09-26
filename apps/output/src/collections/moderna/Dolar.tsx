import { useMemo } from "react";
import type { DolarData, DolarPayload } from "@newsroller/shared";
import { DOLAR_CASAS } from "@newsroller/shared";
import { IS_VERTICAL } from "../../lib/orientation";
import { Grain, NM_CSS, fmtNum, useCount, useLife } from "./base";
import { ModernChrome } from "./Chrome";

// Dólar, colección Modernas (en verde): la cotización del medio (casas[1], la principal) va adelante en una
// tarjeta clara con la pill "EL DÓLAR" y cuenta primero; las otras dos salen de atrás de ella hacia los costados,
// giradas hacia la principal, y cuentan después. Un brillo cruza cada cifra al terminar de contar. Al salir, las
// secundarias vuelven detrás de la principal. Datos: venta y compra de la API (dolarapi) o el valor manual del
// formulario; variación contra la última cotización distinta (igual que la clásica).
interface Casa { id: string; nombre: string; venta: number | null; compra: number | null; manual: boolean; dir: "up" | "down" | "flat" | null; pct: number | null }

function Tarjeta({ c, pos, delay }: { c: Casa; pos: "l" | "c" | "r"; delay: number }) {
  const v = useCount(c.venta ?? 0, delay, pos === "c" ? 1000 : 900);
  const pct = c.pct == null ? "" : `${String(Math.abs(c.pct)).replace(".", ",")}%`;
  return (
    <div className={"nmd-c " + pos}>
      <div className={"nmd-f" + (pos === "c" ? " paper" : "")}>
        <div className="nmd-k">Dólar</div>
        <div className="nmd-name">{c.nombre}</div>
        <div className="nmd-num" style={{ ["--sh" as any]: `${delay / 1000 + (pos === "c" ? 1.05 : 0.95)}s` }}><small>$</small>{c.venta == null ? "—" : fmtNum(Math.round(v))}</div>
        {c.dir && <div className={"nmd-v " + c.dir}>{c.dir === "up" ? "▲" : c.dir === "down" ? "▼" : "="} {pct}</div>}
        {!c.manual && c.compra != null && c.venta != null && (
          <div className="nmd-cv"><span>Compra <b>{fmtNum(c.compra)}</b></span><span>Venta <b>{fmtNum(c.venta)}</b></span></div>
        )}
      </div>
      {pos === "c" && <div className="nmd-pill">EL DÓLAR</div>}
    </div>
  );
}

export function Dolar({ data, live, durationSec }: { data: DolarData; live?: DolarPayload; durationSec?: number }) {
  const { cls } = useLife(durationSec, 1.2);
  const byId = useMemo(() => new Map((live?.casas ?? []).map((c) => [c.casa, c])), [live]);
  const ids = data.casas?.length === 3 ? data.casas : (["oficial", "blue", "bolsa"] as [string, string, string]);
  const casas: Casa[] = ids.map((id) => {
    const c = byId.get(id);
    const manual = data.overrides?.[id] != null;
    const venta = manual ? data.overrides![id]! : c?.venta ?? null;
    const prev = c?.ventaPrev ?? null;
    const known = !manual && venta != null && prev != null && prev !== 0;
    const raw = known ? ((venta! - prev!) / prev!) * 100 : null;
    const dir: Casa["dir"] = raw == null ? null : Math.abs(venta! - prev!) < 0.005 ? "flat" : raw > 0 ? "up" : "down";
    const pct = raw == null ? null : Math.abs(raw) >= 1 ? Math.round(raw * 10) / 10 : Math.round(raw * 100) / 100;
    return { id, nombre: DOLAR_CASAS[id] ?? c?.nombre ?? id, venta, compra: c?.compra ?? null, manual, dir, pct };
  });
  return (
    <div className={"nm nmd" + cls + (IS_VERTICAL ? " v" : "")}>
      <style>{NM_CSS + CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <div className="nm-bg" /><div className="nmd-bg" /><Grain />
      <div className="nm-sc">
        <div className="nmd-floor" />
        <Tarjeta c={casas[0]!} pos="l" delay={2000} />
        <Tarjeta c={casas[2]!} pos="r" delay={2000} />
        <Tarjeta c={casas[1]!} pos="c" delay={350} />
      </div>
      <ModernChrome />
    </div>
  );
}

const CSS = `
.nmd-bg{position:absolute;inset:0;background:radial-gradient(1100px 700px at 50% 20%,rgba(18,163,107,.35),transparent 70%),radial-gradient(900px 500px at 50% 110%,rgba(18,163,107,.25),transparent 70%),linear-gradient(180deg,#03261C,#02140F)}
.nmd-c{position:absolute;top:246px;width:440px;height:560px;transform-style:preserve-3d}
.nmd-c.l{left:250px;--dry:16deg;transform-origin:100% 50%;transform:rotateY(var(--dry))}
.nmd-c.r{left:1230px;--dry:-16deg;transform-origin:0 50%;transform:rotateY(var(--dry))}
.nmd-c.c{left:730px;top:200px;width:460px;height:640px;transform:translateZ(70px);transform-style:flat}
.nmd-f{position:absolute;inset:0;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:40px;
  background:linear-gradient(155deg,rgba(20,90,66,.95),rgba(6,40,30,.97));box-shadow:inset 0 1px 0 rgba(255,255,255,.25),inset 0 0 0 1px rgba(120,230,180,.18),0 50px 100px -30px rgba(0,0,0,.8)}
.nmd-f.paper{background:linear-gradient(160deg,#FFFFFF,#E6ECF8);box-shadow:inset 0 1px 0 #fff,0 0 0 1px rgba(255,255,255,.6),0 60px 110px -30px rgba(0,0,0,.85)}
.nmd-k{font-family:var(--display);font-weight:700;font-stretch:115%;font-size:16px;letter-spacing:.32em;text-transform:uppercase;color:#9ED9BF}
.nmd-name{font-family:var(--display);font-weight:800;font-stretch:92%;font-size:52px;line-height:1;color:var(--paper);margin-top:-8px}
.nmd-num{--c1:#EFFFF7;font-family:var(--display);font-weight:800;font-stretch:78%;font-size:150px;line-height:.9;letter-spacing:-.02em;font-variant-numeric:tabular-nums;
  background:linear-gradient(100deg,var(--c1) 42%,#fff 49%,#B9F5D8 51%,var(--c1) 58%) 0 0/300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;background-position:100% 0}
.nmd-num small{font-size:.45em;vertical-align:.8em;margin-right:.06em}
.in .nmd-num{animation:nmd-shine 1.3s ease var(--sh) both}
@keyframes nmd-shine{from{background-position:100% 0}to{background-position:0 0}}
.nmd-v{font-family:var(--display);font-weight:700;font-size:22px;padding:6px 12px;border-radius:6px;font-variant-numeric:tabular-nums}
.nmd-v.up{color:#3DDC97;background:rgba(61,220,151,.12)}.nmd-v.down{color:#FF6B5A;background:rgba(255,107,90,.12)}.nmd-v.flat{color:#A9B6D6;background:rgba(169,182,214,.12)}
.nmd-cv{display:flex;gap:26px;font-size:20px;color:var(--mist);margin-top:6px;padding-top:18px;border-top:1px solid rgba(158,217,191,.2)}
.nmd-cv b{color:var(--paper);font-family:var(--display);font-weight:700;font-variant-numeric:tabular-nums}
.paper .nmd-k{color:#40507A}.paper .nmd-name{color:#0A1433}.paper .nmd-num{--c1:#0B7A4B;font-size:184px}
.paper .nmd-v.up{color:#0E8F58;background:rgba(14,143,88,.12)}.paper .nmd-v.down{color:#C62410;background:rgba(198,36,16,.1)}.paper .nmd-v.flat{color:#6b7688;background:rgba(10,20,51,.06)}
.paper .nmd-cv{color:#40507A;border-top-color:rgba(10,20,51,.12)}.paper .nmd-cv b{color:#0A1433}
.nmd-pill{position:absolute;left:50%;top:-24px;z-index:2;transform:translateX(-50%) translateZ(2px);background:#12A36B;color:#fff;font-family:var(--display);font-weight:800;font-stretch:112%;font-size:18px;letter-spacing:.3em;padding:12px 22px 11px;border-radius:8px;white-space:nowrap;box-shadow:0 14px 30px -10px rgba(18,163,107,.9)}
.nmd-floor{position:absolute;left:560px;top:820px;width:800px;height:120px;background:radial-gradient(closest-side,rgba(18,163,107,.55),transparent);filter:blur(10px);opacity:0}
.in .nmd-floor{animation:nm-fade 1.2s ease .3s forwards}
.in .nmd-c.c{animation:nmd-c .8s cubic-bezier(.2,.8,.2,1) .15s both}
.in .nmd-c.l{animation:nmd-l 1.05s cubic-bezier(.2,.8,.2,1) 1.25s both}
.in .nmd-c.r{animation:nmd-r 1.05s cubic-bezier(.2,.8,.2,1) 1.25s both}
@keyframes nmd-c{from{opacity:0;transform:translateZ(-80px) scale(.94)}to{opacity:1;transform:translateZ(70px)}}
@keyframes nmd-l{from{transform:translateX(480px) translateZ(-160px) rotateY(0)}to{transform:rotateY(var(--dry))}}
@keyframes nmd-r{from{transform:translateX(-480px) translateZ(-160px) rotateY(0)}to{transform:rotateY(var(--dry))}}
.out .nmd-c.l{animation:nmd-lo .6s cubic-bezier(.6,0,.8,.4) both}
.out .nmd-c.r{animation:nmd-ro .6s cubic-bezier(.6,0,.8,.4) both}
.out .nmd-c.c{animation:nmd-co .6s cubic-bezier(.6,0,.8,.4) .5s both}
.out .nmd-floor{animation:nm-fadeOut .5s ease .5s both}
@keyframes nmd-lo{from{transform:rotateY(var(--dry))}to{transform:translateX(480px) translateZ(-160px) rotateY(0)}}
@keyframes nmd-ro{from{transform:rotateY(var(--dry))}to{transform:translateX(-480px) translateZ(-160px) rotateY(0)}}
@keyframes nmd-co{from{opacity:1;transform:translateZ(70px)}to{opacity:0;transform:translateZ(-200px)}}
`;

const CSS_V = `
.nmd-c.c{left:190px;top:230px;width:700px;height:600px}
.nmd-c.l{left:60px;top:900px;width:460px;height:560px}
.nmd-c.r{left:560px;top:900px;width:460px;height:560px}
.nmd-floor{left:140px;top:820px}
.in .nmd-c.l{animation-name:nmd-lv}.in .nmd-c.r{animation-name:nmd-rv}
.out .nmd-c.l{animation-name:nmd-lvo}.out .nmd-c.r{animation-name:nmd-rvo}
@keyframes nmd-lv{from{transform:translate(360px,-620px) translateZ(-160px) rotateY(0)}to{transform:rotateY(var(--dry))}}
@keyframes nmd-rv{from{transform:translate(-140px,-620px) translateZ(-160px) rotateY(0)}to{transform:rotateY(var(--dry))}}
@keyframes nmd-lvo{from{transform:rotateY(var(--dry))}to{transform:translate(360px,-620px) translateZ(-160px) rotateY(0)}}
@keyframes nmd-rvo{from{transform:rotateY(var(--dry))}to{transform:translate(-140px,-620px) translateZ(-160px) rotateY(0)}}
`;
