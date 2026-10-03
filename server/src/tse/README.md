# Colector de resultados del TSE (Brasil 2026 · Presidente)

Capa de adquisición **separada de la presentación**: `server/src/tse/` baja, normaliza y guarda los resultados oficiales;
`routes/tse.ts` los expone; la placa **Elecciones** (modo *Automático (TSE)*) los consume vía `/api/tse/live/br-presidente`.
Fuente única: el TSE (`resultados.tse.jus.br`). Nada de APIs de terceros.

## Esquema real de archivos (verificado)
Todas las rutas salen de las **plantillas `arq[]` del catálogo EA11** (`/oficial/comum/config/ele-c.json`) + los códigos del catálogo.
Observado en vivo (catálogo oficial y entorno de simulado del TSE; ver "Verificación"):

| Archivo | Nivel | Ruta (`<dir>` = `…/oficial/ele2026/6257/dados/<uf>`) |
|---|---|---|
| EA11 | catálogo | `/oficial/comum/config/ele-c.json` — `pl[]` (ciclo `ele2026`, pleito `3220`) → `e[]` (federal `6257`, 2ª vuelta `cdt2` `6258`) → `abr[].cp[]` (Presidente = `1`) |
| EA14 | **Brasil** (acompañamiento) | `<dir br>/br-e006257-ab.json` — `abr[]` = BR + UFs (+`zz`), con `dt/ht` (última totalización), `s.*` (secciones), `e.*` (electorado) |
| EA15 | **UF** (acompañamiento) | `<dir uf>/sp-e006257-ab.json` — `abr[]` = municipios (`tpabr:"mun"`, `cdabr` = código TSE) |
| EA20 | **A) nacional** | `<dir br>/br-c0001-e006257-u.json` |
| EA20 | **B) UF** | `<dir sp>/sp-c0001-e006257-u.json` |
| EA20 | **C) municipio** | `<dir sp>/sp71072-c0001-e006257-u.json` (código TSE de 5 dígitos) |
| EA12 | municipios | `…/ele2026/6257/config/mun-e006257-cm.json` — por UF: `mu[]` {`cd` TSE, `cdi` IBGE, `nm`, `c`=capital, `z` zonas} |
| EA16 | secciones | `…/ele2026/arquivo-urna/3220/config/sp/sp-p003220-cs.json` (~6 MB para SP) — `sec[]` {`ns`, `da`, `ha`} |
| EA18 | **D) Boletim de Urna** | `…/arquivo-urna/3220/dados/sp/71072/0001/0001/p003220-sp-m71072-z0001-s0001-aux.json` — `st` + `hashes[].arq[]` |

Reglas de nombre: elección a **6 dígitos** (`e006257`; `e06257` da 404), cargo a **4** (`c0001`), pleito a 6 en EA16/EA18, zona/sección a 4.
Los estados y municipios **siguen usando la elección federal 6257** (no 6259, que es la estadual).

### Qué trae cada JSON
- **EA20**: `ele, t, f, dg/hg` (generación), `dt/ht` (última totalización), `idg`, `and`; `s` (secciones: `ts` esperadas, `st` totalizadas, `pstn` %), `e` (electorado `te`, comparecimiento `c/pcn`, abstención `a/pan`), `v` (`tv` apurados, `vv` válidos, `vb` blancos, `vn` nulos, `van` anulados, `vansj` anulados sub judice) y `carg[].agr[].par[].cand[]` (`sqcand, n, nm, nmu, dvt, vap, pvapn, st, e`, vice en `vs[]`). `agr.tp`: `f` federación · `c` coalición · `i` partido solo.
- **EA14/EA15**: por ámbito `dt/ht`, `and`, `s.*`, `e.*`, `munf/pmunf` (municipios finalizados).
- **EA18**: si la sección llegó y qué archivos tiene; el BU es binario (`.bu`, ASN.1): el colector **no lo descarga**, informa nombre y hash.

### Detección de cambios (no hay polling de miles de URLs)
`EA11 → EA14` (1 request por ciclo, con `If-None-Match`; el ETag del TSE == `idg`) → EA20 BR/UF **sólo de lo que cambió** → EA15 de las UFs
con municipios seguidos → EA20 municipal sólo de los que cambiaron (cola, capitales primero, tope `TSE_MAX_FILES_CICLO`).
EA16/EA18 sólo bajo demanda. Sin cambios: **1 request por ciclo**.

