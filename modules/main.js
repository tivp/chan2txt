// Orquestador principal: panel de canal, cola concurrente, botones en videos/Shorts y arranque SPA.

import { CATEGORIAS, CFG, estado, verificarCancelacion } from './config.js';
import {
    calcularEta,
    copiarAlPortapapeles,
    crearElemento,
    descargarBlob,
    dormir,
    formatearTiempoRestante,
    obtenerSnapshotPagina,
    seguro
} from './utils.js';
import { crearZipNativo, generarMapaArbol, guardarZip, rutaLibre } from './zip.js';
import { instalarHooksPotUnaVez, registrarReceptorMensajesVentana } from './interceptor.js';
import { ejecutarAgenteIframeTrabajador, limpiarTodosLosIframesTrabajadores } from './worker-iframe.js';
import { cancelarDescargaActiva, reanudarDespuesDeCaptcha } from './http.js';
import { procesarVideoATxt } from './extractor.js';
import {
    colorearVideoDom,
    construirColaVideos,
    consultarPrimeraPaginaPlaylist,
    enPantallaDeCanal,
    obtenerClaveCanalUrl,
    obtenerConteoAproximadoHeader,
    obtenerNombreCanalDom,
    obtenerRaizCanalDom,
    obtenerVideosEnPantallaDom,
    resolverDatosCanalActual,
    restaurarColoresVideosDom
} from './channel.js';
import {
    buscarAnclaDebajoSuscribirse,
    cambiarTextoBoton,
    crearBotonConLogo,
    crearPiezas,
    insertarPanelEnAncla,
    inyectarCss,
    obtenerTextoBoton,
    pieza,
    progreso
} from './ui.js';

export function actualizarResumenEstadoModo(pc) {
    if (!pc || estado.ocupado) return;

    const enDom = obtenerVideosEnPantallaDom().length;
    const btnPantalla = pc.botonesModo.find(b => b.dataset.modo === 'pantalla');
    if (btnPantalla) {
        btnPantalla.textContent = enDom > 0 ? `En pantalla (${enDom})` : 'En pantalla';
    }

    if (!pc.conteoListo) return;

    if (pc.modo === 'pantalla') {
        pc.pct.textContent = `0 / ${enDom}`;
        pc.estado.textContent = `Modo En pantalla · ${enDom} videos visibles listos para descargar a TXT`;
        return;
    }

    if (pc.modo === 'ultimos') {
        const maxN = Math.max(1, parseInt(pc.inputUltimos.value, 10) || CFG.ULTIMOS_DEFECTO);
        const objetivo = pc.totalExactoCanal > 0 ? Math.min(maxN, pc.totalExactoCanal) : maxN;
        pc.pct.textContent = `0 / ${objetivo}`;
        pc.estado.textContent = `Modo Últimos · Descargará los ${objetivo} videos más recientes (de ${pc.totalExactoCanal || '?'} disponibles)`;
        return;
    }

    const desglose = [];
    for (const cat of CATEGORIAS) {
        const info = pc.categoriasDescubiertas.get(cat.clave);
        if (info?.conteo > 0) {
            desglose.push(`${info.conteo} ${cat.clave}`);
        }
    }

    if (pc.totalExactoCanal > 0) {
        pc.pct.textContent = `0 / ${pc.totalExactoCanal}`;
        pc.estado.textContent = `Listo · ${pc.totalExactoCanal} videos disponibles en el canal (${desglose.join(' · ')})`;
    } else {
        pc.pct.textContent = `0 / ${enDom}`;
        pc.estado.textContent = `Listo · ${enDom} videos detectados en pantalla (elige un modo para descargar)`;
    }
}

export function actualizarConteoEnPantallaUI() {
    if (!estado.panelCanal || estado.ocupado) return;
    const btnPantalla = estado.panelCanal.botonesModo.find(b => b.dataset.modo === 'pantalla');
    if (btnPantalla) {
        const nDom = obtenerVideosEnPantallaDom().length;
        btnPantalla.textContent = nDom > 0 ? `En pantalla (${nDom})` : 'En pantalla';
    }
    if (estado.panelCanal.modo === 'pantalla') {
        actualizarResumenEstadoModo(estado.panelCanal);
    }
}

