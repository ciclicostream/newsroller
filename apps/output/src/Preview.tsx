import { useEffect, useState } from "react";
import { API_BASE } from "./lib/scene";
import { ItemView } from "./templates/items";

// Preview de un contenido tipado (MONITOR del panel). Renderiza una placa, con su animación,
// y la reproduce en loop para que el operador la vea antes de mandarla al aire.
export function Preview({ id }: { id: string }) {
  const [item, setItem] = useState<{ type: string; data: Record<string, any> } | null>(null);
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

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // Replay de la animación cada ~9s.
  useEffect(() => {
    const t = setInterval(() => setLoop((n) => n + 1), 9000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="viewport">
      <div className="stage" style={{ transform: `scale(${scale})` }}>
        {item ? <ItemView key={loop} type={item.type} data={item.data} /> : null}
      </div>
    </div>
  );
}