### Protecciones
Una request a la vez, separadas ≥250 ms (el techo del TSE es 100/s). Un 404 **no es error** (puede no existir todavía): EA14 en 404 → espera creciente (hasta 15 min);
3 × 404 seguidos → pausa 5 min. 429/403 → pausa 10 min con backoff exponencial (tope 60). 5xx/red → pausa 30–60 s. Respeta `x-ratelimit-remaining`.
Cada request queda registrada (`GET /api/tse/requests`).

## Brasileños en Argentina (voto en el exterior)
El TSE publica el exterior como la "UF" `ZZ`: cada consulado es un municipio de EA12 (`zz29467` = Buenos Aires). El colector sigue Buenos Aires, Córdoba, Mendoza,
Paso de los Libres y Puerto Iguazú (EA20 municipal de cada una, sin descargar el agregado ZZ) y `live.abroad` los suma: electores habilitados, boletines
(`s.ts` esperados · `s.sa` recibidos · `s.st` totalizados), % totalizado, hora de la última totalización y votos por candidato. "Boletines recibidos" = `s.sa` (supuesto a confirmar con datos oficiales).
En la placa: Buenos Aires, Córdoba y "Otras ciudades"; los 9 primeros candidatos y "Otros".

## Datos guardados (`server/.tse-data/<env>/`, ignorado por git)
`latest.json` (último resultado por ámbito), `raw/` (último JSON crudo de cada ámbito) y `audit.ndjson` (una línea por versión: idg, sha256, bytes, URL y los **cuatro tiempos**:
`fetched_at` (consulta), `source_updated_at` (Last-Modified HTTP), `file_generated_at` (dg+hg) y `totalization_time` (dt+ht), todos en ISO; la hora del TSE es de Brasilia, `-03:00`).
Una actualización posterior reemplaza a la anterior; una generación más vieja (CDN atrasado) se ignora; contenido idéntico no cambia nada.

## API
`GET /api/tse/status` · `/last-update` · `/requests` · `/results/brasil/presidente` · `/results/uf/:uf/presidente` · `/results/municipio/:uf/:codigo/presidente` (código TSE o IBGE) ·
`/municipios?uf=SP[&seguidos=0]` · `/bu/:uf/:municipio/secciones` · `/bu/:uf/:municipio/:zona/:secao` · `/live/br-presidente` (para la placa).
Cada resultado: `election, geography, times, totalization, totals{valid,blank,null,…}, candidates[], parties[], groupings[]` (federaciones/coaliciones **separadas** de partidos).
`percentage_tse` es el % que publica el TSE; `percentage_valid_calc` lo recalcula sobre votos válidos.

## Cómo correrlo
```
npm run start --workspace @newsroller/server                                # oficial: el colector arranca solo (TSE_ENABLED=0 lo apaga)
TSE_ENABLED=1 TSE_ENV=simulado npm run start --workspace @newsroller/server   # ensayo con el simulado del TSE
```
Variables: `TSE_ENABLED` (por defecto activo), `TSE_ENV` (`oficial`|`simulado`), `TSE_CICLO` (`ele2026`), `TSE_PLEITO` (`3220`), `TSE_VUELTA` (`1`|`2`), `TSE_POLL_MS` (60000, mínimo 20000),
`TSE_MIN_GAP_MS`, `TSE_MAX_FILES_CICLO` (80), `TSE_INCLUIR_EXTERIOR=1`, `TSE_DATA_DIR`, `TSE_USER_AGENT`. Colores de candidatos: `candidate-colors.json` (`{"13":"#E0242B"}`).
Municipios seguidos: sólo São Paulo, Rio de Janeiro, Salvador, Belo Horizonte y Brasília (`config.ts`); los códigos salen de EA12. Con ≤ 20 municipios no se usa el EA15: cada EA20 municipal (~10 KB) se pide sólo si su UF cambió.

## Verificación
- `npx tsx --test src/tse/tse.test.ts` (13 tests con fixtures reales del simulado: URLs, sumas, tiempos, 404, 429/403, 304, reemplazo de versiones, cola).
- `npx tsx src/scripts/tse-validate.ts` valida **en vivo contra el simulado** los 9 ámbitos pedidos (42 requests, ~1,5/s).
- No verificado en producción: los archivos oficiales de 2026 se publican el 4/10/2026. Pendiente de confirmar ese día: base `oficial` (simetría con el simulado), nivel EA18→`.bu` (en el simulado las secciones no traen archivos) y la ruta de descarga del `.bu`.
