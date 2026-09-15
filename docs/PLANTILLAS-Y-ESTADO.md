# NewsRoller — Estado y plantillas (handoff para continuar en otro chat)

> Documento de traspaso. Leer junto con `BITACORA.md`. Fecha: 2026-09-15.

## Dónde está el proyecto

- Repo: `git@github.com:ciclicostream/newsroller.git` (rama `main`). Deploys automáticos en **Railway**
  (Watch Paths vaciadas). Output en `https://newsroll.somosciclico.com/output/` (vMix/OBS Web Browser Input).
- Ya funcionando en producción: panel con roles (admin/editor), contenido (assets/placas/shorts),
  editor de plantillas libre, **cámaras** (YouTube/HLS/imagen), programación (playlist), output con
  ticker (somosciclico RSS), datos en vivo (dólar, clima, CAMMESA, datos.gob.ar), audio de video
  con `?audio=1` (OBS/vMix), cámaras siempre muteadas.

## Rediseño en curso: modelo "banco → parrilla → aire"

Definido con el usuario (ver diagrama en el chat). Reemplaza el enfoque actual:

- **Banco de contenidos**: "Nuevo contenido" → elegir **tipo** (plantilla) → **formulario** con los
  datos que ese tipo pide → guardar con estado → marcar **"en parrilla"** (disponible).
- **Parrilla**: se edita en **BORRADOR** (drag&drop de orden + **duración por bloque**). La rotación
  en vivo sigue intacta. Recién al apretar **"Salir al aire"** el borrador reemplaza lo que rota
  (modelo publicar/commit). Ideal para última hora. **Preview** en "Monitor", vivo en "AIRE".
- **Dos capas**: `programa` (parrilla en loop) + `overlays` (sobreimpresos on/off: "En desarrollo",
  "A continuación").
- **Reportes**: cada aparición al aire se registra (`airings`); reporte por **período** configurable
  (ej. Lun–Jue 10–12) = cuántas veces salió cada publicidad.

### Modelo de datos propuesto (aún NO construido)
- `content_items`: `id`, `type`, `family`, `data` (jsonb con los campos del tipo), `status`
  (borrador/disponible/archivado), `in_parrilla`, `category`, `layer` (programa/overlay), `created_at`.
- Binarios en Storage, referenciados desde `data`. `airings` para reportes.
- La parrilla: versión **live** vs **draft**; botón publica draft→live.

### Decisiones clave (cerradas con el usuario)
- **A. Publicar/commit**: la parrilla rota siempre; se edita en borrador; sale al aire con un botón.
  Duración configurable por bloque.
- **B. Overlays**: sí, segunda capa sobreimpresa.
- **C. Reportes**: veces que aparece cada contenido en un período/fecha configurable.
- **D. Datos**: Cifras es **manual**. Temperatura y Dólar tienen su plantilla propia (datos de API).
  En "Panel" mostrar, además de las APIs "en línea", las **variables disponibles** para usar.

## Flujo de diseño de plantillas (importante)

**El usuario diseña cada plantilla (estática) y yo la reproduzco con efectos.** Referencias en
`refes/`:
- `refes/fondo.jpg` (fondo azul, 720×900, se usa `cover`).
- `refes/QR-SOMO-CICLICO.png` (pieza logo+QR del zócalo, 597×308).
- `refes/cifras/cifras.001.jpeg` y `refes/home - vacia/en desarrollo.001.jpeg` (refs, exportadas 1920×1080).

**Lienzo real: 1920×1080** (16:9). El usuario primero dijo 720 y se corrigió a 1080.
Fuentes: el usuario da px pensando en una escala menor → se escalan ×1.5 para 1080 (pills ~45,
fuente técnica ~30, ticker ~24). Confirmar px caso por caso.

### Marco fijo (chrome) que va en casi todas las plantillas
- Fondo azul (`fondo.jpg`).
- Pills arriba a la derecha: **reloj+fecha** y **Temperatura (CABA)** — color `#0096FF`, **Inter**,
  **sin sombra**. Temp: idealmente rotar de ciudad.
- Zócalo **separado del borde inferior**: barra blanca (redondeada) con la **pieza QR+logo** encima
  a la izquierda (la barra pasa por detrás del ícono; el texto no llega al borde, arranca después del
  ícono), y **ticker** corriendo en **Inter seminegrita**. Padding vertical chico.
- El panel blanco central **no va en todas** (en Cifras es solo la parte superior).

## Plantilla 1 — CIFRAS ✅ (diseñada + animada; falta integrar al sistema)