export async function descubrirTotalesCanalEnSegundoPlano(pc) {
    const miSeq = ++estado.seqDescubrimiento;

    try {
        const datos = await resolverDatosCanalActual();
        if (miSeq !== estado.seqDescubrimiento || pc !== estado.panelCanal) return;

        pc.channelId = datos.channelId;
        pc.nombreCanal = datos.nombreCanal;
        pc.clientVersion = datos.clientVersion;

        if (datos.textoTotalHeader) {
            pc.estado.textContent = `Canal: ${datos.nombreCanal} · ${datos.textoTotalHeader} detectados · Verificando desglose...`;
            pc.pct.textContent = datos.textoTotalHeader;
        }

        if (!datos.channelId || !datos.channelId.startsWith('UC')) {
            pc.conteoListo = true;
            actualizarResumenEstadoModo(pc);
            return;
        }

        const sufijo = datos.channelId.slice(2);

        const promesasCategorias = CATEGORIAS.map(async cat => {
            const playlistId = `${cat.prefijo}${sufijo}`;
            const info = await consultarPrimeraPaginaPlaylist(playlistId, cat.clave);
            return { cat, playlistId, info };
        });

        const promesaUU = consultarPrimeraPaginaPlaylist(`UU${sufijo}`, 'Videos');

        const [resultados, infoUU] = await Promise.all([Promise.all(promesasCategorias), promesaUU]);

        if (miSeq !== estado.seqDescubrimiento || pc !== estado.panelCanal) return;

        let sumaTotal = 0;
        for (const { cat, playlistId, info } of resultados) {
            pc.categoriasDescubiertas.set(cat.clave, {
                ...info,
                playlistId,
                carpeta: cat.carpeta
            });
            sumaTotal += info.conteo;
        }

        if (infoUU?.conteo > sumaTotal) {
            sumaTotal = infoUU.conteo;
        }
        if (infoUU?.videos?.length > 0) {
            pc.infoGeneralUU = {
                ...infoUU,
                playlistId: `UU${sufijo}`,
                carpeta: 'Videos'
            };
        }

        pc.totalExactoCanal = sumaTotal;
        pc.conteoListo = true;

        const btnTodos = pc.botonesModo.find(b => b.dataset.modo === 'todos');
        if (btnTodos && sumaTotal > 0) {
            btnTodos.textContent = `Todos (${sumaTotal})`;
        }

        actualizarResumenEstadoModo(pc);
    } catch {
        if (miSeq === estado.seqDescubrimiento && pc === estado.panelCanal) {
            pc.conteoListo = true;
            actualizarResumenEstadoModo(pc);
        }
    }
}

export function empaquetarYDescargarZipFinal(
    pc,
    zip,
    carpetaRaiz,
    archivosParaMapa,
    cabeceraLog,
    ok,
    errores,
    sinSubtitulos,
    totalProcesados,
    fueParcial
) {
    archivosParaMapa.push({
        ruta: `${carpetaRaiz}/_REPORTE.txt`,
        comentario: 'Mapa de estructura de archivos y registro de transcripciones'
    });

    const mapaAscii = generarMapaArbol(carpetaRaiz, archivosParaMapa);

    pc.log = [
        ...cabeceraLog,
        'ESTRUCTURA DE ARCHIVOS DEL CANAL:',
        mapaAscii,
        '',
        'DETALLE DE OPERACIONES:',
        ...pc.log.slice(cabeceraLog.length),
        '',
        `Total TXT: ${ok} | Sin subtítulos (Azul - el video no tiene): ${sinSubtitulos} | Errores: ${errores}`
    ];

    zip.agregar(`${carpetaRaiz}/_REPORTE.txt`, pc.log.join('\r\n'));

    const blob = zip.generarBlob();
    pc.zipBlob = blob;
    pc.zipNombre = fueParcial
        ? `${carpetaRaiz} (Parcial ${ok} TXT).zip`
        : `${carpetaRaiz}.zip`;
    pc.ultimoModoDescargado = pc.modo;

    guardarZip(pc);

    const mb = (blob.size / 1048576).toFixed(2);
    const duracionTotal = formatearTiempoRestante((Date.now() - (pc.tiempoInicio || Date.now())) / 1000);
    pc.pct.textContent = fueParcial ? `Detenido (${ok}/${totalProcesados})` : `100% (${ok}/${totalProcesados})`;
    pc.estado.textContent = `${fueParcial ? 'ZIP parcial guardado' : 'Canal descargado'} (${mb} MB en ${duracionTotal}) · ${ok} TXT · 🔵 ${sinSubtitulos} sin subtítulos · ${errores} errores`;
    cambiarTextoBoton(pc.boton, 'Guardar .zip');
    pc.boton.classList.remove('detener');
    pc.boton.classList.add('listo');
    pc.boton.title = 'Clic: volver a guardar el ZIP al instante. Mayús + clic: volver a escanear el canal.';
}

