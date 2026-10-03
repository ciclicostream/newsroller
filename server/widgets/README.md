# Widget "Brasil Vota" (iframe para la web de Cíclico)

Una sola página autocontenida (diseño sobrio, editorial; `?demo=pre|lidera|runoff|ganador` muestra datos de muestra con los 12 candidatos) (`brasil-vota.html`) que el servidor de NewsRoller sirve en **`/widgets/brasil-vota`**.
Lee `GET /api/tse/widget/br-presidente` cada 30 s (los mismos datos que la placa de Elecciones) y se actualiza sola.

## Cómo ponerlo en la web
Pegar este bloque HTML donde vaya el especial (reemplazar `SERVIDOR` por el dominio https del servidor de NewsRoller):

```html
<iframe id="brasil-vota" src="https://SERVIDOR/widgets/brasil-vota" title="Brasil Vota"
        style="width:100%;border:0;height:150px;display:block" scrolling="no"></iframe>
<script>
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "brasil-vota:height") document.getElementById("brasil-vota").style.height = e.data.height + "px";
  });
</script>
```
El widget avisa su alto a la página con `postMessage`, así el iframe crece al abrirse y vuelve a achicarse al cerrarse.
Ver `ejemplo-embed.html` (se abre en `/widgets/ejemplo-embed`).

## Por qué iframe a la URL del servidor (y no pegar el HTML en la raíz)
- Las correcciones y mejoras llegan solas: se actualiza el archivo en el servidor y la web no se toca.
- Las fotos, el mapa y los datos salen del mismo servidor (mismo origen), sin configurar CORS.
- Si igual se prefiere alojar el HTML en otro lado, funciona con `?api=https://SERVIDOR` (los datos tienen CORS abierto).

## Diseño
Card principal en azul `#0f3785`, tipografía Inter en todo, "Especial Cíclico" como antetítulo, línea de tiempo de 5 etapas con la actual resaltada,
newsticker chico "Noticia en desarrollo" bajo la card y, al abrir, un menú interno (Resultados · Mapa por estado · Ciudades · Argentina) cuyos paneles corren en horizontal: pestañas con indicador que se desliza, flechas, deslizar con el dedo y flechas del teclado; la altura se ajusta a cada panel. `?tab=map|cit|arg` abre en ese panel. Microinteracciones: hover en fotos, filas y ciudades,
conteo animado de porcentajes al abrir, y tocar un candidato resalta en el mapa los estados que ganó. `?static=1` desactiva animaciones (sólo para capturas).

## Qué muestra
Título "BRASIL VOTA" (letras que pasan de blanco a amarillo y verde) · la etapa (Se abren los comicios, Se cierran las urnas, Primeros resultados,
Conteo preliminar, Ganador/Resultado definitivo) · flecha para abrir, que salta y dice "Información actualizada" cuando hay datos nuevos desde la última vez que se abrió ·
al abrir: escrutinio, ganador / segunda vuelta, 5 más votados, mapa por estado, 5 ciudades y brasileños en Argentina. Antes de los resultados muestra los 12 candidatos.

## Etapa y ganador a mano
La etapa sale sola del horario (abre 08:00 y cierra 17:00 de Brasilia; `TSE_ABRE` / `TSE_CIERRA` lo cambian) y de lo que informa el TSE.
Para forzar algo (por ejemplo, si el TSE falla y las noticias ya dieron al ganador) crear/editar **`server/.tse-data/widget.json`** (se lee en cada pedido, sin reiniciar):
```json
{ "winner": "Luiz Inácio Lula da Silva" }
```
o `{ "phase": "cierre" }` (valores: `pre`, `apertura`, `cierre`, `resultados`, `preliminar`, `definitivo`). Borrar el archivo para volver a lo automático.
