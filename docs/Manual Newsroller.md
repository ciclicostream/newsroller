# Manual Newsroller

## Contenidos y sus campos

Cada contenido se arma desde su formulario en **Contenidos**. Los campos **manuales** los carga el editor; los **automáticos** los completa el sistema (APIs, fecha de carga, ajustes).

Todos los contenidos tienen además una **Duración** (manual, en segundos). Los videos salen mudos; se escuchan sólo en los links de salida que tienen el audio activado.

| Contenido | Campo | Carga | Para qué |
|---|---|---|---|
| **Marco** (todos) | Hora y fecha | Automático | Reloj del canal |
| | Temperatura | Automático | Capitales rotando |
| | Newsticker | Automático | Titulares de Cíclico |
| | QR Somos Cíclico | Automático | Pieza fija |
| **Última Hora** | Texto de la noticia | Manual | Titular, admite negrita |
| | Foto o video | Manual | Recurso opcional |
| | Audio | Manual | Sonido opcional |
| | Hora de actualización | Automático | Cuándo se escribió |
| | Noticia en desarrollo | Manual | Tira azul *(próximamente)* |
| **Obituario** *(próximamente, dentro de Última Hora)* | Nombre | Manual | Quién falleció |
| | Años | Manual | Nacimiento y muerte |
| | Oficio | Manual | Qué hacía |
| | Texto | Manual | Breve semblanza |
| | Foto | Manual | Retrato |
| **Música** *(sólo colección Moderna por ahora)* | Álbum ya cargado | Manual | Se elige de una lista y completa los datos del álbum (nombre, portada, fotos, descripción, fecha, géneros, Instagram): sólo se carga el tema nuevo. Un álbum puede tener varios temas |
| | Pista de audio | Manual | Obligatoria; la duración del bloque es la del audio |
| | Nombre del tema | Manual | Obligatorio |
| | Álbum | Manual | Obligatorio |
| | Portada | Manual | Obligatoria, imagen cuadrada |
| | Más fotos | Manual | Opcional, hasta 5; rotan con la portada |
| | Géneros | Manual | Hasta 3, de la lista de Ajustes → Géneros musicales |
| | Descripción del álbum | Manual | Opcional, hasta 350 caracteres |
| | Fecha de lanzamiento | Manual | Opcional |
| | Créditos | Manual | Opcional, texto libre |
| | Instagram de la banda | Manual | Opcional, se muestra a la derecha de la card de créditos |
| | Letra | Manual | Opcional; una línea por vez, sincronizada con el audio (se marca en el formulario o se pega en formato LRC) |
| **Placas** | Volanta | Manual | Tema de la nota |
| | Título | Manual | Titular, admite negrita |
| | Cuerpo | Manual | Texto de la nota |
| | Foto o video | Manual | Recurso opcional *(video próximamente)* |
| | Audio | Manual | Sonido opcional |
| | Fecha | Automático | Cuándo se publicó |
| | Traer de Cíclico | Automático | Completa desde la web |
| **Dólar** | Tres cotizaciones | Manual | Cuáles mostrar |
| | Cotización del medio | Manual | La principal |
| | Valor manual | Manual | Pisa la API |
| | Venta y compra | Automático | Desde dolarapi |
| | Variación | Automático | Sube o baja |
| **Cifras** | Origen del dato | Manual | API o manual |
| | Métrica | Manual | Qué dato traer |
| | Cifra | Manual o automático | Número a mostrar |
| | Valor numérico | Manual o automático | Para el conteo |
| | Prefijo | Manual | Ej. US$ |
| | Unidad o sufijo | Manual | Ej. %, MW |
| | Subtítulo | Manual | Qué representa |
| | Fuente técnica | Manual o automático | De dónde sale (AUTO si es API) |
| | Explicación | Manual | Contexto del dato |
| | Ícono | Manual | Opcional |
| **Efemérides** | Cantidad (1 a 3) | Manual | Efemérides por pase |
| | Precisión de la fecha | Manual | Completa, mes o aniversario |
| | Día, mes, año | Manual | La fecha |
| | Título | Manual | Máx. 60 |
| | Cuerpo | Manual | Máx. 400 |
| | Foto o video vertical | Manual | Obligatorio |
| | Sugerencias | Automático | Desde Wikipedia |
| **Retro** (dentro de Efemérides) | Imagen o video | Manual | Obligatorio |
| | Año o época | Manual | Texto libre |
| | Etiqueta | Manual | Ej. PROGRAMA |
| | Título | Manual | Nombre del programa |
| | Subtítulo | Manual | Opcional |
| | Descripción | Manual | Máx. 450 |
| **Cartelera · Cine** | Tráiler | Manual | Link de YouTube |
| | Título | Manual | Película o serie |
| | Sinopsis | Manual | Breve resumen |
| | Director/a | Manual | Quién dirige |
| | Actores | Manual | Elenco |
| | Duración de la película | Manual | Ej. 104 min |
| | Género | Manual | Ej. Drama |
| | Serie: plataforma | Manual | Dónde verla |
| | Serie: temporadas y capítulos | Manual | Opcionales |
| | Logo de la plataforma | Automático | Desde Ajustes |
| | Póster o short | Manual | Recurso lateral |
| | Newsticker | Manual | Estreno, recomendada o clásico |
| **Cartelera · Teatro** | Foto horizontal | Manual | Obligatoria |
| | Título | Manual | Nombre de la obra |
| | Autor | Manual | Se muestra "De…" |
| | Elenco | Manual | Se muestra "Con:…" |
| | Lugar, dirección, ciudad | Manual | Dónde se ve |
| | Días y horario | Manual | Cuándo se ve |
| | Video vertical | Manual | Opcional, 9:16 |
| | Newsticker | Manual | Estreno, recomendada o clásico |
| **Cartelera · Evento** | Foto horizontal | Manual | Obligatoria |
| | Título | Manual | Nombre del evento |
| | Descripción | Manual | De qué se trata |
| | Lugar, dirección, ciudad | Manual | Dónde es |
| | Días y horario | Manual | Cuándo es |
| | Video vertical | Manual | Opcional, 9:16 |
| **Declaraciones** | Foto cuadrada | Manual | Obligatoria |
| | Nombre | Manual | Quién habla |
| | Cargo | Manual | Qué es |
| | Lugar | Manual | Dónde |
| | Cita | Manual | Máx. 450 |
| | Titular de la nota | Manual | Opcional |
| | Entrevista completa en | Manual | Programa, opcional |
| | Audio | Manual | Sonido opcional |
| **Shorts** | Cantidad (1 o 2) | Manual | Cuántos shorts |
| | Short(s) | Manual | Del canal de YouTube |
| | Título | Automático, editable | Desde YouTube |
| **Informe** | Título | Manual | Fijo en pantalla |
| | Slides (hasta 10) | Manual | Imágenes 4:5 |
| | Segundos por slide | Manual | Ritmo del carrusel |
| **Lista** (dentro de Informes) | Título | Manual | Máx. 90 |
| | Volanta | Manual | Pill opcional |
| | Numeración | Manual | Con o sin ranking |
| | Segundos por ítem | Manual | Ritmo del foco |
| | Ítems (3 a 10): título, subtítulo, dato, descripción | Manual | Contenido de cada ficha |
| | Imagen del ítem | Manual o automático | Cuadrada, o tapa del disco |
| | Audio del ítem | Manual | Se busca en Deezer o iTunes |
| **Clima** | Ciudad | Manual | Una de las 24 capitales |
| | Temperatura, estado, sensación, humedad, viento | Automático | Desde Open-Meteo |
| | Pronóstico de 3 días | Automático | Máxima, mínima y estado |
| | Ilustración del clima | Automático | Según el estado que informa Open-Meteo (con su nombre); de día o de noche. Cada ícono, grande y chico, se puede cargar en Ajustes → Íconos del clima |
| **Promos / Avances** | Video | Manual o automático | A mano o por hashtag |
| | Formato | Manual | 9:16 o 4:3 |
| | Título | Manual | Pill, máx. 24 |
| | Texto | Manual | Card, máx. 160 |
| **Cámaras** | Cámara | Manual | Cuál transmitir |
| | Ubicación | Manual | Junto a EN VIVO |
| | Avisos | Manual | Imágenes que rotan |
| **Publicidad** | Título | Manual | Para identificarla |
| | Formato | Manual | Full o vertical |
| | Video o imagen | Manual | El aviso |
| | Logo de marca | Manual | Opcional, vertical |
| | QR del anunciante | Manual | Opcional, vertical |
| | Versión vertical | Manual | Para el output 9:16 |
| | Reporte de salidas | Automático | Cuenta cada emisión |
| **Video Full** | Origen | Manual | Archivo o YouTube |
| | Video o imagen | Manual | Pantalla completa |
| | Versión vertical | Manual | Para el output 9:16 |
| | Nombre | Automático, editable | Título de YouTube |

