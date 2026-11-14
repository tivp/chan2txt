import {
    win,
    esIframe,
    CFG,
    CATEGORIAS,
    _subtitulosCachePorVideoId,
    _transcriptJsonPorVideoId,
    abortadoresActivos
} from './config.js';
import {
    dormir,
    crearElemento,
    seguro,
    descargarBlob,
    formatearTiempoRestante,
    calcularEta
} from './utils.js';
import { generarMapaArbol, crearZipNativo, rutaLibre, guardarZip } from './zip.js';
import { _rememberPotFromTimedtextUrl } from './interceptor.js';
import { limpiarTodosLosIframesTrabajadores } from './worker-iframe.js';
import {
    enPausaPorCaptcha,
    urlCaptchaActivo,
    reanudarDespuesDeCaptcha
} from './http.js';
import { procesarVideoATxt } from './extractor.js';
import {
    enPantallaDeCanal,
    obtenerClaveCanalUrl,
    obtenerNombreCanalDom,
    obtenerConteoAproximadoHeader,
    resolverDatosCanalActual,
    consultarPrimeraPaginaPlaylist,
    obtenerVideosEnPantallaDom,
    colorearVideoDom,
    restaurarColoresVideosDom,
    construirColaVideos
} from './channel.js';
import {
    css,
    progreso,
    crearPiezas,
    pieza,
    buscarAnclaDebajoSuscribirse,
    insertarPanelEnAncla
} from './ui.js';

export let panelCanal = null;
export let ocupado = false;
export let cancelado = false;
let pendiente = false;
let seqDescubrimiento = 0;

// ==================================================
// CONTROL DE CANCELACIÓN Y DETENCIÓN
// ==================================================

export function cancelarDescargaActiva() {
    if (!ocupado) return;
    cancelado = true;
    if (enPausaPorCaptcha) {
        reanudarDespuesDeCaptcha();
    }
    limpiarTodosLosIframesTrabajadores();
    for (const abortar of abortadoresActivos) {
        try {
            abortar();
        } catch {}
    }
    abortadoresActivos.clear();
    if (panelCanal?.estado) {
        panelCanal.estado.textContent = 'Deteniendo descarga...';
    }
}

export function verificarCancelacion() {
    if (cancelado) {
        const err = new Error('Descarga detenida por el usuario');
        err.esCancelacion = true;
        throw err;
    }
}