export async function ejecutarDescargaCanal(pc) {
    if (estado.ocupado) return;
    estado.ocupado = true;
    estado.cancelado = false;

    pc.boton.disabled = false;
    pc.boton.classList.remove('listo');
    pc.boton.classList.add('detener');
    cambiarTextoBoton(pc.boton, 'Detener descarga');
    pc.copiar.hidden = true;
    pc.botonesModo.forEach(b => (b.disabled = true));
    pc.inputUltimos.disabled = true;

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
    }

    if (pc.zipUrl) {
        URL.revokeObjectURL(pc.zipUrl);
        pc.zipUrl = null;
    }
    pc.zipBlob = null;

    const nombreCanal = seguro(pc.nombreCanal || obtenerNombreCanalDom(), 'Canal de YouTube');
    pc.nombreCanal = nombreCanal;
    pc.tiempoInicio = Date.now();

    const cabeceraLog = [
        'Canal de YouTube a TXT v3.0.0 (Motor Multi-Cliente Innertube ANDROID/IOS/WEB + Next Transcript + Pool Iframes + Azul Estricto)',
        `Canal: ${nombreCanal}`,
        `Modo: ${pc.modo.toUpperCase()} (Concurrencia: ${CFG.CONCURRENCIA} hilos | Pool Iframes /watch: ${CFG.MAX_IFRAMES_SIMULTANEOS})`,
        `Configuración: TXT | División: Bloques (${CFG.BLOCK_SIZE}) | Marcas de tiempo: Sí | Título y enlace: Sí`,
        `Fecha: ${new Date().toLocaleString('es-CL')}`,
        ''
    ];
    pc.log = [...cabeceraLog];

    let ok = 0;
    let errores = 0;
    let sinSubtitulos = 0;

    const zip = crearZipNativo();
    const carpetaRaiz = seguro(nombreCanal);
    const archivosParaMapa = [];

    try {
        const cola = await construirColaVideos(pc, progreso, descubrirTotalesCanalEnSegundoPlano);
        verificarCancelacion();

        crearPiezas(pc, cola);

        const tiempoInicio = pc.tiempoInicio;
        let indice = 0;
        let procesados = 0;
        const activos = new Map();

        const actualizarProgreso = () => {
            const etaTexto = calcularEta(procesados, cola.length, tiempoInicio);
            const pctNum = cola.length ? Math.round((procesados / cola.length) * 100) : 0;
            const etaBarra = etaTexto ? ` · ETA: ${etaTexto}` : '';
            pc.pct.textContent = `${pctNum}% (${procesados}/${cola.length})${etaBarra}`;

            if (activos.size > 0) {
                const primerActivo = activos.values().next().value;
                const subCarpeta = primerActivo.carpeta || primerActivo.categoria || 'Videos';
                const sufijoMas = activos.size > 1 ? ` (+${activos.size - 1} más)` : '';
                const etaEstado = etaTexto ? ` · ETA: ${etaTexto}` : '';
                progreso(
                    pc,
                    procesados,
                    cola.length,
                    `[${subCarpeta}] (${CFG.CONCURRENCIA} hilos${etaEstado} · ${procesados}/${cola.length}) Transcribiendo: ${primerActivo.nombre}${sufijoMas}`
                );
            } else {
                const etaEstado = etaTexto ? ` · ETA: ${etaTexto}` : '';
                progreso(
                    pc,
                    procesados,
                    cola.length,
                    `Canal (${CFG.CONCURRENCIA} hilos${etaEstado}) · OK: ${ok} · Sin subtítulos (Azul): ${sinSubtitulos} · Errores: ${errores} (${procesados}/${cola.length})`
                );
            }
        };

        const trabajador = async idWorker => {
            while (indice < cola.length) {
                if (estado.cancelado) break;

                const i = indice++;
                if (i >= cola.length) break;

                const item = cola[i];
                const subCarpeta = item.carpeta || item.categoria || 'Videos';

                activos.set(idWorker, item);
                pieza(pc, i, 'procesando', item.nombre, 'Extrayendo transcripción...');
                actualizarProgreso();

                try {
                    const resTxt = await procesarVideoATxt(item);
                    if (estado.cancelado) break;

                    const rutaBase = `${carpetaRaiz}/${seguro(subCarpeta)}`;
                    const rutaFinal = rutaLibre(zip, rutaBase, resTxt.nombreArchivo);

                    zip.agregar(rutaFinal, resTxt.bytes);
                    ok++;

                    const kb = (resTxt.bytes.byteLength / 1024).toFixed(1);
                    const comentario = `Transcripción TXT (${resTxt.idioma}, ${resTxt.bloques} bloques) · ${kb} KB`;

                    archivosParaMapa.push({
                        ruta: rutaFinal,
                        comentario
                    });

                    pieza(
                        pc,
                        i,
                        'ok',
                        `${resTxt.fecha} ${resTxt.titulo}`,
                        `OK (${resTxt.idioma}) · ${kb} KB`
                    );
                    colorearVideoDom(item.videoId, 'ok', `Descargado: ${resTxt.nombreArchivo} (${resTxt.idioma})`);

                    pc.log.push(`[OK] ${rutaFinal} (${resTxt.idioma} · ${kb} KB)`);
                } catch (e) {
                    if (e.esCancelacion || estado.cancelado) break;

                    if (e.noTieneSubtitulos) {
                        sinSubtitulos++;
                        const msgAzul = 'No existe posibilidad de sacar subtítulos porque el video no tiene ninguno habilitado.';
                        pieza(pc, i, 'sin-subtitulos', item.nombre, `🔵 ${msgAzul}`);
                        colorearVideoDom(item.videoId, 'sin-subtitulos', `🔵 ${msgAzul}`);
                        pc.log.push(
                            `[SIN SUBTÍTULOS - AZUL] ${subCarpeta}/${item.nombre} (https://youtu.be/${item.videoId}): ${msgAzul}`
                        );
                    } else {
                        errores++;
                        pieza(pc, i, 'error', item.nombre, e.message);
                        colorearVideoDom(item.videoId, 'error', e.message);
                        pc.log.push(
                            `[ERROR] ${subCarpeta}/${item.nombre} (https://youtu.be/${item.videoId}): ${e.message}`
                        );
                    }
                } finally {
                    activos.delete(idWorker);
                    procesados++;
                    actualizarProgreso();
                }

                if (CFG.PAUSA > 0) {
                    await dormir(CFG.PAUSA);
                }
            }
        };

        const numHilos = Math.min(CFG.CONCURRENCIA, cola.length);
        const promesas = [];
        for (let w = 0; w < numHilos; w++) {
            promesas.push(trabajador(w));
        }

        await Promise.all(promesas);

        verificarCancelacion();

        archivosParaMapa.sort((a, b) => a.ruta.localeCompare(b.ruta, 'es', { numeric: true }));

        empaquetarYDescargarZipFinal(
            pc,
            zip,
            carpetaRaiz,
            archivosParaMapa,
            cabeceraLog,
            ok,
            errores,
            sinSubtitulos,
            cola.length,
            false
        );
    } catch (e) {
        if (e.esCancelacion || estado.cancelado) {
            pc.log.push('[CANCELADO] Descarga detenida por el usuario');
            if (ok > 0) {
                archivosParaMapa.sort((a, b) => a.ruta.localeCompare(b.ruta, 'es', { numeric: true }));
                empaquetarYDescargarZipFinal(
                    pc,
                    zip,
                    carpetaRaiz,
                    archivosParaMapa,
                    cabeceraLog,
                    ok,
                    errores,
                    sinSubtitulos,
                    ok + errores + sinSubtitulos,
                    true
                );
            } else {
                zip.limpiarMemoria();
                pc.estado.textContent = 'Descarga detenida sin archivos procesados.';
                cambiarTextoBoton(pc.boton, 'Descargar .zip');
                pc.boton.classList.remove('detener', 'listo');
            }
        } else {
            zip.limpiarMemoria();
            pc.log.push(`[ERROR GENERAL] ${e.message}`);
            pc.estado.textContent = `Error: ${e.message}`;
            cambiarTextoBoton(pc.boton, 'Descargar .zip');
            pc.boton.classList.remove('detener');
            console.error('[Canal de YouTube a TXT]', e);
        }
    } finally {
        limpiarTodosLosIframesTrabajadores();
        estado.subtitulosCachePorVideoId.clear();
        estado.transcriptJsonPorVideoId.clear();
        restaurarColoresVideosDom();
        pc.copiar.hidden = false;
        pc.boton.disabled = false;
        pc.boton.classList.remove('detener');
        pc.botonesModo.forEach(b => (b.disabled = false));
        pc.inputUltimos.disabled = false;
        estado.cancelado = false;
        estado.ocupado = false;
    }
}