## Suites y la salida del canal

| Qué | Cómo funciona |
|---|---|
| Colección | Juego completo de templates (Clásicas, Modernas y las que se sumen), cada uno en 16:9 y 9:16. En una salida no se mezclan. |
| Suite | Un nombre con una colección, por ejemplo `clasica` o `navidad2026`. |
| Suite activa | Siempre hay una sola. La salida del canal emite con su colección. El Programador y el Host ven su nombre en el monitor del Copiloto y en el de Stream, pero no la pueden cambiar. |
| Quién maneja las suites | El Administrador y el Master, en Ajustes → Suites: crean suites, les cambian la colección y eligen cuál está activa. Activar otra suite o cambiarle la colección entra en el próximo contenido. |
| Colecciones habilitadas | El Master elige cuáles se pueden usar en las suites. |
| Salida del canal | Una sola señal: la parrilla del Copiloto y, mientras el Host tiene Stream abierto, el Stream. Al cerrar Stream vuelve sola al Copiloto. Las Sesiones salen sólo dentro de la parrilla. |
| Links del canal | Dos, fijos: uno horizontal y uno vertical (`/output/ciclico` y `/output/ciclico-vertical`). Se cargan una vez en OBS/vMix y no se tocan: siempre usan la suite activa. |
| Qué se puede cambiar de un link | En Ajustes → Suites: prender o apagar el audio, cambiarle el nombre o regenerarlo si se filtró. En los dos últimos casos el link viejo deja de emitir. |
| Vistas previas | El monitor de cada formulario de Contenidos tiene un selector para ver la placa con cada colección habilitada. |
| Links viejos | Los links con variables (`/output/?orientation=…`, de sesiones o de Stream) se apagan en Ajustes → Suites cuando todos los OBS/vMix usan los links del canal. |