Preview animado (Artifact, v6): https://claude.ai/artifact/Bc5g22zbJZDcqH2Nvwii1q
Fuente del preview: `scratchpad/cifras.html` (HTML+CSS+JS vanilla; hay que portarlo a React/framer-motion
en `apps/output`).

Campos (formulario):
- **La cifra** — obligatorio (ej. "16,7%"). Número en **Lexia** (falta el archivo; se usa slab
  sustituta "Zilla Slab"), color `#0096FF`, con **conteo animado** de 0 al valor.
- **Título "¿qué representa?"** — obligatorio (subtítulo bajo la cifra).
- **TxCorto: fuente técnica** — obligatorio (tarjeta blanca chica). Inter regular.
- **TxLargo: explicación** — obligatorio (tarjeta azul con ícono).
- **Icono** — opcional. Opciones actuales: sube, baja, igual, alerta. Sugerir más: dinero, tiempo,
  récord, personas, termómetro, fuego, corte.
- **Pill "LA CIFRA"** — fijo (nombre de la sección).

Efectos: las tarjetas **entran deslizándose desde distintos lados, con delay escalonado** (panel de
la cifra desde arriba → tarjeta azul desde la derecha → tarjeta chica desde la izquierda → pill).
**Salen con fade out.** Loop.

Pendiente de Cifras: archivo de **Lexia**; px exactos de número/subtítulo/txlargo/pill si el usuario
los define; **integrar** como tipo de contenido real (formulario → banco → parrilla → output).

## Lista de plantillas a seguir (el usuario diseña, yo animo)

Orden sugerido: primero las placas de datos simples (reusan el mismo marco), después media, overlays
y carrusel. Cada una: el usuario pasa el diseño estático + los campos; yo la reproduzco con efectos.

### Placas de datos (marco fijo + gráfica propia)
1. **Cifras** — ✅ hecha (falta integrar).
2. **Temperatura** — actual + del día + **pronóstico de la semana** (ampliar Open-Meteo a `daily`).
3. **Dólar** — placa propia (oficial/blue/MEP; datos ya disponibles).
4. **Última hora** — placa full pantalla con texto + **video/foto opcional**.
5. **Efemérides** — foto/video + título + texto.
6. **Cartelera** — foto + datos del evento.
7. **Tránsito** — autopistas, accesos, subtes (requiere **API Transporte BA**: client_id/secret gratis).

### Media (video/gráfica) — cada categoría se visualiza distinto
8. **Publicidad** (video full o 9:16 / gráfica) — **genera reportes** de visualización.
9. **Institucionales** (video/gráfica) — lleva **imagen de la marca al lado** del contenido.
10. **Promociones Cíclico** (avances) — 9:16 o 16:9 + **nombre del programa** + **horario** (a veces).
11. **Especiales Cíclico** — cortes/contenidos largos, 9:16 o 16:9.
12. **Plantilla full** — un video a **pantalla completa**, sin nada más.

### Cíclico video/vivo (ya existen bases)
13. **Shorts Cíclico** — 9:16 del canal (YouTube API, título editable) — ya hay base.
14. **Cámaras** — en vivo (YouTube/HLS/imagen) — **ya construido**.

### Carrusel
15. **Informes Cíclico** — carrusel de **slides pre-hechas** (imágenes), pasan solas (definir tiempo
    por slide + transición).

### Overlays (2ª capa, sobreimpresos)
16. **En desarrollo** — placa **wipe** de noticia en desarrollo, sobrepuesta.
17. **A continuación** — **banner** sobreimpuesto de próximos programas.

### Comodín
18. **Plantilla libre** — el editor visual actual (ya existe).

## Próximos pasos concretos
1. Aprobar Cifras (v6) y conseguir el archivo de **Lexia**.
2. Construir el **esqueleto** del nuevo modelo (banco de contenidos con tipos + parrilla borrador/
   publicar + capa overlays + reportes) e integrar **Cifras** como primer tipo end-to-end.
3. Seguir plantilla por plantilla en el orden de arriba: el usuario pasa el diseño, yo lo animo y lo
   sumo como tipo de contenido con su formulario.

### Nota (2026-09-15): varios videos por bloque
Un contenido de video (Publicidad/Especiales/Promo/Plantilla full) puede tener **una lista de clips**
que se reproducen **encadenados en la misma pantalla**: al `ended` de uno arranca el siguiente (sin
corte). El bloque avanza al terminar el último. Sirve para subidos (`<video>` cambia src) y YouTube
(`loadVideoById`). Opciones a ofrecer: orden, loop, y transición corta (corte/fade) entre clips.