export function montarPanelCanal() {
    if (!enPantallaDeCanal()) {
        if (estado.panelCanal?.panel?.isConnected && !estado.ocupado) {
            if (estado.panelCanal.zipUrl) URL.revokeObjectURL(estado.panelCanal.zipUrl);
            estado.panelCanal.panel.remove();
            estado.panelCanal = null;
        }
        return;
    }

    if (!document.getElementById('maximus-yt-css')) {
        inyectarCss();
    }

    restaurarColoresVideosDom();

    const ancla = buscarAnclaDebajoSuscribirse(obtenerRaizCanalDom());
    if (!ancla) return;

    const claveActual = obtenerClaveCanalUrl();

    if (estado.panelCanal && estado.panelCanal.claveCanal !== claveActual && !estado.ocupado) {
        if (estado.panelCanal.zipUrl) URL.revokeObjectURL(estado.panelCanal.zipUrl);
        if (estado.panelCanal.panel?.isConnected) estado.panelCanal.panel.remove();
        estado.panelCanal = null;
    }

    if (estado.panelCanal) {
        if (!estado.panelCanal.panel.isConnected) {
            insertarPanelEnAncla(estado.panelCanal.panel, ancla);
        }
        actualizarConteoEnPantallaUI();
        return;
    }

    const boton = crearBotonConLogo(
        {
            className: 'maximus-boton',
            type: 'button'
        },
        'Descargar .zip'
    );

    const btnCaptcha = crearElemento('button', {
        className: 'maximus-boton captcha',
        type: 'button',
        hidden: true,
        textContent: '⚡ Resolver Captcha y Continuar',
        title: 'Haz clic para abrir el captcha y reanudar la descarga'
    });

    btnCaptcha.addEventListener('click', () => {
        if (estado.urlCaptchaActivo && !btnCaptcha.dataset.abierto) {
            btnCaptcha.dataset.abierto = '1';
            btnCaptcha.textContent = '✅ Ya lo resolví, ¡Continuar!';
            try {
                window.open(estado.urlCaptchaActivo, '_blank');
            } catch {
                // Ignorar si el navegador bloquea la pestaña emergente.
            }
        } else {
            delete btnCaptcha.dataset.abierto;
            reanudarDespuesDeCaptcha();
        }
    });

    const btnModoTodos = crearElemento('button', {
        className: 'maximus-modo-btn activo',
        type: 'button',
        dataset: { modo: 'todos' },
        textContent: 'Todos'
    });

    const btnModoUltimos = crearElemento('button', {
        className: 'maximus-modo-btn',
        type: 'button',
        dataset: { modo: 'ultimos' },
        textContent: 'Últimos'
    });

    const inputUltimos = crearElemento('input', {
        className: 'maximus-input-ultimos',
        type: 'number',
        min: '1',
        max: '5000',
        value: String(CFG.ULTIMOS_DEFECTO),
        title: 'Cantidad de videos más recientes a descargar',
        hidden: true
    });

    const btnModoPantalla = crearElemento('button', {
        className: 'maximus-modo-btn',
        type: 'button',
        dataset: { modo: 'pantalla' },
        textContent: 'En pantalla'
    });

    const modosDiv = crearElemento(
        'div',
        {
            className: 'maximus-modos',
            title: 'Elige qué videos del canal incluir en el ZIP'
        },
        [btnModoTodos, btnModoUltimos, inputUltimos, btnModoPantalla]
    );

    const controlesIzq = crearElemento(
        'div',
        { className: 'maximus-controles-izq' },
        [boton, btnCaptcha, modosDiv]
    );

    const aproxHeader = obtenerConteoAproximadoHeader();
    const nombreCanalInicial = obtenerNombreCanalDom();

    const pct = crearElemento('span', {
        className: 'maximus-pct',
        textContent: aproxHeader ? `~${aproxHeader}` : '0%'
    });

    const barra = crearElemento('div', { className: 'maximus-barra' }, [pct]);

    const estadoDiv = crearElemento('div', {
        className: 'maximus-estado',
        textContent: aproxHeader
            ? `Canal: ${nombreCanalInicial} · ~${aproxHeader} detectados · Verificando desglose...`
            : 'Calculando total de videos del canal...'
    });

    const copiar = crearElemento('button', {
        className: 'maximus-log',
        type: 'button',
        hidden: true,
        textContent: 'Copiar log'
    });

    const pie = crearElemento('div', { className: 'maximus-pie' }, [estadoDiv, copiar]);

    const panel = crearElemento(
        'div',
        {
            className: 'maximus-panel',
            dataset: { maximus: 'panel-yt' }
        },
        [controlesIzq, barra, pie]
    );

    insertarPanelEnAncla(panel, ancla);

    estado.panelCanal = {
        claveCanal: claveActual,
        channelId: '',
        nombreCanal: obtenerNombreCanalDom(),
        clientVersion: '2.20260401.01.00',
        modo: 'todos',
        panel,
        boton,
        btnCaptcha,
        botonesModo: [btnModoTodos, btnModoUltimos, btnModoPantalla],
        inputUltimos,
        barra,
        pct,
        estado: estadoDiv,
        copiar,
        piezas: [],
        log: [],
        categoriasDescubiertas: new Map(),
        totalExactoCanal: 0,
        conteoListo: false,
        zipBlob: null,
        zipUrl: null,
        zipNombre: ''
    };

    for (const evento of ['pointerdown', 'mousedown', 'mouseup', 'click', 'keydown']) {
        panel.addEventListener(evento, e => e.stopPropagation());
    }

    estado.panelCanal.botonesModo.forEach(btn => {
        btn.addEventListener('click', () => {
            if (estado.ocupado) return;
            const nuevoModo = btn.dataset.modo;
            estado.panelCanal.modo = nuevoModo;
            estado.panelCanal.botonesModo.forEach(b => b.classList.toggle('activo', b === btn));
            estado.panelCanal.inputUltimos.hidden = nuevoModo !== 'ultimos';

            if (estado.panelCanal.zipBlob) {
                estado.panelCanal.boton.classList.remove('listo');
                cambiarTextoBoton(estado.panelCanal.boton, 'Descargar .zip');
            }
            actualizarResumenEstadoModo(estado.panelCanal);
        });
    });

    estado.panelCanal.inputUltimos.addEventListener('input', () => {
        if (estado.ocupado) return;
        actualizarResumenEstadoModo(estado.panelCanal);
    });

    estado.panelCanal.boton.addEventListener('click', evento => {
        if (estado.ocupado) {
            cancelarDescargaActiva();
            return;
        }

        if (
            estado.panelCanal.zipBlob &&
            !evento.shiftKey &&
            estado.panelCanal.ultimoModoDescargado === estado.panelCanal.modo
        ) {
            guardarZip(estado.panelCanal);
            estado.panelCanal.estado.textContent = 'ZIP del canal descargado nuevamente.';
        } else {
            ejecutarDescargaCanal(estado.panelCanal);
        }
    });

    estado.panelCanal.copiar.addEventListener('click', async () => {
        await copiarAlPortapapeles(estado.panelCanal.log.join('\n'));
        const original = estado.panelCanal.copiar.textContent;
        estado.panelCanal.copiar.textContent = '¡Log copiado!';
        setTimeout(() => {
            estado.panelCanal.copiar.textContent = original;
        }, 1800);
    });

    descubrirTotalesCanalEnSegundoPlano(estado.panelCanal);
}