## Roles de usuarios

Cada persona entra al panel con un rol. El servidor controla los permisos: aunque alguien encuentre la dirección de una sección, si su rol no la tiene, no puede usarla.

| Rol | Para qué es |
|---|---|
| **Master** | Control total del sistema, incluidas las opciones sensibles |
| **Administrador** | Maneja el canal y el equipo, sin tocar lo sensible |
| **Programador** | Arma y opera la programación diaria |
| **Host** | Conduce el Stream y prepara contenidos |
| **Generador de contenidos** | Carga contenidos y arma sus sesiones |

### Qué puede hacer cada rol

| Acción | Master | Administrador | Programador | Host | Generador |
|---|---|---|---|---|---|
| Crear y ver contenidos | Sí | Sí | Sí | Sí | Sí |
| Editar o borrar contenidos de otros | Sí | Sí | Sí | Sí | — (sólo los propios) |
| Programación (Copiloto): parrilla, enviar al aire, cortar | Sí | Sí | Sí | — | — |
| Operar Stream (micrófono, cámara, botonera) | Sí | Sí | Sí | Sí | — |
| Ver y editar sus sesiones asignadas | Sí | Sí | Sí | Sí | Sí |
| Crear o borrar sesiones y asignar quién las maneja | Sí | Sí | — | — | — |
| Ver la suite activa | Sí | Sí | Sí | Sí | — |
| Crear suites, cambiarles la colección y activarlas | Sí | Sí | — | — | — |
| Links del canal: audio, nombre y regenerar | Sí | Sí | — | — | — |
| Habilitar colecciones de templates | Sí | — | — | — | — |
| Cámaras | Sí | Sí | Sí | Sí | — |
| Fuentes de datos (estado de las APIs) | Sí | — | Sí | Sí | — |
| Reportes y Actividad | Sí | Sí | — | — | — |
| Ver plantillas | Sí | Sí | — | — | — |
| Editar plantillas | Sí | — | — | — | — |
| Ajustes: Shorts, Música y Programas | Sí | Sí | Sí | Sí | — |
| Ajustes: Banco, íconos del clima, plataformas y newsticker | Sí | Sí | Sí | — | — |
| Ajustes: Suites y links viejos | Sí | Sí | — | — | — |
| Usuarios: invitar, editar y desactivar | Sí | Sí (menos al Master) | — | — | — |
| Borrar usuarios | Sí | — | — | — | — |
| Vaciar la papelera (borrar para siempre) | Sí | Sí | — | — | — |
| Tiempos de inactividad por rol | Sí | — | — | — | — |

### Otras reglas

| Regla | Detalle |
|---|---|
| Quién da cada rol | El Master asigna cualquier rol. El Administrador asigna Administrador, Programador, Host y Generador, nunca Master. |
| Pantalla de inicio | Con Programación entra al Copiloto. El Host entra a Stream. El Generador entra a Contenidos. |
| Cierre por inactividad | Por defecto: Generador 20 min, Host 15, Programador 15, Administrador 10, Master 10. Lo cambia sólo el Master. |
| Contenido al aire | Nadie puede borrar un contenido mientras está al aire. |
| Papelera | Lo borrado queda 30 días y se puede restaurar. |

