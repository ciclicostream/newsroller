import { useEffect, useState } from "react";
import { API_BASE, fetchScene, type Scene } from "./lib/scene";
import { ItemView } from "./templates/items";

// Preview de un contenido tipado (MONITOR del panel). Renderiza una placa, con su animación,
// y la reproduce en loop para que el operador la vea antes de mandarla al aire.
export function Preview({ id }: { id: string }) {
  const [item, setItem] = useState<{ type: string; data: Record<string, any>; duration_sec?: number } | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [scale, setScale] = useState(1);
  const [loop, setLoop] = useState(0);

  useEffect(() => {
    let on = true;
    fetch(`${API_BASE}/api/output/item/${id}`)
      .then((r) => r.json())
      .then((d) => on && setItem(d))
      .catch(() => {});
    return () => { on = false; };
  }, [id]);

  // Datos en vivo (clima, dólar) y cámaras: sin esto las placas que dependen
  // de la escena se ven vacías en el monitor.
  useEffect(() => {
    let on = true;
    fetchScene().then((s) => on && setScene(s)).catch(() => {});
    return () => { on = false; };
  }, [id]);

  const dur = Math.max(4, item?.duration_sec ?? 8);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // Replay de la animación cada ciclo (duración + margen para ver entrada y salida).
  useEffect(() => {
    const t = setInterval(() => setLoop((n) => n + 1), (dur + 1) * 1000);
    return () => clearInterval(t);
  }, [dur]);

  return (
    <div className="viewport">
      <div className="stage" style={{ transform: `scale(${scale})` }}>
        {item ? <ItemView key={loop} type={item.type} data={item.data} durationSec={dur} liveData={scene?.data} cameras={scene?.cameras ?? []} /> : null}
      </div>
    </div>
  );
}