export function obtenerInfoPaginaActual() {
    const path = window.location.pathname;
    if (path.includes('/watch')) {
        const vid = new URLSearchParams(window.location.search).get('v');
        return { tipo: 'watch', videoId: vid };
    }
    if (path.includes('/shorts/')) {
        const m = path.match(/\/shorts\/([^/?#]+)/);
        return { tipo: 'shorts', videoId: m ? m[1] : null };
    }
    return { tipo: null, videoId: null };
}

export async function descargarTranscripcionVideoActual(botonEl, info) {
    if (!info || !info.videoId) return;
    const textoOriginal = obtenerTextoBoton(botonEl);
    botonEl.disabled = true;
    botonEl.classList.remove('copiado', 'sin-subtitulos');
    cambiarTextoBoton(botonEl, '⏳ Extrayendo...');

    try {
        let titulo = document.title.replace(/- YouTube$/i, '').trim() || info.videoId;
        try {
            const snap = obtenerSnapshotPagina(info.videoId);
            if (snap?.pr?.videoDetails?.title) {
                titulo = snap.pr.videoDetails.title;
            }
        } catch {
            // Usar el título del documento si no existe playerResponse.
        }

        const res = await procesarVideoATxt({ videoId: info.videoId, nombre: titulo });

        if (res && res.bytes) {
            descargarBlob(res.bytes, res.nombreArchivo, 'text/plain;charset=utf-8');
            const txt = new TextDecoder().decode(res.bytes);
            await copiarAlPortapapeles(txt);

            cambiarTextoBoton(botonEl, '¡Copiado y Descargado! ✓');
            botonEl.classList.add('copiado');
            setTimeout(() => {
                botonEl.disabled = false;
                cambiarTextoBoton(botonEl, textoOriginal);
                botonEl.classList.remove('copiado');
            }, 2500);
        }
    } catch (e) {
        if (e.noTieneSubtitulos) {
            cambiarTextoBoton(botonEl, '🔵 El video no tiene subtítulos');
            botonEl.classList.add('sin-subtitulos');
            console.info(
                `[Canal de YouTube a TXT] [SIN SUBTÍTULOS - AZUL] https://youtu.be/${info.videoId}: No existe posibilidad de sacar subtítulos porque el video no tiene ninguno habilitado.`
            );
        } else {
            cambiarTextoBoton(botonEl, `❌ ${e.message || 'Error'}`);
        }
        setTimeout(() => {
            botonEl.disabled = false;
            cambiarTextoBoton(botonEl, textoOriginal);
            botonEl.classList.remove('sin-subtitulos');
        }, 3500);
    }
}

export function montarBotonVideoSuelto() {
    const info = obtenerInfoPaginaActual();
    if (!info.tipo || !info.videoId) return;

    if (!document.getElementById('maximus-yt-css')) {
        inyectarCss();
    }

    if (info.tipo === 'watch') {
        const contenedor = document.querySelector(
            'ytd-watch-metadata:not([hidden]) #top-level-buttons-computed, ytd-video-primary-info-renderer:not([hidden]) #top-level-buttons-computed'
        );
        if (!contenedor) return;
        const existente = contenedor.parentElement?.querySelector('.maximus-btn-video');
        if (existente) {
            existente.dataset.videoId = info.videoId;
            return;
        }

        const btn = crearBotonConLogo(
            {
                className: 'maximus-btn-video',
                type: 'button',
                dataset: { videoId: info.videoId },
                title: 'Descarga la transcripción en formato TXT (bloques de 200, marcas de tiempo y título)'
            },
            'Transcripción TXT'
        );
        btn.addEventListener('click', () => {
            const actualInfo = obtenerInfoPaginaActual();
            descargarTranscripcionVideoActual(btn, actualInfo);
        });
        contenedor.insertAdjacentElement('beforebegin', btn);
    }

    if (info.tipo === 'shorts') {
        const reel = document.querySelector('ytd-reel-video-renderer[is-active]');
        if (!reel) return;
        const contenedorAcciones = reel.querySelector('#actions-inner, #actions');
        if (!contenedorAcciones) return;
        if (reel.querySelector('.maximus-btn-video')) return;

        const btn = crearBotonConLogo(
            {
                className: 'maximus-btn-video',
                type: 'button',
                title: 'Descarga la transcripción del Short en TXT'
            },
            'TXT'
        );
        btn.style.margin = '6px 0';
        btn.addEventListener('click', () => {
            const actualInfo = obtenerInfoPaginaActual();
            descargarTranscripcionVideoActual(btn, actualInfo);
        });
        contenedorAcciones.insertAdjacentElement('afterbegin', btn);
    }
}

export function agendar() {
    if (estado.ocupado || estado.pendiente) return;
    estado.pendiente = true;
    setTimeout(() => {
        estado.pendiente = false;
        if (enPantallaDeCanal()) {
            montarPanelCanal();
        } else {
            montarBotonVideoSuelto();
        }
    }, 400);
}

export function iniciar() {
    if (estado.esIframe && !estado.esIframeTrabajador) {
        return;
    }

    instalarHooksPotUnaVez();
    registrarReceptorMensajesVentana();

    if (estado.esIframeTrabajador) {
        ejecutarAgenteIframeTrabajador();
        return;
    }

    // Limpia paneles e intervalos anteriores si la extensión recarga el bundle desde GitHub.
    if (window.__maximusYtInterval) {
        clearInterval(window.__maximusYtInterval);
    }
    if (window.__maximusYtCleanup) {
        try {
            window.__maximusYtCleanup();
        } catch {
            // Ignorar limpieza previa incompleta.
        }
    }

    document.querySelectorAll('.maximus-panel, .maximus-btn-video').forEach(el => el.remove());
    estado.panelCanal = null;

    if (document.documentElement) {
        document.documentElement.dataset.maximusYtIniciado = '1';
    }

    inyectarCss();
    agendar();

    const eventosNav = ['yt-navigate-finish', 'yt-page-data-updated', 'popstate'];
    for (const ev of eventosNav) {
        window.addEventListener?.(ev, agendar, { passive: true });
        document.addEventListener?.(ev, agendar, { passive: true });
    }

    window.__maximusYtCleanup = () => {
        for (const ev of eventosNav) {
            window.removeEventListener?.(ev, agendar, { passive: true });
            document.removeEventListener?.(ev, agendar, { passive: true });
        }
    };

    window.__maximusYtInterval = setInterval(() => {
        if (!estado.ocupado) {
            if (enPantallaDeCanal()) {
                montarPanelCanal();
            } else {
                montarBotonVideoSuelto();
            }
        }
    }, 1500);
}

if (!estado.esIframe || estado.esIframeTrabajador) {
    if (document.documentElement) {
        document.documentElement.dataset.maximusYtIniciado = '1';
    }
    instalarHooksPotUnaVez();
    registrarReceptorMensajesVentana();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar, { once: true });
    } else {
        iniciar();
    }
}