export function montarPanelCanal() {
    if (!enPantallaDeCanal()) {
        if (panelCanal?.panel?.isConnected && !ocupado) {
            if (panelCanal.zipUrl) URL.revokeObjectURL(panelCanal.zipUrl);
            panelCanal.panel.remove();
            panelCanal = null;
        }
        return;
    }

    if (!document.getElementById('maximus-yt-css')) {
        css();
    }

    restaurarColoresVideosDom();

    const ancla = buscarAnclaDebajoSuscribirse();
    if (!ancla) return;

    const claveActual = obtenerClaveCanalUrl();

    if (panelCanal && panelCanal.claveCanal !== claveActual && !ocupado) {
        if (panelCanal.zipUrl) URL.revokeObjectURL(panelCanal.zipUrl);
        if (panelCanal.panel?.isConnected) panelCanal.panel.remove();
        panelCanal = null;
    }

    if (panelCanal) {
        if (!panelCanal.panel.isConnected) {
            insertarPanelEnAncla(panelCanal.panel, ancla);
        }
        actualizarConteoEnPantallaUI();
        return;
    }

    const boton = crearElemento('button', {
        className: 'maximus-boton',
        type: 'button',
        textContent: 'Descargar .zip'
    });

    const btnCaptcha = crearElemento('button', {
        className: 'maximus-boton captcha',
        type: 'button',
        hidden: true,
        textContent: '⚡ Resolver Captcha y Continuar',
        title: 'Haz clic para abrir el captcha y reanudar la descarga'
    });

    btnCaptcha.addEventListener('click', () => {
        if (urlCaptchaActivo && !btnCaptcha.dataset.abierto) {
            btnCaptcha.dataset.abierto = '1';
            btnCaptcha.textContent = '✅ Ya lo resolví, ¡Continuar!';
            try {
                window.open(urlCaptchaActivo, '_blank');
            } catch {}
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

    const estado = crearElemento('div', {
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

    const pie = crearElemento('div', { className: 'maximus-pie' }, [estado, copiar]);

    const panel = crearElemento(
        'div',
        {
            className: 'maximus-panel',
            dataset: { maximus: 'panel-yt' }
        },
        [controlesIzq, barra, pie]
    );

    insertarPanelEnAncla(panel, ancla);

    panelCanal = {
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
        estado,
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

    panelCanal.botonesModo.forEach(btn => {
        btn.addEventListener('click', () => {
            if (ocupado) return;
            const nuevoModo = btn.dataset.modo;
            panelCanal.modo = nuevoModo;
            panelCanal.botonesModo.forEach(b =>
                b.classList.toggle('activo', b === btn)
            );
            panelCanal.inputUltimos.hidden = nuevoModo !== 'ultimos';

            if (panelCanal.zipBlob) {
                panelCanal.boton.classList.remove('listo');
                panelCanal.boton.textContent = 'Descargar .zip';
            }
            actualizarResumenEstadoModo(panelCanal);
        });
    });

    panelCanal.inputUltimos.addEventListener('input', () => {
        if (ocupado) return;
        actualizarResumenEstadoModo(panelCanal);
    });

    panelCanal.boton.addEventListener('click', evento => {
        if (ocupado) {
            cancelarDescargaActiva();
            return;
        }

        if (
            panelCanal.zipBlob &&
            !evento.shiftKey &&
            panelCanal.ultimoModoDescargado === panelCanal.modo
        ) {
            guardarZip(panelCanal);
            panelCanal.estado.textContent = 'ZIP del canal descargado nuevamente.';
        } else {
            ejecutarDescargaCanal(panelCanal);
        }
    });

    panelCanal.copiar.addEventListener('click', () => {
        GM_setClipboard(panelCanal.log.join('\n'), 'text');
        const original = panelCanal.copiar.textContent;
        panelCanal.copiar.textContent = '¡Log copiado!';
        setTimeout(() => {
            panelCanal.copiar.textContent = original;
        }, 1800);
    });

    descubrirTotalesCanalEnSegundoPlano(panelCanal);
}

export function actualizarConteoEnPantallaUI() {
    if (!panelCanal || ocupado) return;
    const btnPantalla = panelCanal.botonesModo.find(b => b.dataset.modo === 'pantalla');
    if (btnPantalla) {
        const nDom = obtenerVideosEnPantallaDom().length;
        btnPantalla.textContent = nDom > 0 ? `En pantalla (${nDom})` : 'En pantalla';
    }
    if (panelCanal.modo === 'pantalla') {
        actualizarResumenEstadoModo(panelCanal);
    }
}

export function actualizarResumenEstadoModo(pc) {
    if (!pc || ocupado) return;

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

export async function descubrirTotalesCanalEnSegundoPlano(pc) {
    const miSeq = ++seqDescubrimiento;

    try {
        const datos = await resolverDatosCanalActual();
        if (miSeq !== seqDescubrimiento || pc !== panelCanal) return;

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

        const [resultados, infoUU] = await Promise.all([
            Promise.all(promesasCategorias),
            promesaUU
        ]);

        if (miSeq !== seqDescubrimiento || pc !== panelCanal) return;

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
        if (miSeq === seqDescubrimiento && pc === panelCanal) {
            pc.conteoListo = true;
            actualizarResumenEstadoModo(pc);
        }
    }
}

// ==================================================
// EJECUTAR DESCARGA DEL CANAL A TXT EN ZIP
// ==================================================

export async function ejecutarDescargaCanal(pc) {
    if (ocupado) return;
    ocupado = true;
    cancelado = false;

    pc.boton.disabled = false;
    pc.boton.classList.remove('listo');
    pc.boton.classList.add('detener');
    pc.boton.textContent = 'Detener descarga';
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
        const cola = await construirColaVideos(pc);
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
                if (cancelado) break;

                const i = indice++;
                if (i >= cola.length) break;

                const item = cola[i];
                const subCarpeta = item.carpeta || item.categoria || 'Videos';

                activos.set(idWorker, item);
                pieza(pc, i, 'procesando', item.nombre, 'Extrayendo transcripción...');
                actualizarProgreso();

                try {
                    const resTxt = await procesarVideoATxt(item);
                    if (cancelado) break;

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
                    colorearVideoDom(
                        item.videoId,
                        'ok',
                        `Descargado: ${resTxt.nombreArchivo} (${resTxt.idioma})`
                    );

                    pc.log.push(`[OK] ${rutaFinal} (${resTxt.idioma} · ${kb} KB)`);
                } catch (e) {
                    if (cancelado) break;

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
        if (e.esCancelacion || cancelado) {
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
                pc.boton.textContent = 'Descargar .zip';
                pc.boton.classList.remove('detener', 'listo');
            }
        } else {
            zip.limpiarMemoria();
            pc.log.push(`[ERROR GENERAL] ${e.message}`);
            pc.estado.textContent = `Error: ${e.message}`;
            pc.boton.textContent = 'Descargar .zip';
            pc.boton.classList.remove('detener');
            console.error('[Canal de YouTube a TXT]', e);
        }
    } finally {
        limpiarTodosLosIframesTrabajadores();
        _subtitulosCachePorVideoId.clear();
        _transcriptJsonPorVideoId.clear();
        restaurarColoresVideosDom();
        pc.copiar.hidden = false;
        pc.boton.disabled = false;
        pc.boton.classList.remove('detener');
        pc.botonesModo.forEach(b => (b.disabled = false));
        pc.inputUltimos.disabled = false;
        cancelado = false;
        ocupado = false;
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
    pc.pct.textContent = fueParcial
        ? `Detenido (${ok}/${totalProcesados})`
        : `100% (${ok}/${totalProcesados})`;
    pc.estado.textContent = `${fueParcial ? 'ZIP parcial guardado' : 'Canal descargado'} (${mb} MB en ${duracionTotal}) · ${ok} TXT · 🔵 ${sinSubtitulos} sin subtítulos · ${errores} errores`;
    pc.boton.textContent = 'Guardar .zip';
    pc.boton.classList.remove('detener');
    pc.boton.classList.add('listo');
    pc.boton.title =
        'Clic: volver a guardar el ZIP al instante. Mayús + clic: volver a escanear el canal.';
}

// ==================================================
// EXPORTACIÓN DIRECTA PARA VIDEOS SUELTOS Y SHORTS
// ==================================================

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
    const textoOriginal = botonEl.textContent;
    botonEl.disabled = true;
    botonEl.classList.remove('copiado', 'sin-subtitulos');
    botonEl.textContent = '⏳ Extrayendo...';

    try {
        let titulo = document.title.replace(/- YouTube$/i, '').trim() || info.videoId;
        try {
            const prDom = win.document?.getElementById('movie_player')?.getPlayerResponse?.();
            if (prDom?.videoDetails?.title) {
                titulo = prDom.videoDetails.title;
            }
        } catch {}

        const res = await procesarVideoATxt({ videoId: info.videoId, nombre: titulo });

        if (res && res.bytes) {
            descargarBlob(res.bytes, res.nombreArchivo, 'text/plain;charset=utf-8');
            const txt = new TextDecoder().decode(res.bytes);
            try {
                if (typeof GM_setClipboard === 'function') {
                    GM_setClipboard(txt, 'text');
                } else if (navigator.clipboard) {
                    await navigator.clipboard.writeText(txt);
                }
            } catch {}

            botonEl.textContent = '¡Copiado y Descargado! ✓';
            botonEl.classList.add('copiado');
            setTimeout(() => {
                botonEl.disabled = false;
                botonEl.textContent = textoOriginal;
                botonEl.classList.remove('copiado');
            }, 2500);
        }
    } catch (e) {
        if (e.noTieneSubtitulos) {
            botonEl.textContent = '🔵 El video no tiene subtítulos';
            botonEl.classList.add('sin-subtitulos');
            console.info(
                `[Canal de YouTube a TXT] [SIN SUBTÍTULOS - AZUL] https://youtu.be/${info.videoId}: No existe posibilidad de sacar subtítulos porque el video no tiene ninguno habilitado.`
            );
        } else {
            botonEl.textContent = `❌ ${e.message || 'Error'}`;
        }
        setTimeout(() => {
            botonEl.disabled = false;
            botonEl.textContent = textoOriginal;
            botonEl.classList.remove('sin-subtitulos');
        }, 3500);
    }
}

export function montarBotonVideoSuelto() {
    const info = obtenerInfoPaginaActual();
    if (!info.tipo || !info.videoId) return;

    if (!document.getElementById('maximus-yt-css')) {
        css();
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

        const btn = crearElemento('button', {
            className: 'maximus-btn-video',
            type: 'button',
            dataset: { videoId: info.videoId },
            title: 'Descarga la transcripción en formato TXT (bloques de 200, marcas de tiempo y título)',
            textContent: '📝 Transcripción TXT'
        });
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

        const btn = crearElemento('button', {
            className: 'maximus-btn-video',
            type: 'button',
            title: 'Descarga la transcripción del Short en TXT',
            textContent: '📝 TXT'
        });
        btn.style.margin = '6px 0';
        btn.addEventListener('click', () => {
            const actualInfo = obtenerInfoPaginaActual();
            descargarTranscripcionVideoActual(btn, actualInfo);
        });
        contenedorAcciones.insertAdjacentElement('afterbegin', btn);
    }
}

// ==================================================
// INICIALIZACIÓN
// ==================================================

export function agendar() {
    if (ocupado || pendiente) return;
    pendiente = true;
    setTimeout(() => {
        pendiente = false;
        if (enPantallaDeCanal()) {
            montarPanelCanal();
        } else {
            montarBotonVideoSuelto();
        }
    }, 400);
}

export function iniciar() {
    css();
    agendar();

    for (const ev of ['yt-navigate-finish', 'yt-page-data-updated', 'popstate']) {
        window.addEventListener?.(ev, agendar, { passive: true });
        document.addEventListener?.(ev, agendar, { passive: true });
    }

    setInterval(() => {
        if (!ocupado) {
            if (enPantallaDeCanal()) {
                montarPanelCanal();
            } else {
                montarBotonVideoSuelto();
            }
        }
    }, 1500);
}

if (!esIframe) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar, { once: true });
    } else {
        iniciar();
    }
}
