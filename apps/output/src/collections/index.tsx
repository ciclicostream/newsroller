import { useRef, type ReactNode } from "react";
import { DEFAULT_COLLECTION } from "@newsroller/shared";
import { ClasicaItemView, type ItemProps } from "../templates/items";
import { ModernaItemView } from "./moderna";
import { useStyle } from "../lib/style";

// Registro de colecciones de templates: id (el de TEMPLATE_COLLECTIONS en @newsroller/shared) → renderizador.
// Para sumar una colección nueva por programación: crear su carpeta con un renderizador que reciba ItemProps
// (todos los tipos de contenido, en 16:9 y 9:16), registrarla acá y agregarla a TEMPLATE_COLLECTIONS.
export const COLLECTIONS: Record<string, (p: ItemProps) => ReactNode> = {
  clasica: (p) => <ClasicaItemView {...p} />,
  moderna: (p) => <ModernaItemView {...p} />,
};

// Punto único por donde pasan el aire, las sesiones, el Stream y los monitores: elige la colección.
// La colección queda fija mientras dura cada contenido: si la suite cambia de colección, el cambio
// entra recién con el contenido siguiente (nunca redibuja una placa que ya está al aire).
export function ItemView(p: ItemProps) {
  const style = useStyle();
  const key = `${p.id ?? ""}|${p.type}`;
  const latch = useRef<{ key: string; style: string } | null>(null);
  if (!latch.current || latch.current.key !== key) latch.current = { key, style };
  const render = COLLECTIONS[latch.current.style] ?? COLLECTIONS[DEFAULT_COLLECTION]!;
  return <>{render(p)}</>;
}
