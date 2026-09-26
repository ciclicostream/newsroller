import type { ReactNode } from "react";
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

// Punto único por donde pasan el aire, las sesiones, el Stream y los monitores: elige la colección activa.
export function ItemView(p: ItemProps) {
  const style = useStyle();
  const render = COLLECTIONS[style] ?? COLLECTIONS[DEFAULT_COLLECTION]!;
  return <>{render(p)}</>;
}
