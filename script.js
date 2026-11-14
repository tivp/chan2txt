// ==UserScript==
// @name         Canal de YouTube a TXT
// @namespace    https://tampermonkey.net/
// @version      3.0.0
// @description  Descarga todas las transcripciones de un canal o de videos individuales y Shorts de YouTube en archivos .txt organizados por fecha y formato de bloques de 200 caracteres (Motor Multi-Cliente Innertube WEB + ANDROID + IOS + MWEB + DOM Transcript Opener + Pool de Iframes /watch + Marcado Azul Estricto).
// @author       tivp
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjIyMCAxOTAgNTUyIDU0MiI+PHBvbHlnb24gcG9pbnRzPSIzNzAuNyw1MDYuOSAzNzAuMyw1MDYuNyAzMzEuNSw0NzguNyAzMzEuMyw0NTMuNyAyNzguMyw0MTUuMSAyOTMsNjA3LjIgMzcwLjcsNjczIi8+PHBvbHlnb24gcG9pbnRzPSI1NDYsNDc5IDU0Niw2MDcuNiA0NDYuMSw2MDcuNiA0NDYuMSw0NzguNCAzOTAuNyw1MDcuMSAzOTAuNyw2ODkuOSA0MTUuNiw3MTEgNDQ1LjksNjM4LjkgNTQ1LjMsNjM4LjkgNTc1LjgsNzExIDYwMC44LDY4NyA2MDAuOCw1MDcuNCIvPjxwb2x5Z29uIHBvaW50cz0iNDMxLjUsNzIxLjcgNTU5LjUsNzIxLjcgNTMzLjksNjU3IDQ1Ny41LDY1NyIvPjxwb2x5Z29uIHBvaW50cz0iNjIwLjYsNjczLjcgNjIwLjYsNTA2LjIgNjU5LjksNDc4LjQgNjU5LjksNDU0LjQgNzEyLjUsNDE2LjEgNjk4LjEsNjA3LjIiLz48cG9seWdvbiBwb2ludHM9IjQ2Mi42LDU4OC45IDQ2Mi42LDQ2MC42IDQ0Ny43LDM2NS45IDQ5NS44LDQwMC4zIDU0Mi42LDM2NS45IDUyOS4xLDQ2MS40IDUyOS4xLDU4OC45Ii8+PHBhdGggZD0iTTQyNy45LDM1NC4xbC0xMDEtNjYuM2wtMTEuNS01Mi43bC04My43LTYuM2wzNC42LDE1Nmw4MC40LDU4LjdsOTguMiwxNS41TDQyNy45LDM1NC4xeiBNMjc2LjMsMjgzLjdsMTE3LjgsNzguNWwyLjUsMTYuNmwtMTE2LjItNzcuM0wyNzYuMywyODMuN3ogTTI4OS4xLDM0N2wtNC4xLTE3LjhsMTE3LjgsNzguNWwyLjUsMTYuNkwyODkuMSwzNDd6Ii8+PHBhdGggZD0iTTU0Ni42LDQ1OS4xbDk4LjItMTUuNWw4MC40LTU4LjdsMzQuNi0xNTZsLTgzLjcsNi4zbC0xMS41LDUyLjdsLTEwMSw2Ni4zTDU0Ni42LDQ1OS4xeiBNNzExLDMwMS41bC0xMTYuMiw3Ny4zbDIuNS0xNi42bDExNy44LTc4LjVMNzExLDMwMS41eiBNNTg2LjEsNDI0LjJsMi41LTE2LjZsMTE3LjgtNzguNWwtNC4xLDE3LjhMNTg2LjEsNDI0LjJ6Ii8+PHBhdGggZD0iTTQ5NS4yLDIwMS4zYy05NiwwLTE1OS4xLDMzLjQtMTU5LjEsMzMuNGw4LjYsNDMuM2wxNTAuNSw5OS40bDE1MS4zLTk5LjFsOC42LTQyLjhDNjU1LjEsMjM1LjQsNTkxLjIsMjAxLjMsNDk1LjIsMjAxLjN6IE00OTYsMzE3LjFsLTg2LjktNTcuOWgxNzIuN0w0OTYsMzE3LjF6Ii8+PC9zdmc+
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_notification
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      www.youtube.com
// @connect      youtube.com
// @connect      *
// ==/UserScript==

(() => {
    'use strict';

    // --- Módulo 1: Configuración, constantes, logo Base64 y estado compartido ---

    // Configuración general, clientes Innertube y estado compartido entre módulos.

    // Logo de Transformer vectorizado en Base64 a partir de Transfomer Logo.svg.
    const LOGO_BASE64 =
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjIyMCAxOTAgNTUyIDU0MiI+PHBvbHlnb24gcG9pbnRzPSIzNzAuNyw1MDYuOSAzNzAuMyw1MDYuNyAzMzEuNSw0NzguNyAzMzEuMyw0NTMuNyAyNzguMyw0MTUuMSAyOTMsNjA3LjIgMzcwLjcsNjczIi8+PHBvbHlnb24gcG9pbnRzPSI1NDYsNDc5IDU0Niw2MDcuNiA0NDYuMSw2MDcuNiA0NDYuMSw0NzguNCAzOTAuNyw1MDcuMSAzOTAuNyw2ODkuOSA0MTUuNiw3MTEgNDQ1LjksNjM4LjkgNTQ1LjMsNjM4LjkgNTc1LjgsNzExIDYwMC44LDY4NyA2MDAuOCw1MDcuNCIvPjxwb2x5Z29uIHBvaW50cz0iNDMxLjUsNzIxLjcgNTU5LjUsNzIxLjcgNTMzLjksNjU3IDQ1Ny41LDY1NyIvPjxwb2x5Z29uIHBvaW50cz0iNjIwLjYsNjczLjcgNjIwLjYsNTA2LjIgNjU5LjksNDc4LjQgNjU5LjksNDU0LjQgNzEyLjUsNDE2LjEgNjk4LjEsNjA3LjIiLz48cG9seWdvbiBwb2ludHM9IjQ2Mi42LDU4OC45IDQ2Mi42LDQ2MC42IDQ0Ny43LDM2NS45IDQ5NS44LDQwMC4zIDU0Mi42LDM2NS45IDUyOS4xLDQ2MS40IDUyOS4xLDU4OC45Ii8+PHBhdGggZD0iTTQyNy45LDM1NC4xbC0xMDEtNjYuM2wtMTEuNS01Mi43bC04My43LTYuM2wzNC42LDE1Nmw4MC40LDU4LjdsOTguMiwxNS41TDQyNy45LDM1NC4xeiBNMjc2LjMsMjgzLjdsMTE3LjgsNzguNWwyLjUsMTYuNmwtMTE2LjItNzcuM0wyNzYuMywyODMuN3ogTTI4OS4xLDM0N2wtNC4xLTE3LjhsMTE3LjgsNzguNWwyLjUsMTYuNkwyODkuMSwzNDd6Ii8+PHBhdGggZD0iTTU0Ni42LDQ1OS4xbDk4LjItMTUuNWw4MC40LTU4LjdsMzQuNi0xNTZsLTgzLjcsNi4zbC0xMS41LDUyLjdsLTEwMSw2Ni4zTDU0Ni42LDQ1OS4xeiBNNzExLDMwMS41bC0xMTYuMiw3Ny4zbDIuNS0xNi42bDExNy44LTc4LjVMNzExLDMwMS41eiBNNTg2LjEsNDI0LjJsMi41LTE2LjZsMTE3LjgtNzguNWwtNC4xLDE3LjhMNTg2LjEsNDI0LjJ6Ii8+PHBhdGggZD0iTTQ5NS4yLDIwMS4zYy05NiwwLTE1OS4xLDMzLjQtMTU5LjEsMzMuNGw4LjYsNDMuM2wxNTAuNSw5OS40bDE1MS4zLTk5LjFsOC42LTQyLjhDNjU1LjEsMjM1LjQsNTkxLjIsMjAxLjMsNDk1LjIsMjAxLjN6IE00OTYsMzE3LjFsLTg2LjktNTcuOWgxNzIuN0w0OTYsMzE3LjF6Ii8+PC9zdmc+';

    const CFG = Object.freeze({
        CONCURRENCIA: 6,
        MAX_IFRAMES_SIMULTANEOS: 3,
        TIMEOUT: 16000,
        TIMEOUT_IFRAME: 16000,
        PAUSA: 60,
        BLOCK_SIZE: 200,
        CLEAN_SUBTITLES: true,
        EXPORT_TIME: true,
        EXPORT_HEADER: true,
        ULTIMOS_DEFECTO: 50,
        MAX_CACHE: 80
    });

    const CATEGORIAS = Object.freeze([
        { clave: 'Videos', prefijo: 'UULF', carpeta: 'Videos' },
        { clave: 'Shorts', prefijo: 'UUSH', carpeta: 'Shorts' },
        { clave: 'En vivo', prefijo: 'UULV', carpeta: 'En vivo' }
    ]);

    // Clientes alternativos de Innertube; varios devuelven pistas timedtext sin pedir token POT de navegador.
    const CLIENTES_INNERTUBE = Object.freeze([
        {
            nombre: 'ANDROID',
            id: '3',
            ua: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14; es_ES) gzip',
            context: {
                clientName: 'ANDROID',
                clientVersion: '20.10.38',
                androidSdkVersion: 34,
                osName: 'Android',
                osVersion: '14',
                hl: 'es',
                gl: 'ES'
            }
        },
        {
            nombre: 'IOS',
            id: '5',
            ua: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X; es_ES)',
            context: {
                clientName: 'IOS',
                clientVersion: '20.10.4',
                deviceMake: 'Apple',
                deviceModel: 'iPhone16,2',
                osName: 'iPhone',
                osVersion: '17.5.1.21F90',
                hl: 'es',
                gl: 'ES'
            }
        },
        {
            nombre: 'MWEB',
            id: '2',
            ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
            context: {
                clientName: 'MWEB',
                clientVersion: '2.20260401.01.00',
                hl: 'es',
                gl: 'ES'
            }
        },
        {
            nombre: 'WEB_EMBEDDED_PLAYER',
            id: '56',
            ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            context: {
                clientName: 'WEB_EMBEDDED_PLAYER',
                clientVersion: '1.20260401.01.00',
                hl: 'es',
                gl: 'ES'
            }
        }
    ]);

    const POT_CARRIED_PARAM_NAMES = Object.freeze([
        'pot', 'potc', 'c', 'cver', 'cplayer', 'cos', 'cosver',
        'cplatform', 'cbr', 'cbrver', 'xorb', 'xobt', 'xovt'
    ]);

    const winRef = typeof unsafeWindow !== 'undefined' ? unsafeWindow : (typeof window !== 'undefined' ? window : null);
    const enIframe = typeof window !== 'undefined' && window.top !== window.self;
    const enIframeTrabajador = enIframe && location.search.includes('maximus_worker=1');

    const estado = {
        win: winRef,
        esIframe: enIframe,
        esIframeTrabajador: enIframeTrabajador,
        potParamsByVideoId: new Map(),
        subtitulosCachePorVideoId: new Map(),
        transcriptJsonPorVideoId: new Map(),
        potLatestParams: null,
        potHooksInstalled: false,
        estadoFilas: new Map(),
        abortadoresActivos: new Set(),
        callbacksWorkersIframe: new Map(),
        iframesActivosSet: new Set(),
        panelCanal: null,
        ocupado: false,
        cancelado: false,
        pendiente: false,
        seqDescubrimiento: 0,
        iframesEnCurso: 0,
        enPausaPorCaptcha: false,
        resolverCaptchaFn: null,
        urlCaptchaActivo: ''
    };

    // Inserta al final para mantener comportamiento LRU simple y acotar uso de memoria.
    function guardarEnMapaConLimite(mapa, clave, valor, maxItems = CFG.MAX_CACHE) {
        if (!clave) return;
        if (mapa.has(clave)) mapa.delete(clave);
        mapa.set(clave, valor);
        while (mapa.size > maxItems) {
            const primeraClave = mapa.keys().next().value;
            if (primeraClave === undefined) break;
            mapa.delete(primeraClave);
        }
    }

    function verificarCancelacion() {
        if (estado.cancelado) {
            const err = new Error('Descarga detenida por el usuario');
            err.esCancelacion = true;
            throw err;
        }
    }

    // --- Módulo 2: Utilidades de texto, DOM, tiempos ETA, JSON y enlace con MAIN ---

    // Funciones de texto, DOM, tiempos ETA, parseo JSON y comunicación con el mundo MAIN.


    const dormir = ms => new Promise(resolve => setTimeout(resolve, ms));

    function crearElemento(tag, props = {}, hijos = []) {
        const nodo = document.createElement(tag);
        for (const [k, v] of Object.entries(props)) {
            if (v === undefined || v === null) continue;
            if (k === 'className') {
                nodo.className = v;
            } else if (k === 'textContent') {
                nodo.textContent = v;
            } else if (k === 'hidden') {
                nodo.hidden = Boolean(v);
            } else if (k === 'dataset' && typeof v === 'object') {
                for (const [dk, dv] of Object.entries(v)) {
                    nodo.dataset[dk] = dv;
                }
            } else {
                nodo.setAttribute(k, String(v));
            }
        }
        for (const hijo of hijos) {
            if (hijo == null) continue;
            if (typeof hijo === 'string') {
                nodo.appendChild(document.createTextNode(hijo));
            } else {
                nodo.appendChild(hijo);
            }
        }
        return nodo;
    }

    const texto = value =>
        String(value ?? '')
            .replace(/[\u200b-\u200d\ufeff\u00a0]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

    const canon = value => texto(value).toLocaleLowerCase('es');

    const seguro = (value, defecto = 'Sin titulo') => {
        const nombre = texto(value)
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/[. ]+$/g, '')
            .slice(0, 140);

        return nombre || defecto;
    };

    const clonarBytes = src => {
        if (!src) return new Uint8Array(0);
        const vista = src instanceof Uint8Array ? src : new Uint8Array(src);
        const limpio = new Uint8Array(vista.byteLength);
        limpio.set(vista);
        return limpio;
    };

    function descargarBlob(bytes, nombreArchivo, mimeType = 'text/plain;charset=utf-8') {
        const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivo;
        a.rel = 'noopener';
        a.style.display = 'none';
        a.addEventListener('click', e => e.stopPropagation());
        (document.body || document.documentElement).appendChild(a);
        a.click();
        setTimeout(() => {
            a.remove();
            URL.revokeObjectURL(url);
        }, 10000);
    }

    async function copiarAlPortapapeles(contenido) {
        if (typeof GM_setClipboard === 'function') {
            GM_setClipboard(contenido, 'text');
            return;
        }
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(contenido);
                return;
            }
        } catch {
            // Fallback clásico si el documento no tiene foco o falta permiso del portapapeles.
        }
        const area = document.createElement('textarea');
        area.value = contenido;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
    }

    function formatearTiempoRestante(segundosTotales) {
        if (!Number.isFinite(segundosTotales) || segundosTotales <= 0) return 'calculando...';
        const seg = Math.round(segundosTotales);
        const d = Math.floor(seg / 86400);
        const h = Math.floor((seg % 86400) / 3600);
        const m = Math.floor((seg % 3600) / 60);
        const s = seg % 60;

        if (d > 0) return `${d} d ${h} h`;
        if (h > 0) return `${h} h ${m} m`;
        if (m > 0) return `${m} m ${s} s`;
        return `${s} s`;
    }

    function calcularEta(procesados, total, tiempoInicioMs) {
        if (procesados < 2 || total <= procesados) return '';
        const segundosTranscurridos = (Date.now() - tiempoInicioMs) / 1000;
        if (segundosTranscurridos < 2) return '';
        const velocidad = procesados / segundosTranscurridos;
        if (velocidad <= 0) return '';
        const segundosRestantes = (total - procesados) / velocidad;
        return formatearTiempoRestante(segundosRestantes);
    }

    function extraerJsonBalanceadoDesdeIndice(str, idxInicioLlave) {
        if (idxInicioLlave === -1 || idxInicioLlave >= str.length) return null;
        const inicio = str.indexOf('{', idxInicioLlave);
        if (inicio === -1) return null;

        let nivel = 0;
        let enString = false;
        let escape = false;

        for (let i = inicio; i < str.length; i++) {
            const ch = str[i];

            if (escape) {
                escape = false;
                continue;
            }
            if (ch === '\\' && enString) {
                escape = true;
                continue;
            }
            if (ch === '"') {
                enString = !enString;
                continue;
            }
            if (!enString) {
                if (ch === '{') {
                    nivel++;
                } else if (ch === '}') {
                    nivel--;
                    if (nivel === 0) {
                        try {
                            return JSON.parse(str.slice(inicio, i + 1));
                        } catch {
                            return null;
                        }
                    }
                }
            }
        }
        return null;
    }

    function extraerJsonBalanceado(html, marcador) {
        const idx = html.indexOf(marcador);
        if (idx === -1) return null;
        return extraerJsonBalanceadoDesdeIndice(html, idx + marcador.length);
    }

    function extraerYtInitialDataDeHtml(html) {
        return (
            extraerJsonBalanceado(html, 'var ytInitialData =') ||
            extraerJsonBalanceado(html, 'window["ytInitialData"] =') ||
            extraerJsonBalanceado(html, 'ytInitialData =')
        );
    }

    // Consulta al mundo MAIN mediante eventos síncronos del DOM cuando el script corre aislado (extensión MV3).
    function solicitarEstadoPaginaMain(accion, extra = {}) {
        if (typeof window === 'undefined' || !document.documentElement) return null;
        const reqId = `c2t_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        let respuesta = null;

        const onRes = ev => {
            try {
                respuesta = ev.detail ? JSON.parse(ev.detail) : null;
            } catch {
                respuesta = null;
            }
        };

        window.addEventListener(`chan2txt-res-${reqId}`, onRes, { once: true });
        window.dispatchEvent(
            new CustomEvent('chan2txt-req', {
                detail: JSON.stringify({ reqId, accion, ...extra })
            })
        );
        window.removeEventListener(`chan2txt-res-${reqId}`, onRes);
        return respuesta;
    }

    // Lee ytInitialData, ytcfg y #movie_player; compatible con Tampermonkey y MV3.
    function obtenerSnapshotPagina(videoId = '') {
        const { win } = estado;

        if (win?.ytcfg || win?.ytInitialData || win?.ytInitialPlayerResponse) {
            const player = win.document?.getElementById('movie_player');
            const pr = player?.getPlayerResponse?.() || win.ytInitialPlayerResponse || null;
            const initData = win.ytInitialData || null;
            return {
                ytcfg: {
                    apiKey: win.ytcfg?.get?.('INNERTUBE_API_KEY') ?? win.ytcfg?.data_?.INNERTUBE_API_KEY ?? '',
                    clientVersion:
                        win.ytcfg?.get?.('INNERTUBE_CLIENT_VERSION') ??
                        win.ytcfg?.data_?.INNERTUBE_CLIENT_VERSION ??
                        win.ytcfg?.get?.('INNERTUBE_CONTEXT')?.client?.clientVersion ??
                        '2.20260401.01.00',
                    clientName:
                        win.ytcfg?.get?.('INNERTUBE_CONTEXT_CLIENT_NAME') ??
                        win.ytcfg?.data_?.INNERTUBE_CONTEXT_CLIENT_NAME ??
                        1,
                    visitorData:
                        win.ytcfg?.get?.('VISITOR_DATA') ??
                        win.ytcfg?.data_?.VISITOR_DATA ??
                        win.ytcfg?.get?.('INNERTUBE_CONTEXT')?.client?.visitorData ??
                        '',
                    sessionIndex: String(
                        win.ytcfg?.get?.('SESSION_INDEX') ?? win.ytcfg?.data_?.SESSION_INDEX ?? '0'
                    ),
                    delegatedSessionId:
                        win.ytcfg?.get?.('DELEGATED_SESSION_ID') ??
                        win.ytcfg?.data_?.DELEGATED_SESSION_ID ??
                        '',
                    sts: win.ytcfg?.get?.('STS') ?? win.ytcfg?.data_?.STS ?? null,
                    channelId: win.ytcfg?.get?.('CHANNEL_ID') ?? win.ytcfg?.data_?.CHANNEL_ID ?? '',
                    fullContext: win.ytcfg?.get?.('INNERTUBE_CONTEXT') ?? win.ytcfg?.data_?.INNERTUBE_CONTEXT ?? null
                },
                pr,
                initData
            };
        }

        return solicitarEstadoPaginaMain('GET_SNAPSHOT', { videoId });
    }

    function activarSubtitulosMoviePlayer(silenciar = false) {
        const playerDirecto = estado.win?.document?.getElementById('movie_player');
        if (playerDirecto && typeof playerDirecto.getPlayerResponse === 'function') {
            try {
                if (silenciar) playerDirecto.mute?.();
                playerDirecto.loadModule?.('captions');
                playerDirecto.loadModule?.('cc');
                const tracklist = playerDirecto.getOption?.('captions', 'tracklist') || [];
                const trackEsp = tracklist.find(t => /^es/i.test(t.languageCode)) || tracklist[0];
                if (trackEsp) {
                    playerDirecto.setOption?.('captions', 'track', trackEsp);
                }
                return { tracklist };
            } catch {
                return { tracklist: [] };
            }
        }

        return solicitarEstadoPaginaMain('ACTIVATE_CAPTIONS', { silenciar }) || { tracklist: [] };
    }

    // --- Módulo 3: Generador ZIP nativo (STORE + CRC32) y árbol ASCII ---

    // Empaquetado ZIP sin compresión (STORE + CRC32) y mapa ASCII de archivos.


    function generarMapaArbol(raizNombre, listaArchivos) {
        const raiz = { hijos: new Map(), archivos: [] };

        for (const item of listaArchivos) {
            const partes = String(item.ruta)
                .replace(/\\/g, '/')
                .split('/')
                .filter(Boolean);

            if (partes[0] && canon(partes[0]) === canon(raizNombre)) {
                partes.shift();
            }

            let actual = raiz;
            for (let i = 0; i < partes.length - 1; i++) {
                const dir = partes[i];
                if (!actual.hijos.has(dir)) {
                    actual.hijos.set(dir, { nombre: dir, hijos: new Map(), archivos: [] });
                }
                actual = actual.hijos.get(dir);
            }

            const archivo = partes.at(-1) || 'Archivo.txt';
            actual.archivos.push({
                nombre: archivo,
                comentario: item.comentario || ''
            });
        }

        const lineas = [`${raizNombre}/`];

        const recorrer = (nodo, prefijo) => {
            const carpetas = [...nodo.hijos.values()];
            const archivos = nodo.archivos;
            const entradas = [
                ...carpetas.map(c => ({ tipo: 'dir', datos: c })),
                ...archivos.map(a => ({ tipo: 'file', datos: a }))
            ];

            entradas.forEach((entrada, idx) => {
                const esUltimo = idx === entradas.length - 1;
                const conector = esUltimo ? '└── ' : '├── ';
                const subPrefijo = prefijo + (esUltimo ? '    ' : '│   ');

                if (entrada.tipo === 'dir') {
                    lineas.push(`${prefijo}${conector}${entrada.datos.nombre}/`);
                    recorrer(entrada.datos, subPrefijo);
                } else {
                    const izq = `${prefijo}${conector}${entrada.datos.nombre}`;
                    if (entrada.datos.comentario) {
                        const relleno = ' '.repeat(Math.max(2, 64 - izq.length));
                        lineas.push(`${izq}${relleno}# ${entrada.datos.comentario}`);
                    } else {
                        lineas.push(izq);
                    }
                }
            });
        };

        recorrer(raiz, '');
        return lineas.join('\r\n');
    }

    const CRC_TABLA = (() => {
        const tabla = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            tabla[i] = c >>> 0;
        }
        return tabla;
    })();

    function calcularCrc32(bytes) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.byteLength; i++) {
            crc = CRC_TABLA[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function crearZipNativo() {
        const archivos = new Map();

        return {
            tiene(ruta) {
                return archivos.has(ruta.toLowerCase());
            },
            agregar(ruta, contenido) {
                const limpia = String(ruta)
                    .replace(/\\/g, '/')
                    .replace(/\/+/g, '/')
                    .replace(/^\/|\/$/g, '');

                const bytes =
                    typeof contenido === 'string'
                        ? new TextEncoder().encode(contenido)
                        : clonarBytes(contenido);

                archivos.set(limpia.toLowerCase(), {
                    ruta: limpia,
                    bytes
                });
            },
            limpiarMemoria() {
                archivos.clear();
            },
            generarBlob() {
                const encoder = new TextEncoder();
                const ahora = new Date();
                const anio = Math.max(1980, ahora.getFullYear());
                const fechaDos = ((anio - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();
                const horaDos = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);

                const partesLocales = [];
                const partesCentrales = [];
                let offsetLocal = 0;
                let tamanoCentral = 0;
                let total = 0;

                for (const item of archivos.values()) {
                    const nombreBytes = encoder.encode(item.ruta);
                    const datos = item.bytes;
                    const tamano = datos.byteLength >>> 0;
                    const crc = calcularCrc32(datos);

                    const localBuf = new ArrayBuffer(30);
                    const localView = new DataView(localBuf);
                    localView.setUint32(0, 0x04034b50, true);
                    localView.setUint16(4, 20, true);
                    localView.setUint16(6, 0x0800, true);
                    localView.setUint16(8, 0, true);
                    localView.setUint16(10, horaDos, true);
                    localView.setUint16(12, fechaDos, true);
                    localView.setUint32(14, crc, true);
                    localView.setUint32(18, tamano, true);
                    localView.setUint32(22, tamano, true);
                    localView.setUint16(26, nombreBytes.byteLength, true);
                    localView.setUint16(28, 0, true);

                    partesLocales.push(new Uint8Array(localBuf), nombreBytes, datos);

                    const centralBuf = new ArrayBuffer(46);
                    const centralView = new DataView(centralBuf);
                    centralView.setUint32(0, 0x02014b50, true);
                    centralView.setUint16(4, 20, true);
                    centralView.setUint16(6, 20, true);
                    centralView.setUint16(8, 0x0800, true);
                    centralView.setUint16(10, 0, true);
                    centralView.setUint16(12, horaDos, true);
                    centralView.setUint16(14, fechaDos, true);
                    centralView.setUint32(16, crc, true);
                    centralView.setUint32(20, tamano, true);
                    centralView.setUint32(24, tamano, true);
                    centralView.setUint16(28, nombreBytes.byteLength, true);
                    centralView.setUint16(30, 0, true);
                    centralView.setUint16(32, 0, true);
                    centralView.setUint16(34, 0, true);
                    centralView.setUint16(36, 0, true);
                    centralView.setUint32(38, 0, true);
                    centralView.setUint32(42, offsetLocal, true);

                    partesCentrales.push(new Uint8Array(centralBuf), nombreBytes);

                    offsetLocal += 30 + nombreBytes.byteLength + tamano;
                    tamanoCentral += 46 + nombreBytes.byteLength;
                    total++;
                }

                const eocdBuf = new ArrayBuffer(22);
                const eocdView = new DataView(eocdBuf);
                eocdView.setUint32(0, 0x06054b50, true);
                eocdView.setUint16(4, 0, true);
                eocdView.setUint16(6, 0, true);
                eocdView.setUint16(8, total, true);
                eocdView.setUint16(10, total, true);
                eocdView.setUint32(12, tamanoCentral, true);
                eocdView.setUint32(16, offsetLocal, true);
                eocdView.setUint16(20, 0, true);

                const blob = new Blob(
                    [...partesLocales, ...partesCentrales, new Uint8Array(eocdBuf)],
                    { type: 'application/zip' }
                );

                partesLocales.length = 0;
                partesCentrales.length = 0;
                archivos.clear();

                return blob;
            }
        };
    }

    function rutaLibre(zip, baseRuta, nombreArchivo) {
        const construir = n => (baseRuta ? `${baseRuta}/${n}` : n);
        const candidato = construir(nombreArchivo);

        if (!zip.tiene(candidato)) return candidato;

        const i = nombreArchivo.lastIndexOf('.');
        const base = i > 0 ? nombreArchivo.slice(0, i) : nombreArchivo;
        const ext = i > 0 ? nombreArchivo.slice(i) : '';

        let k = 2;
        while (zip.tiene(construir(`${base} (${k})${ext}`))) {
            k++;
        }

        return construir(`${base} (${k})${ext}`);
    }

    function guardarZip(pc) {
        if (!pc?.zipBlob) return;

        if (!pc.zipUrl) {
            pc.zipUrl = URL.createObjectURL(pc.zipBlob);
        }

        const a = document.createElement('a');
        a.href = pc.zipUrl;
        a.download = pc.zipNombre;
        a.rel = 'noopener';
        a.style.display = 'none';
        a.addEventListener('click', e => e.stopPropagation());

        (document.body || document.documentElement).appendChild(a);
        a.click();

        setTimeout(() => a.remove(), 10000);
    }

    // --- Módulo 4: Interceptación en vivo de PO Token, timedtext y mensajes ---

    // Captura en vivo de parámetros PO Token, respuestas timedtext y mensajes entre ventanas.


    let receptorMensajesRegistrado = false;

    function recordarPotDeTimedtextUrl(rawUrl) {
        try {
            if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.includes('/api/timedtext')) return;
            const u = new URL(rawUrl, 'https://www.youtube.com');
            const videoId = u.searchParams.get('v');
            const pot = u.searchParams.get('pot');
            if (!pot) return;

            const collected = {};
            for (const name of POT_CARRIED_PARAM_NAMES) {
                const val = u.searchParams.get(name);
                if (val !== null && val !== '') collected[name] = val;
            }
            estado.potLatestParams = collected;
            if (videoId) {
                guardarEnMapaConLimite(estado.potParamsByVideoId, videoId, collected, 80);
            }
            if (estado.esIframeTrabajador && window.parent && window.parent !== window) {
                try {
                    window.parent.postMessage(
                        {
                            type: 'MAXIMUS_POT_CAPTURED',
                            videoId,
                            potParams: collected
                        },
                        '*'
                    );
                } catch {
                    // La ventana padre pudo cerrarse durante la navegación.
                }
            }
        } catch {
            // URL malformada o relativa sin base válida.
        }
    }

    function recordarCuerpoSubtitulo(rawUrl, bodyText) {
        try {
            if (!rawUrl || typeof rawUrl !== 'string') return;
            if (typeof bodyText !== 'string' || bodyText.trim().length < 15 || bodyText.length > 2500000) return;

            if (rawUrl.includes('/api/timedtext')) {
                const u = new URL(rawUrl, 'https://www.youtube.com');
                const videoId = u.searchParams.get('v');
                if (videoId) {
                    guardarEnMapaConLimite(estado.subtitulosCachePorVideoId, videoId, bodyText, 50);
                    if (estado.esIframeTrabajador && window.parent && window.parent !== window) {
                        try {
                            window.parent.postMessage(
                                {
                                    type: 'MAXIMUS_SUBTITLE_CAPTURED',
                                    videoId,
                                    rawPayload: bodyText
                                },
                                '*'
                            );
                        } catch {
                            // Ignorar si el padre ya descartó el iframe.
                        }
                    }
                }
            } else if (rawUrl.includes('/youtubei/v1/get_transcript')) {
                const vidActual = new URLSearchParams(location.search).get('v') || '';
                if (
                    vidActual &&
                    (bodyText.includes('transcriptSegment') || bodyText.includes('macroMarkersPanelItem'))
                ) {
                    guardarEnMapaConLimite(estado.transcriptJsonPorVideoId, vidActual, bodyText, 50);
                    if (estado.esIframeTrabajador && window.parent && window.parent !== window) {
                        try {
                            window.parent.postMessage(
                                {
                                    type: 'MAXIMUS_TRANSCRIPT_JSON_CAPTURED',
                                    videoId: vidActual,
                                    rawTranscriptJson: bodyText
                                },
                                '*'
                            );
                        } catch {
                            // Ignorar si el padre ya descartó el iframe.
                        }
                    }
                }
            }
        } catch {
            // Ignorar errores de lectura de URL.
        }
    }

    // En Tampermonkey parcha fetch/XHR directamente; en extensión MV3 page-hook.js ya hace lo mismo en MAIN.
    function instalarHooksPotUnaVez() {
        if (estado.potHooksInstalled) return;
        if (document.documentElement?.dataset?.chan2txtPageHook === '1') {
            estado.potHooksInstalled = true;
            return;
        }

        const { win } = estado;
        if (!win) return;

        try {
            const origFetch = win.fetch;
            if (typeof origFetch === 'function') {
                win.fetch = function (...args) {
                    try {
                        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
                        if (
                            url &&
                            typeof url === 'string' &&
                            (url.includes('/api/timedtext') || url.includes('/youtubei/v1/get_transcript'))
                        ) {
                            if (url.includes('/api/timedtext')) recordarPotDeTimedtextUrl(url);
                            const p = origFetch.apply(this, args);
                            p.then(res => {
                                if (res && res.ok) {
                                    res
                                        .clone()
                                        .text()
                                        .then(b => recordarCuerpoSubtitulo(url, b))
                                        .catch(() => {});
                                }
                            }).catch(() => {});
                            return p;
                        }
                    } catch {
                        // Continuar con el fetch original.
                    }
                    return origFetch.apply(this, args);
                };
            }

            const xhrProto = win.XMLHttpRequest?.prototype;
            if (xhrProto && typeof xhrProto.open === 'function') {
                const origOpen = xhrProto.open;
                xhrProto.open = function (...args) {
                    try {
                        const url = args[1];
                        if (
                            url &&
                            typeof url === 'string' &&
                            (url.includes('/api/timedtext') || url.includes('/youtubei/v1/get_transcript'))
                        ) {
                            if (url.includes('/api/timedtext')) recordarPotDeTimedtextUrl(url);
                            this.addEventListener(
                                'loadend',
                                function () {
                                    try {
                                        if (this.status === 200 && typeof this.responseText === 'string') {
                                            recordarCuerpoSubtitulo(url, this.responseText);
                                        }
                                    } catch {
                                        // Ignorar respuestas binarias o no legibles.
                                    }
                                },
                                { once: true }
                            );
                        }
                    } catch {
                        // No bloquear peticiones XHR de YouTube.
                    }
                    return origOpen.apply(this, args);
                };
            }
            estado.potHooksInstalled = true;
        } catch {
            // Entornos restringidos sin acceso a prototipos de ventana.
        }
    }

    function registrarReceptorMensajesVentana() {
        if (receptorMensajesRegistrado || typeof window === 'undefined') return;
        receptorMensajesRegistrado = true;

        window.addEventListener('message', ev => {
            try {
                const d = ev.data;
                if (!d || typeof d !== 'object') return;

                if (d.type === 'MAXIMUS_POT_CAPTURED' && d.potParams) {
                    estado.potLatestParams = d.potParams;
                    if (d.videoId) {
                        guardarEnMapaConLimite(estado.potParamsByVideoId, d.videoId, d.potParams, 80);
                    }
                }

                if (d.type === 'MAXIMUS_SUBTITLE_CAPTURED' && d.videoId && d.rawPayload) {
                    guardarEnMapaConLimite(estado.subtitulosCachePorVideoId, d.videoId, d.rawPayload, 50);
                }

                if (d.type === 'MAXIMUS_TRANSCRIPT_JSON_CAPTURED' && d.videoId && d.rawTranscriptJson) {
                    guardarEnMapaConLimite(estado.transcriptJsonPorVideoId, d.videoId, d.rawTranscriptJson, 50);
                }

                if (d.type === 'MAXIMUS_WORKER_DONE' && d.videoId) {
                    if (d.potParams) {
                        estado.potLatestParams = d.potParams;
                        guardarEnMapaConLimite(estado.potParamsByVideoId, d.videoId, d.potParams, 80);
                    }
                    if (d.rawTimedtextPayload) {
                        guardarEnMapaConLimite(estado.subtitulosCachePorVideoId, d.videoId, d.rawTimedtextPayload, 50);
                    }
                    if (d.rawTranscriptJson) {
                        guardarEnMapaConLimite(estado.transcriptJsonPorVideoId, d.videoId, d.rawTranscriptJson, 50);
                    }
                    const resolver = estado.callbacksWorkersIframe.get(d.videoId);
                    if (resolver) {
                        estado.callbacksWorkersIframe.delete(d.videoId);
                        resolver(d);
                    }
                }
            } catch {
                // Ignorar mensajes externos de otros scripts en la página.
            }
        });
    }

    // --- Módulo 5: Pool de iframes trabajadores (/watch?v=ID&maximus_worker=1) ---

    // Pool de iframes ocultos /watch?v=ID&maximus_worker=1 para extraer pistas y transcripciones reales del DOM.


    function silenciarBuffersDeVideo() {
        try {
            const vids = document.getElementsByTagName('video');
            for (let i = 0; i < vids.length; i++) {
                const v = vids[i];
                v.muted = true;
                v.volume = 0;
            }
        } catch {
            // Algunos reproductores bloquean propiedades multimedia hasta que cargan metadatos.
        }
    }

    function buscarParamTranscriptEnObjeto(raiz) {
        if (!raiz) return '';
        try {
            const str = typeof raiz === 'string' ? raiz : JSON.stringify(raiz);
            const m = str.match(/"getTranscriptEndpoint"\s*:\s*\{\s*"params"\s*:\s*"([^"]+)"/);
            return m?.[1] || '';
        } catch {
            return '';
        }
    }

    async function ejecutarAgenteIframeTrabajador() {
        const paramsUrl = new URLSearchParams(location.search);
        const workerVideoId = paramsUrl.get('v') || '';

        const correr = async () => {
            const inicio = Date.now();
            let snapshot = null;
            let pr = null;
            let initData = null;

            while (Date.now() - inicio < 10000) {
                silenciarBuffersDeVideo();
                snapshot = obtenerSnapshotPagina(workerVideoId);
                pr = snapshot?.pr || null;
                initData = snapshot?.initData || null;

                if (pr && (pr.videoDetails?.videoId === workerVideoId || pr.captions || pr.playabilityStatus)) {
                    break;
                }
                await dormir(150);
            }

            silenciarBuffersDeVideo();

            const titulo = pr?.videoDetails?.title || '';
            const mf = pr?.microformat?.playerMicroformatRenderer;
            const fecha = (mf?.publishDate || mf?.uploadDate || '').slice(0, 10) || '0000-00-00';
            const playabilityStatus = pr?.playabilityStatus?.status || 'OK';

            let pistas =
                pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks ||
                pr?.captions?.playerCaptionsRenderer?.captionTracks ||
                [];

            const transcriptParams = buscarParamTranscriptEnObjeto(initData);
            const fetchFn = estado.win?.fetch || window.fetch;

            // 1. Si hay transcriptParams en ytInitialData, consultar get_transcript desde el contexto first-party del iframe.
            if (transcriptParams && typeof fetchFn === 'function') {
                try {
                    const ytcfg = snapshot?.ytcfg || {};
                    const apiKey = ytcfg.apiKey || '';
                    const ctx = ytcfg.fullContext || {
                        client: {
                            clientName: 'WEB',
                            clientVersion: ytcfg.clientVersion || '2.20260401.01.00',
                            hl: 'es'
                        }
                    };
                    const visitorData = ytcfg.visitorData || ctx?.client?.visitorData || '';
                    const headersTr = {
                        'Content-Type': 'application/json',
                        'X-Youtube-Client-Name': String(ytcfg.clientName || 1),
                        'X-Youtube-Client-Version': String(ytcfg.clientVersion || '2.20260401.01.00')
                    };
                    if (visitorData) headersTr['X-Goog-Visitor-Id'] = visitorData;

                    const resTr = await fetchFn.call(
                        estado.win || window,
                        `https://www.youtube.com/youtubei/v1/get_transcript?prettyPrint=false${apiKey ? `&key=${apiKey}` : ''}`,
                        {
                            method: 'POST',
                            credentials: 'include',
                            headers: headersTr,
                            body: JSON.stringify({
                                context: ctx,
                                params: transcriptParams
                            })
                        }
                    );
                    if (resTr.ok) {
                        const jsonTr = await resTr.text();
                        if (
                            jsonTr &&
                            (jsonTr.includes('transcriptSegment') || jsonTr.includes('macroMarkersPanelItem'))
                        ) {
                            window.parent.postMessage(
                                {
                                    type: 'MAXIMUS_WORKER_DONE',
                                    videoId: workerVideoId,
                                    noTieneSubtitulos: false,
                                    titulo,
                                    fecha,
                                    pistas,
                                    rawTranscriptJson: jsonTr
                                },
                                '*'
                            );
                            return;
                        }
                    }
                } catch {
                    // Continuar con activación de subtítulos en el reproductor si get_transcript falla.
                }
            }

            // 2. Activar subtítulos y abrir panel de transcripción en el DOM del iframe.
            try {
                const resPlayer = activarSubtitulosMoviePlayer(true);
                if (Array.isArray(resPlayer?.tracklist) && resPlayer.tracklist.length > 0 && pistas.length === 0) {
                    pistas = resPlayer.tracklist;
                }
                const btnCc = document.querySelector('.ytp-subtitles-button[aria-pressed="false"]');
                if (btnCc) btnCc.click();

                const btnTranscriptDom = document.querySelector(
                    'ytd-video-description-transcript-section-renderer button, button[aria-label*="transcripci" i], button[aria-label*="transcript" i]'
                );
                if (btnTranscriptDom) btnTranscriptDom.click();
            } catch {
                // Seguir esperando captura por si el reproductor cargó los subtítulos automáticamente.
            }

            // 3. Esperar hasta 3.8s captura de red (get_transcript o timedtext con PO Token) o nodos en el DOM.
            const esperaCache = Date.now();
            while (Date.now() - esperaCache < 3800) {
                silenciarBuffersDeVideo();

                if (estado.transcriptJsonPorVideoId.has(workerVideoId)) {
                    window.parent.postMessage(
                        {
                            type: 'MAXIMUS_WORKER_DONE',
                            videoId: workerVideoId,
                            noTieneSubtitulos: false,
                            titulo,
                            fecha,
                            pistas,
                            rawTranscriptJson: estado.transcriptJsonPorVideoId.get(workerVideoId),
                            potParams: estado.potParamsByVideoId.get(workerVideoId) || estado.potLatestParams
                        },
                        '*'
                    );
                    return;
                }

                if (estado.subtitulosCachePorVideoId.has(workerVideoId)) {
                    window.parent.postMessage(
                        {
                            type: 'MAXIMUS_WORKER_DONE',
                            videoId: workerVideoId,
                            noTieneSubtitulos: false,
                            titulo,
                            fecha,
                            pistas,
                            rawTimedtextPayload: estado.subtitulosCachePorVideoId.get(workerVideoId),
                            potParams: estado.potParamsByVideoId.get(workerVideoId) || estado.potLatestParams
                        },
                        '*'
                    );
                    return;
                }

                const segsDom = document.querySelectorAll('ytd-transcript-segment-renderer, transcript-segment-view-model');
                if (segsDom.length > 0) {
                    const domCues = [];
                    segsDom.forEach(nodo => {
                        const tTxt = nodo.querySelector('.segment-timestamp, [class*="timestamp"]')?.textContent?.trim() || '0:00';
                        const bTxt =
                            nodo.querySelector('.segment-text, yt-formatted-string, [class*="segment-text"]')?.textContent?.trim() ||
                            '';
                        if (bTxt) domCues.push({ tTxt, bTxt });
                    });
                    if (domCues.length > 0) {
                        window.parent.postMessage(
                            {
                                type: 'MAXIMUS_WORKER_DONE',
                                videoId: workerVideoId,
                                noTieneSubtitulos: false,
                                titulo,
                                fecha,
                                pistas,
                                domTranscriptCues: domCues
                            },
                            '*'
                        );
                        return;
                    }
                }

                await dormir(140);
            }

            if (pistas.length === 0) {
                const snapTardio = obtenerSnapshotPagina(workerVideoId);
                const prLate = snapTardio?.pr;
                pistas =
                    prLate?.captions?.playerCaptionsTracklistRenderer?.captionTracks ||
                    prLate?.captions?.playerCaptionsRenderer?.captionTracks ||
                    [];
            }

            if (pistas.length === 0 && !transcriptParams) {
                window.parent.postMessage(
                    {
                        type: 'MAXIMUS_WORKER_DONE',
                        videoId: workerVideoId,
                        noTieneSubtitulos: true,
                        titulo,
                        fecha,
                        playabilityStatus
                    },
                    '*'
                );
                return;
            }

            // 4. Descargar la pista directamente desde la sesión del iframe.
            const esEspanol = code => /^es(?:-|$)/i.test(String(code || ''));
            const elegida =
                pistas.find(t => esEspanol(t.languageCode) && t.kind !== 'asr') ||
                pistas.find(t => esEspanol(t.languageCode) && t.kind === 'asr') ||
                pistas.find(t => t.kind !== 'asr') ||
                pistas[0];

            if (elegida?.baseUrl && typeof fetchFn === 'function') {
                let urlPista = elegida.baseUrl.replace(/\\u0026/g, '&');
                if (!esEspanol(elegida.languageCode)) {
                    urlPista += (urlPista.includes('?') ? '&' : '?') + 'tlang=es';
                }
                const pot = estado.potParamsByVideoId.get(workerVideoId) || estado.potLatestParams;
                if (pot) {
                    for (const [k, v] of Object.entries(pot)) {
                        if (!urlPista.includes(`${k}=`)) {
                            urlPista += `&${k}=${encodeURIComponent(v)}`;
                        }
                    }
                }
                for (const sufijo of ['', '&fmt=json3', '&fmt=srv1', '&fmt=vtt']) {
                    try {
                        const r = await fetchFn.call(estado.win || window, urlPista + sufijo, { credentials: 'include' });
                        if (r.ok) {
                            const txt = await r.text();
                            if (txt && txt.trim().length > 20 && !txt.includes('<!DOCTYPE')) {
                                window.parent.postMessage(
                                    {
                                        type: 'MAXIMUS_WORKER_DONE',
                                        videoId: workerVideoId,
                                        noTieneSubtitulos: false,
                                        titulo,
                                        fecha,
                                        pistas,
                                        pistaElegida: elegida,
                                        rawTimedtextPayload: txt,
                                        potParams: pot
                                    },
                                    '*'
                                );
                                return;
                            }
                        }
                    } catch {
                        // Probar el siguiente formato de salida.
                    }
                }
            }

            window.parent.postMessage(
                {
                    type: 'MAXIMUS_WORKER_DONE',
                    videoId: workerVideoId,
                    noTieneSubtitulos: false,
                    titulo,
                    fecha,
                    pistas,
                    transcriptParams,
                    potParams: estado.potParamsByVideoId.get(workerVideoId) || estado.potLatestParams
                },
                '*'
            );
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', correr, { once: true });
        } else {
            correr();
        }
    }

    function destruirIframeSeguro(iframe) {
        if (!iframe) return;
        estado.iframesActivosSet.delete(iframe);
        try {
            if (iframe.contentWindow) {
                try {
                    const vids = iframe.contentDocument?.getElementsByTagName?.('video');
                    if (vids) {
                        for (let i = 0; i < vids.length; i++) {
                            vids[i].pause?.();
                            vids[i].removeAttribute?.('src');
                            vids[i].load?.();
                        }
                    }
                } catch {
                    // Ignorar si el documento interno ya se descargó.
                }
                try {
                    iframe.contentWindow.stop?.();
                } catch {
                    // Ignorar si el navegador ya detuvo la carga.
                }
            }
            iframe.src = 'about:blank';
            if (iframe.contentDocument?.body) {
                iframe.contentDocument.body.textContent = '';
            }
        } catch {
            // Ignorar errores al limpiar iframes desconectados.
        }
        setTimeout(() => {
            try {
                iframe.remove();
            } catch {
                // El nodo pudo haber salido antes del DOM.
            }
        }, 40);
    }

    function limpiarTodosLosIframesTrabajadores() {
        for (const iframe of estado.iframesActivosSet) {
            destruirIframeSeguro(iframe);
        }
        estado.iframesActivosSet.clear();
        for (const [, res] of estado.callbacksWorkersIframe) {
            try {
                res(null);
            } catch {
                // Resolver en curso ya liberado.
            }
        }
        estado.callbacksWorkersIframe.clear();
        estado.iframesEnCurso = 0;
    }

    async function extraerMedianteIframeWatchReal(videoId, timeoutMs = CFG.TIMEOUT_IFRAME) {
        verificarCancelacion();

        while (estado.iframesEnCurso >= CFG.MAX_IFRAMES_SIMULTANEOS) {
            verificarCancelacion();
            await dormir(120);
        }

        estado.iframesEnCurso++;

        return new Promise(resolve => {
            let finalizado = false;
            let iframe = null;
            let timer = null;

            const terminar = resultado => {
                if (finalizado) return;
                finalizado = true;
                clearTimeout(timer);
                estado.callbacksWorkersIframe.delete(videoId);
                estado.iframesEnCurso = Math.max(0, estado.iframesEnCurso - 1);
                destruirIframeSeguro(iframe);
                resolve(resultado);
            };

            estado.callbacksWorkersIframe.set(videoId, datos => {
                terminar(datos);
            });

            timer = setTimeout(() => {
                terminar(null);
            }, timeoutMs);

            try {
                iframe = document.createElement('iframe');
                iframe.style.cssText =
                    'position:fixed;bottom:4px;right:4px;width:240px;height:135px;opacity:0.01;z-index:-9999;pointer-events:none;border:0;';
                iframe.setAttribute('aria-hidden', 'true');
                iframe.allow = 'autoplay';
                iframe.src = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=es&cc_load_policy=1&maximus_worker=1`;
                estado.iframesActivosSet.add(iframe);
                (document.body || document.documentElement).appendChild(iframe);
            } catch {
                terminar(null);
            }
        });
    }

    // --- Módulo 6: Transporte HTTP, autenticación SAPISIDHASH y control de reCAPTCHA ---

    // Peticiones HTTP (fetch, puente de extensión y GM_xmlhttpRequest), autenticación SAPISIDHASH y pausa ante reCAPTCHA.


    function leerCookie(nombre) {
        const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + nombre + '=([^;]*)'));
        return m ? decodeURIComponent(m[1]) : '';
    }

    async function calcularSapisidHash(origin = 'https://www.youtube.com') {
        try {
            const sapisid = leerCookie('SAPISID') || leerCookie('__Secure-3PAPISID');
            if (!sapisid || !crypto?.subtle) return null;
            const ts = Math.floor(Date.now() / 1000);
            const msg = new TextEncoder().encode(`${ts} ${sapisid} ${origin}`);
            const hashBuf = await crypto.subtle.digest('SHA-1', msg);
            const hashHex = Array.from(new Uint8Array(hashBuf))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            return `SAPISIDHASH ${ts}_${hashHex} SAPISID1PHASH ${ts}_${hashHex} SAPISID3PHASH ${ts}_${hashHex}`;
        } catch {
            return null;
        }
    }

    function obtenerConfigYtcfg() {
        const snap = obtenerSnapshotPagina();
        const ytcfg = snap?.ytcfg || {};
        const ctx = ytcfg.fullContext || null;

        return {
            apiKey: ytcfg.apiKey || '',
            clientVersion: ytcfg.clientVersion || ctx?.client?.clientVersion || '2.20260401.01.00',
            clientName: ytcfg.clientName || 1,
            visitorData: ytcfg.visitorData || ctx?.client?.visitorData || '',
            sessionIndex: String(ytcfg.sessionIndex ?? '0'),
            delegatedSessionId: ytcfg.delegatedSessionId || '',
            sts: ytcfg.sts || null,
            hl: ctx?.client?.hl || 'es',
            gl: ctx?.client?.gl || 'ES',
            fullContext: ctx
        };
    }

    async function construirHeadersInnerTube(incluirAuth = true) {
        const cfg = obtenerConfigYtcfg();
        const headers = {
            'Content-Type': 'application/json',
            'X-Youtube-Client-Name': String(cfg.clientName || 1),
            'X-Youtube-Client-Version': String(cfg.clientVersion || '2.20260401.01.00'),
            'X-Origin': 'https://www.youtube.com',
            Origin: 'https://www.youtube.com',
            'X-Goog-AuthUser': cfg.sessionIndex || '0'
        };
        if (cfg.visitorData) headers['X-Goog-Visitor-Id'] = cfg.visitorData;
        if (cfg.delegatedSessionId) headers['X-Goog-PageId'] = cfg.delegatedSessionId;

        if (incluirAuth) {
            const auth = await calcularSapisidHash('https://www.youtube.com');
            if (auth) headers.Authorization = auth;
        }

        return { headers, cfg };
    }

    function emitirPitidoAlerta() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext || estado.win?.AudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(659.25, ctx.currentTime);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
            osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.3);

            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.6);
            setTimeout(() => {
                try {
                    ctx.close();
                } catch {
                    // El contexto pudo cerrarse antes del temporizador.
                }
            }, 800);
        } catch {
            // Ignorar si el navegador bloquea WebAudio sin gesto previo.
        }
    }

    function enviarNotificacion(titulo, cuerpo, urlAbrir) {
        try {
            if (typeof GM_notification === 'function') {
                GM_notification({
                    title: titulo,
                    text: cuerpo,
                    image: 'https://www.youtube.com/s/desktop/f7129524/img/favicon.ico',
                    highlight: true,
                    timeout: 25000,
                    onclick: () => {
                        try {
                            window.focus();
                        } catch {
                            // Sin acceso al foco.
                        }
                        if (urlAbrir) {
                            try {
                                window.open(urlAbrir, '_blank');
                            } catch {
                                // Popups bloqueados.
                            }
                        }
                    }
                });
                return;
            }

            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage({
                    action: 'MAXIMUS_NOTIFY',
                    title: titulo,
                    message: cuerpo,
                    url: urlAbrir
                });
                return;
            }

            if (document.documentElement?.dataset?.maximusBridge === '1') {
                window.dispatchEvent(
                    new CustomEvent('maximus-bridge-notify', {
                        detail: { title: titulo, message: cuerpo, url: urlAbrir }
                    })
                );
                return;
            }

            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                const n = new Notification(titulo, { body: cuerpo });
                if (urlAbrir) {
                    n.onclick = () => {
                        window.focus();
                        window.open(urlAbrir, '_blank');
                    };
                }
            }
        } catch {
            // No detener el flujo si fallan las notificaciones del sistema.
        }
    }

    function esRespuestaCaptcha(status, textoResp, finalUrl) {
        if (status === 429) return true;
        const url = String(finalUrl || '').toLowerCase();
        if (url.includes('/sorry/index') || url.includes('google.com/sorry')) return true;

        if (status === 403 || status === 503) {
            const muestra = String(textoResp || '').slice(0, 4000);
            if (
                muestra.includes('id="captcha-form"') ||
                muestra.includes('g-recaptcha') ||
                muestra.includes('recaptcha/api.js') ||
                /demuestra que no eres un robot|unusual traffic|tr[aá]fico inusual/i.test(muestra)
            ) {
                return true;
            }
        }
        return false;
    }

    function activarPausaPorCaptcha(url) {
        if (estado.enPausaPorCaptcha) return;
        estado.enPausaPorCaptcha = true;
        estado.urlCaptchaActivo = url || 'https://www.youtube.com/';

        emitirPitidoAlerta();
        enviarNotificacion(
            '⚠️ YouTube a TXT: ¡Saltó el reCAPTCHA!',
            '¡Saltó el reCAPTCHA! Ábrelo, resuélvelo manualmente y pulsa Continuar en el panel.',
            estado.urlCaptchaActivo
        );

        if (estado.panelCanal) {
            estado.panelCanal.panel.classList.add('alerta-captcha');
            if (estado.panelCanal.btnCaptcha) {
                estado.panelCanal.btnCaptcha.hidden = false;
                estado.panelCanal.btnCaptcha.textContent = '⚡ Resolver Captcha y Continuar';
                estado.panelCanal.btnCaptcha.title = 'Haz clic para abrir el captcha en una pestaña y reanudar';
            }
            estado.panelCanal.estado.textContent =
                '⚠️ Saltó el reCAPTCHA: resuélvelo manualmente y luego pulsa "Ya lo resolví, ¡Continuar!".';
        }
    }

    function esperarResolucionCaptcha() {
        if (!estado.enPausaPorCaptcha) return Promise.resolve();
        return new Promise(resolve => {
            estado.resolverCaptchaFn = resolve;
        });
    }

    function reanudarDespuesDeCaptcha() {
        if (!estado.enPausaPorCaptcha) return;
        estado.enPausaPorCaptcha = false;
        estado.urlCaptchaActivo = '';

        if (estado.panelCanal) {
            estado.panelCanal.panel.classList.remove('alerta-captcha');
            if (estado.panelCanal.btnCaptcha) {
                estado.panelCanal.btnCaptcha.hidden = true;
                delete estado.panelCanal.btnCaptcha.dataset.abierto;
            }
            estado.panelCanal.estado.textContent = 'Captcha resuelto. Reanudando descargas...';
        }

        if (typeof estado.resolverCaptchaFn === 'function') {
            const fn = estado.resolverCaptchaFn;
            estado.resolverCaptchaFn = null;
            fn();
        }
    }

    function cancelarDescargaActiva() {
        if (!estado.ocupado) return;
        estado.cancelado = true;
        if (estado.enPausaPorCaptcha) {
            reanudarDespuesDeCaptcha();
        }
        limpiarTodosLosIframesTrabajadores();
        for (const abortar of estado.abortadoresActivos) {
            try {
                abortar();
            } catch {
                // La petición ya pudo haber cerrado.
            }
        }
        estado.abortadoresActivos.clear();
        if (estado.panelCanal?.estado) {
            estado.panelCanal.estado.textContent = 'Deteniendo descarga...';
        }
    }

    function obtenerGmTransporte() {
        if (typeof GM_xmlhttpRequest === 'function') return GM_xmlhttpRequest;
        if (typeof GM !== 'undefined' && typeof GM.xmlHttpRequest === 'function') return GM.xmlHttpRequest;
        if (typeof window !== 'undefined' && typeof window.GM_xmlhttpRequest === 'function') return window.GM_xmlhttpRequest;
        if (typeof unsafeWindow !== 'undefined' && typeof unsafeWindow.GM_xmlhttpRequest === 'function') {
            return unsafeWindow.GM_xmlhttpRequest;
        }
        return null;
    }

    function peticionViaBackground(url, opciones, timeout) {
        const method = (opciones.method || 'GET').toUpperCase();
        const headers = {
            Accept: '*/*',
            'Accept-Language': 'es-419,es;q=0.9',
            ...(opciones.headers || {})
        };
        const body = opciones.body || opciones.data || undefined;
        const anonymous = Boolean(opciones.anonymous);

        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            return new Promise((resolve, reject) => {
                if (estado.cancelado) {
                    const err = new Error('Descarga detenida por el usuario');
                    err.esCancelacion = true;
                    return reject(err);
                }

                let finalizado = false;
                const requestId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

                const abortar = () => {
                    if (finalizado) return;
                    finalizado = true;
                    clearTimeout(timer);
                    estado.abortadoresActivos.delete(abortar);
                    try {
                        chrome.runtime.sendMessage({ action: 'MAXIMUS_ABORT', requestId });
                    } catch {
                        // Ignorar si el worker no está activo.
                    }
                    const err = new Error('Descarga detenida por el usuario');
                    err.esCancelacion = true;
                    reject(err);
                };

                estado.abortadoresActivos.add(abortar);

                const timer = setTimeout(() => {
                    if (finalizado) return;
                    finalizado = true;
                    estado.abortadoresActivos.delete(abortar);
                    try {
                        chrome.runtime.sendMessage({ action: 'MAXIMUS_ABORT', requestId });
                    } catch {
                        // Ignorar.
                    }
                    reject(new Error('Tiempo agotado'));
                }, timeout);

                chrome.runtime.sendMessage(
                    {
                        action: 'MAXIMUS_HTTP_REQUEST',
                        requestId,
                        url,
                        method,
                        headers,
                        body,
                        anonymous,
                        timeout
                    },
                    respuesta => {
                        if (finalizado) return;
                        finalizado = true;
                        clearTimeout(timer);
                        estado.abortadoresActivos.delete(abortar);

                        if (chrome.runtime.lastError) {
                            return reject(new Error(chrome.runtime.lastError.message || 'Error en background'));
                        }
                        if (!respuesta || respuesta.error) {
                            return reject(new Error(respuesta?.error || 'Error de red en background'));
                        }
                        resolve({
                            status: respuesta.status,
                            text: respuesta.text || '',
                            finalUrl: respuesta.finalUrl || url
                        });
                    }
                );
            });
        }

        if (document.documentElement?.dataset?.maximusBridge === '1') {
            return new Promise((resolve, reject) => {
                if (estado.cancelado) {
                    const err = new Error('Descarga detenida por el usuario');
                    err.esCancelacion = true;
                    return reject(err);
                }

                let finalizado = false;
                const requestId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
                const eventoRespuesta = `maximus-bridge-res-${requestId}`;

                const limpiar = () => {
                    clearTimeout(timer);
                    estado.abortadoresActivos.delete(abortar);
                    window.removeEventListener(eventoRespuesta, onRespuesta);
                };

                const abortar = () => {
                    if (finalizado) return;
                    finalizado = true;
                    limpiar();
                    window.dispatchEvent(new CustomEvent('maximus-bridge-abort', { detail: { requestId } }));
                    const err = new Error('Descarga detenida por el usuario');
                    err.esCancelacion = true;
                    reject(err);
                };

                const onRespuesta = e => {
                    if (finalizado) return;
                    finalizado = true;
                    limpiar();
                    const respuesta = e.detail;
                    if (!respuesta || respuesta.error) {
                        return reject(new Error(respuesta?.error || 'Error de red en puente DOM'));
                    }
                    resolve({
                        status: respuesta.status,
                        text: respuesta.text || '',
                        finalUrl: respuesta.finalUrl || url
                    });
                };

                estado.abortadoresActivos.add(abortar);
                window.addEventListener(eventoRespuesta, onRespuesta, { once: true });

                const timer = setTimeout(() => {
                    if (finalizado) return;
                    finalizado = true;
                    limpiar();
                    window.dispatchEvent(new CustomEvent('maximus-bridge-abort', { detail: { requestId } }));
                    reject(new Error('Tiempo agotado'));
                }, timeout);

                window.dispatchEvent(
                    new CustomEvent('maximus-bridge-http', {
                        detail: {
                            requestId,
                            url,
                            method,
                            headers,
                            body,
                            anonymous,
                            timeout
                        }
                    })
                );
            });
        }

        return null;
    }

    function peticionHttpBaja(url, opciones = {}) {
        verificarCancelacion();

        const method = (opciones.method || 'GET').toUpperCase();
        const headers = {
            Accept: '*/*',
            'Accept-Language': 'es-419,es;q=0.9',
            ...(opciones.headers || {})
        };
        const data = opciones.body || opciones.data || undefined;
        const anonymous = Boolean(opciones.anonymous);
        const timeout = opciones.timeout || CFG.TIMEOUT;
        const gm = obtenerGmTransporte();

        if (gm && !opciones.preferirFetch) {
            return new Promise((resolve, reject) => {
                if (estado.cancelado) {
                    const err = new Error('Descarga detenida por el usuario');
                    err.esCancelacion = true;
                    return reject(err);
                }

                let finalizado = false;
                let req = null;

                const abortar = () => {
                    if (finalizado) return;
                    finalizado = true;
                    clearTimeout(timer);
                    estado.abortadoresActivos.delete(abortar);
                    try {
                        req?.abort?.();
                    } catch {
                        // Ignorar.
                    }
                    const err = new Error('Descarga detenida por el usuario');
                    err.esCancelacion = true;
                    reject(err);
                };

                estado.abortadoresActivos.add(abortar);

                const timer = setTimeout(() => {
                    if (finalizado) return;
                    finalizado = true;
                    estado.abortadoresActivos.delete(abortar);
                    try {
                        req?.abort?.();
                    } catch {
                        // Ignorar.
                    }
                    reject(new Error('Tiempo agotado'));
                }, timeout);

                const fin = (fn, val) => {
                    if (finalizado) return;
                    finalizado = true;
                    clearTimeout(timer);
                    estado.abortadoresActivos.delete(abortar);
                    fn(val);
                };

                try {
                    req = gm({
                        method,
                        url,
                        headers: {
                            Referer: 'https://www.youtube.com/',
                            ...headers
                        },
                        data,
                        withCredentials: !anonymous,
                        anonymous,
                        timeout,
                        onload: r => {
                            fin(resolve, {
                                status: r.status,
                                text: r.responseText || '',
                                finalUrl: r.finalUrl || url
                            });
                        },
                        onerror: () => fin(reject, new Error('Error de red en GM_xmlhttpRequest')),
                        ontimeout: () => fin(reject, new Error('Tiempo agotado')),
                        onabort: () => {
                            const err = new Error('Descarga detenida por el usuario');
                            err.esCancelacion = true;
                            fin(reject, err);
                        }
                    });
                } catch (e) {
                    fin(reject, e);
                }
            });
        }

        // En extensión MV3 usamos background.js cuando se piden llamadas sin cookies o fuera de preferirFetch.
        if (!opciones.preferirFetch && !gm) {
            const bgPromise = peticionViaBackground(url, opciones, timeout);
            if (bgPromise) return bgPromise;
        }

        return new Promise((resolve, reject) => {
            const fetchFn = (estado.win && estado.win.fetch) || (typeof fetch === 'function' ? fetch : null);
            if (!fetchFn) {
                return reject(new Error('No hay transporte HTTP disponible'));
            }

            const ctrl = new AbortController();
            const abortar = () => ctrl.abort();
            estado.abortadoresActivos.add(abortar);
            const timer = setTimeout(() => ctrl.abort(), timeout);

            fetchFn
                .call(estado.win || window, url, {
                    method,
                    headers,
                    body: data,
                    credentials: anonymous ? 'omit' : 'include',
                    cache: 'no-store',
                    signal: ctrl.signal
                })
                .then(async res => {
                    const text = await res.text();
                    return {
                        status: res.status,
                        text,
                        finalUrl: res.url || url
                    };
                })
                .then(resolve)
                .catch(e => {
                    if (estado.cancelado || ctrl.signal.aborted) {
                        const err = new Error('Descarga detenida por el usuario');
                        err.esCancelacion = true;
                        return reject(err);
                    }
                    reject(e);
                })
                .finally(() => {
                    clearTimeout(timer);
                    estado.abortadoresActivos.delete(abortar);
                });
        });
    }

    async function peticionHttp(url, opciones = {}) {
        verificarCancelacion();

        if (estado.enPausaPorCaptcha) {
            await esperarResolucionCaptcha();
            verificarCancelacion();
        }

        let resp = await peticionHttpBaja(url, opciones);

        if (resp.status === 429) {
            await new Promise(r => setTimeout(r, 2500 + Math.random() * 1500));
            verificarCancelacion();
            resp = await peticionHttpBaja(url, opciones);
        }

        if (esRespuestaCaptcha(resp.status, resp.text, resp.finalUrl)) {
            activarPausaPorCaptcha(resp.finalUrl || url);
            await esperarResolucionCaptcha();
            verificarCancelacion();
            return await peticionHttp(url, opciones);
        }

        if (resp.status < 200 || resp.status >= 300) {
            const err = new Error(`HTTP ${resp.status}`);
            err.status = resp.status;
            throw err;
        }

        return resp.text;
    }

    const fetchTexto = peticionHttp;

    // --- Módulo 7: Codificador Protobuf, parsers de subtítulos y bloques de 200 caracteres ---

    // Codificación Protobuf para get_transcript, parseo XML/JSON3/VTT y armado de bloques de 200 caracteres.


    function encodeVarint(num) {
        const bytes = [];
        let n = num >>> 0;
        while (n > 127) {
            bytes.push((n & 0x7f) | 0x80);
            n >>>= 7;
        }
        bytes.push(n);
        return bytes;
    }

    function encodeProtobufString(fieldNumber, str) {
        const utf8 = Array.from(new TextEncoder().encode(String(str)));
        const tag = (fieldNumber << 3) | 2;
        return [...encodeVarint(tag), ...encodeVarint(utf8.length), ...utf8];
    }

    function bytesToBase64(bytes) {
        let bin = '';
        for (let i = 0; i < bytes.length; i++) {
            bin += String.fromCharCode(bytes[i]);
        }
        return btoa(bin);
    }

    function generarParamsProtobufGetTranscript(videoId, languageCode = 'es', kind = 'asr') {
        const candidatos = [];
        const idiomas = Array.from(new Set([languageCode || 'es', 'es', 'es-419', 'es-ES', 'en']));
        const tipos = Array.from(new Set([kind ?? 'asr', 'asr', '']));

        for (const lang of idiomas) {
            for (const k of tipos) {
                const inner = [
                    ...encodeProtobufString(1, k),
                    ...encodeProtobufString(2, lang),
                    ...encodeProtobufString(3, '')
                ];
                const innerB64Url = encodeURIComponent(bytesToBase64(inner));
                const outerA = [
                    ...encodeProtobufString(1, videoId),
                    ...encodeProtobufString(2, innerB64Url),
                    0x18,
                    0x01
                ];
                candidatos.push(bytesToBase64(outerA));

                const innerB64Raw = bytesToBase64(inner);
                const outerB = [
                    ...encodeProtobufString(1, videoId),
                    ...encodeProtobufString(2, innerB64Raw),
                    0x18,
                    0x01
                ];
                candidatos.push(bytesToBase64(outerB));
            }
        }

        const outerDefault = [...encodeProtobufString(1, videoId), 0x18, 0x01];
        candidatos.push(bytesToBase64(outerDefault));

        return Array.from(new Set(candidatos));
    }

    const ENTIDADES_HTML = Object.freeze({
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
        nbsp: ' '
    });

    // Dos pasadas porque YouTube suele entregar entidades doblemente escapadas en XML timedtext (&amp;#39;).
    function decodeHtmlEntities(raw) {
        let str = String(raw ?? '');
        for (let pase = 0; pase < 2; pase++) {
            if (!str.includes('&')) break;
            str = str.replace(/&(?:#(\d+)|#x([\da-fA-F]+)|([a-zA-Z]+));/g, (match, dec, hex, named) => {
                if (dec !== undefined) {
                    const cp = parseInt(dec, 10);
                    return Number.isFinite(cp) ? String.fromCodePoint(cp) : match;
                }
                if (hex !== undefined) {
                    const cp = parseInt(hex, 16);
                    return Number.isFinite(cp) ? String.fromCodePoint(cp) : match;
                }
                const key = named.toLowerCase();
                return Object.prototype.hasOwnProperty.call(ENTIDADES_HTML, key)
                    ? ENTIDADES_HTML[key]
                    : match;
            });
        }
        return str;
    }

    function formatTime(time) {
        const hours = Math.floor(time / 3600);
        const minutes = Math.floor((time % 3600) / 60);
        const seconds = Math.floor(time % 60);
        if (hours > 0) {
            return `${String(hours)}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
    }

    const pad2 = value => String(value).padStart(2, '0');

    const formatTxtTime = seconds =>
        `${Math.floor(seconds / 60)}:${pad2(Math.floor(seconds % 60))}`;

    function toSubtitles(cues) {
        return cues.map(({ text, start, dur }, index) => {
            const next = cues[index + 1];
            return {
                text,
                start,
                end: next ? next.start : start + dur,
                startInFormat: formatTime(start)
            };
        });
    }

    function parseClockTimeToSeconds(val) {
        const s = String(val || '').trim();
        if (!s) return 0;
        const parts = s.split(':').map(Number);
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return Number(s) || 0;
    }

    function parseYouTubeSubtitles(xml) {
        const cues = [];
        const reText = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi;
        let m;
        while ((m = reText.exec(xml)) !== null) {
            const attrs = m[1] || '';
            const rawBody = m[2] || '';
            const mStart = attrs.match(/\bstart\s*=\s*["']([^"']+)["']/i);
            const mDur = attrs.match(/\bdur\s*=\s*["']([^"']+)["']/i);
            const limpio = rawBody.replace(/<[^>]+>/g, '').trim();
            if (limpio) {
                cues.push({
                    text: limpio,
                    start: parseFloat(mStart ? mStart[1] : '0') || 0,
                    dur: parseFloat(mDur ? mDur[1] : '0') || 0
                });
            }
        }

        if (cues.length === 0) {
            const reP = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
            while ((m = reP.exec(xml)) !== null) {
                const attrs = m[1] || '';
                const rawBody = m[2] || '';
                const mT = attrs.match(/\bt\s*=\s*["']([^"']+)["']/i);
                const mD = attrs.match(/\bd\s*=\s*["']([^"']+)["']/i);
                const mStart = attrs.match(/\bstart\s*=\s*["']([^"']+)["']/i);
                const mDur = attrs.match(/\bdur\s*=\s*["']([^"']+)["']/i);
                const limpio = rawBody.replace(/<[^>]+>/g, '').trim();
                if (limpio) {
                    const startVal = mT
                        ? (parseFloat(mT[1]) || 0) / 1000
                        : parseFloat(mStart ? mStart[1] : '0') || 0;
                    const durVal = mD
                        ? (parseFloat(mD[1]) || 0) / 1000
                        : parseFloat(mDur ? mDur[1] : '0') || 0;
                    cues.push({
                        text: limpio,
                        start: startVal,
                        dur: durVal
                    });
                }
            }
        }

        return toSubtitles(cues);
    }

    function parseJson3Subtitles(jsonStr) {
        const events = JSON.parse(jsonStr)?.events ?? [];
        return toSubtitles(
            events
                .filter(event => Array.isArray(event.segs) && !event.aAppend)
                .map(event => ({
                    text: event.segs.map(seg => seg.utf8 ?? '').join(''),
                    start: (event.tStartMs ?? 0) / 1000,
                    dur: (event.dDurationMs ?? 0) / 1000
                }))
        );
    }

    function parseSubtitleVTT(vttText) {
        const cues = [];
        String(vttText || '')
            .replace(/\r/g, '')
            .split(/\n\n+/)
            .forEach(block => {
                const lines = block
                    .split('\n')
                    .map(l => l.trim())
                    .filter(Boolean);
                if (!lines.length || lines[0] === 'WEBVTT') return;
                const timeIndex = lines.findIndex(l => l.includes('-->'));
                if (timeIndex < 0) return;
                const parts = lines[timeIndex].split('-->');
                if (parts.length < 2) return;
                const start = parseClockTimeToSeconds(parts[0].trim());
                const end = parseClockTimeToSeconds(parts[1].trim().split(/\s+/)[0]);
                const dur = Math.max(0, end - start);
                const text = lines
                    .slice(timeIndex + 1)
                    .join(' ')
                    .replace(/<[^>]*>/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                if (text) cues.push({ start, dur, text });
            });
        return toSubtitles(cues);
    }

    function decodeSubtitles(subtitles) {
        return subtitles.map(subtitle => {
            let cleanedText = decodeHtmlEntities(subtitle.text);
            if (CFG.CLEAN_SUBTITLES) {
                cleanedText = cleanedText
                    .replace(/\[.*?\]/g, '')
                    .replace(/\s*>>\s*/g, ' ')
                    .replace(/\s*♪\s*/g, ' ')
                    .replace(/\s*━\s*/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
            }
            return {
                ...subtitle,
                text: cleanedText
            };
        });
    }

    function construirBloquesSubtitulos(originals, blockSize = CFG.BLOCK_SIZE) {
        const merged = [];
        let block = null;
        let length = 0;

        originals.forEach((sub, index) => {
            const raw = String(sub.text ?? '')
                .replace(/\s+/g, ' ')
                .trim();
            if (!raw) return;

            const textSegment = {
                text: raw,
                start: sub.start,
                end: sub.end,
                index
            };

            if (block !== null && length + raw.length + 1 <= blockSize) {
                block.end = sub.end;
                block.textSegments.push(textSegment);
                length += raw.length + 1;
                return;
            }

            if (block !== null) {
                merged.push(block);
            }

            block = {
                ...sub,
                textSegments: [textSegment]
            };
            length = raw.length;
        });

        if (block !== null) {
            merged.push(block);
        }

        return merged
            .map(item => ({
                start: item.start,
                end: item.end,
                text: item.textSegments
                    .map(segment => segment.text)
                    .filter(Boolean)
                    .join(' ')
            }))
            .filter(u => u.text !== '');
    }

    function construirArchivoTxt(originals, { title, videoId }) {
        const units = construirBloquesSubtitulos(originals, CFG.BLOCK_SIZE);
        const url = videoId ? `https://youtu.be/${videoId}` : '';

        const head = CFG.EXPORT_HEADER ? [title, url].filter(Boolean).join('\n') + '\n\n' : '';

        const cuerpo = units
            .map(unit => (CFG.EXPORT_TIME ? `${formatTxtTime(unit.start)}\n` : '') + unit.text)
            .join('\n\n');

        return head + cuerpo;
    }

    function elegirPistaSubtitulo(captionTracks) {
        if (!Array.isArray(captionTracks) || !captionTracks.length) return null;

        const esEspanol = code => /^es(?:-|$)/i.test(String(code || ''));

        const esManual = captionTracks.find(t => esEspanol(t.languageCode) && t.kind !== 'asr');
        if (esManual) return { ...esManual, necesitaTraducir: false };

        const esAuto = captionTracks.find(t => esEspanol(t.languageCode) && t.kind === 'asr');
        if (esAuto) return { ...esAuto, necesitaTraducir: false };

        const origManual = captionTracks.find(t => t.kind !== 'asr');
        if (origManual) return { ...origManual, necesitaTraducir: true };

        return { ...captionTracks[0], necesitaTraducir: true };
    }

    function agregarParametroSinRomperFirma(urlFirmada, clave, valor) {
        if (!urlFirmada) return urlFirmada;
        const re = new RegExp(`([?&])${clave}=[^&]*`);
        if (re.test(urlFirmada)) return urlFirmada;
        const sep = urlFirmada.includes('?') ? '&' : '?';
        return `${urlFirmada}${sep}${clave}=${encodeURIComponent(valor)}`;
    }

    function generarCandidatosSubtitulos(baseUrl, videoId, _codigoIdioma = 'es', _esAuto = false, necesitaTraducir = false) {
        const candidatos = [];

        if (baseUrl) {
            const urlLimpia = baseUrl.replace(/\\u0026/g, '&');
            const potParams = (videoId ? estado.potParamsByVideoId.get(videoId) : null) || estado.potLatestParams;

            const aplicarPot = urlBase => {
                if (!potParams || Object.keys(potParams).length === 0) return null;
                let u = urlBase;
                for (const [k, v] of Object.entries(potParams)) {
                    u = agregarParametroSinRomperFirma(u, k, v);
                }
                return u;
            };

            const baseList = [];
            if (!necesitaTraducir) {
                baseList.push(urlLimpia);
                for (const fmt of ['json3', 'srv1', 'srv3', 'vtt']) {
                    baseList.push(agregarParametroSinRomperFirma(urlLimpia, 'fmt', fmt));
                }
            } else {
                const urlTraducida = agregarParametroSinRomperFirma(urlLimpia, 'tlang', 'es');
                baseList.push(urlTraducida);
                for (const fmt of ['json3', 'srv1', 'srv3', 'vtt']) {
                    baseList.push(agregarParametroSinRomperFirma(urlTraducida, 'fmt', fmt));
                }
                baseList.push(urlLimpia);
                baseList.push(agregarParametroSinRomperFirma(urlLimpia, 'fmt', 'json3'));
            }

            for (const b of baseList) {
                const conPot = aplicarPot(b);
                if (conPot) candidatos.push(conPot);
                candidatos.push(b);
            }
        }

        return Array.from(new Set(candidatos));
    }

    function parsearPayloadSubtitulo(textoRaw) {
        const limpio = String(textoRaw || '').trim();
        if (!limpio || limpio.length < 10) return null;
        if (limpio.includes('<!DOCTYPE') || limpio.includes('<html') || limpio.includes('</html>')) {
            return null;
        }

        try {
            if (limpio.startsWith('{')) {
                const cues = parseJson3Subtitles(limpio);
                if (cues && cues.length > 0) return cues;
            }
            if (limpio.includes('WEBVTT') || limpio.includes('-->')) {
                const cues = parseSubtitleVTT(limpio);
                if (cues && cues.length > 0) return cues;
            }
            if (
                limpio.includes('<transcript') ||
                limpio.includes('<text') ||
                limpio.includes('<timedtext') ||
                limpio.includes('<p ') ||
                limpio.includes('<tt')
            ) {
                const cues = parseYouTubeSubtitles(limpio);
                if (cues && cues.length > 0) return cues;
            }
        } catch {
            // Formato no reconocido o respuesta incompleta.
        }

        return null;
    }

    function parsearRespuestaGetTranscript(data) {
        const cues = [];

        const recorrer = nodo => {
            if (!nodo || typeof nodo !== 'object') return;
            if (Array.isArray(nodo)) {
                for (const el of nodo) recorrer(el);
                return;
            }

            if (nodo.transcriptSegmentRenderer) {
                const seg = nodo.transcriptSegmentRenderer;
                const startMs = parseFloat(seg.startMs || '0');
                const endMs = parseFloat(seg.endMs || String(startMs + 2500));
                const txt =
                    seg.snippet?.runs?.map(r => r.text).join('') ||
                    seg.snippet?.elementsAttributedString?.content ||
                    seg.snippet?.simpleText ||
                    '';
                if (txt.trim()) {
                    cues.push({
                        text: txt.trim(),
                        start: startMs / 1000,
                        dur: Math.max(0.5, (endMs - startMs) / 1000)
                    });
                }
                return;
            }

            if (nodo.transcriptSegmentViewModel) {
                const vm = nodo.transcriptSegmentViewModel;
                const txt =
                    vm.text?.content ||
                    vm.snippet?.content ||
                    vm.subtitle?.content ||
                    '';
                let startSec = 0;
                if (vm.startTimeMs !== undefined) {
                    startSec = parseFloat(vm.startTimeMs) / 1000;
                } else if (vm.timestamp?.content || vm.timestampText) {
                    startSec = parseClockTimeToSeconds(vm.timestamp?.content || vm.timestampText);
                }
                if (txt.trim()) {
                    cues.push({
                        text: txt.trim(),
                        start: startSec,
                        dur: 2.5
                    });
                }
                return;
            }

            if (nodo.macroMarkersPanelItemViewModel && nodo.macroMarkersPanelItemViewModel.item) {
                recorrer(nodo.macroMarkersPanelItemViewModel.item);
                return;
            }

            for (const v of Object.values(nodo)) {
                if (v && typeof v === 'object') recorrer(v);
            }
        };

        recorrer(data);

        if (cues.length > 0) {
            return decodeSubtitles(toSubtitles(cues)).filter(s => s.text.length > 0);
        }
        return [];
    }

    function convertirDomCuesASubtitulos(domCues) {
        if (!Array.isArray(domCues) || !domCues.length) return [];
        const cues = domCues.map(c => ({
            text: c.bTxt,
            start: parseClockTimeToSeconds(c.tTxt),
            dur: 2.5
        }));
        return decodeSubtitles(toSubtitles(cues)).filter(s => s.text.length > 0);
    }

    // --- Módulo 8: Pipeline de extracción en 5 capas y regla azul estricta ---

    // Pipeline de extracción en 5 capas por video (DOM vivo, /watch + /next, get_transcript, clientes móviles e iframe /watch).


    function extraerFechaPublicacion(playerResponse, html = '') {
        const mf = playerResponse?.microformat?.playerMicroformatRenderer;
        const rawFecha =
            mf?.publishDate ||
            mf?.uploadDate ||
            (html
                ? html.match(/"publishDate"\s*:\s*"(\d{4}-\d{2}-\d{2})/)?.[1] ||
                  html.match(/"uploadDate"\s*:\s*"(\d{4}-\d{2}-\d{2})/)?.[1] ||
                  html.match(/itemprop="datePublished"\s+content="(\d{4}-\d{2}-\d{2})/)?.[1]
                : '') ||
            '';

        const m = String(rawFecha).match(/^(\d{4}-\d{2}-\d{2})/);
        return m ? m[1] : '0000-00-00';
    }

    function extraerPistasDePlayerResponse(pr) {
        return (
            pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks ||
            pr?.captions?.playerCaptionsRenderer?.captionTracks ||
            []
        );
    }

    function extraerDatosLigerosDeHtmlWatch(html) {
        if (!html || typeof html !== 'string') {
            return {
                titulo: '',
                fecha: '0000-00-00',
                pistas: [],
                transcriptParams: [],
                playabilityStatus: 'OK',
                visitorData: ''
            };
        }

        const transcriptParams = [];
        const reTranscript = /"getTranscriptEndpoint"\s*:\s*\{\s*"params"\s*:\s*"([^"]+)"/g;
        let m;
        while ((m = reTranscript.exec(html)) !== null) {
            if (m[1]) transcriptParams.push(m[1]);
        }

        let visitorData = '';
        const mVis =
            html.match(/"VISITOR_DATA"\s*:\s*"([^"]+)"/) ||
            html.match(/"visitorData"\s*:\s*"([^"]+)"/);
        if (mVis?.[1]) visitorData = mVis[1];

        let fecha = '0000-00-00';
        const mFecha =
            html.match(/"publishDate"\s*:\s*"(\d{4}-\d{2}-\d{2})/) ||
            html.match(/"uploadDate"\s*:\s*"(\d{4}-\d{2}-\d{2})/) ||
            html.match(/itemprop="datePublished"\s+content="(\d{4}-\d{2}-\d{2})/);
        if (mFecha?.[1]) fecha = mFecha[1];

        let titulo = '';
        let pistas = [];
        let playabilityStatus = 'OK';

        const idxCaptions = html.indexOf('"playerCaptionsTracklistRenderer":');
        if (idxCaptions !== -1) {
            const objCap = extraerJsonBalanceadoDesdeIndice(
                html,
                idxCaptions + '"playerCaptionsTracklistRenderer":'.length
            );
            if (Array.isArray(objCap?.captionTracks)) {
                pistas = objCap.captionTracks;
            }
        }

        const idxDetails = html.indexOf('"videoDetails":');
        if (idxDetails !== -1) {
            const objDet = extraerJsonBalanceadoDesdeIndice(html, idxDetails + '"videoDetails":'.length);
            if (objDet?.title) {
                titulo = texto(objDet.title);
            }
        }

        const idxPlay = html.indexOf('"playabilityStatus":');
        if (idxPlay !== -1) {
            const objPlay = extraerJsonBalanceadoDesdeIndice(html, idxPlay + '"playabilityStatus":'.length);
            if (objPlay?.status) {
                playabilityStatus = objPlay.status;
            }
        }

        return {
            titulo,
            fecha,
            pistas,
            transcriptParams: Array.from(new Set(transcriptParams)),
            playabilityStatus,
            visitorData
        };
    }

    async function obtenerDatosViaInnertubeNext(videoId) {
        verificarCancelacion();
        const { headers, cfg } = await construirHeadersInnerTube(true);
        const urlNext = `https://www.youtube.com/youtubei/v1/next?prettyPrint=false${cfg.apiKey ? `&key=${encodeURIComponent(cfg.apiKey)}` : ''}`;

        const bodyObj = {
            context: cfg.fullContext || {
                client: {
                    clientName: 'WEB',
                    clientVersion: cfg.clientVersion || '2.20260401.01.00',
                    hl: 'es',
                    gl: 'ES',
                    ...(cfg.visitorData ? { visitorData: cfg.visitorData } : {})
                }
            },
            videoId
        };

        try {
            const resp = await peticionHttpBaja(urlNext, {
                method: 'POST',
                preferirFetch: true,
                headers,
                body: JSON.stringify(bodyObj),
                timeout: 9000
            });
            if (resp.status === 200 && resp.text) {
                const params = [];
                const re = /"getTranscriptEndpoint"\s*:\s*\{\s*"params"\s*:\s*"([^"]+)"/g;
                let m;
                while ((m = re.exec(resp.text)) !== null) {
                    if (m[1]) params.push(m[1]);
                }
                return Array.from(new Set(params));
            }
        } catch (e) {
            if (e.esCancelacion || estado.cancelado) throw e;
        }
        return [];
    }

    async function obtenerPlayerMultiCliente(videoId, visitorDataOverride = '') {
        verificarCancelacion();
        const cfg = obtenerConfigYtcfg();
        const urlPlayer = `https://www.youtube.com/youtubei/v1/player?prettyPrint=false${cfg.apiKey ? `&key=${encodeURIComponent(cfg.apiKey)}` : ''}`;
        const vData = visitorDataOverride || cfg.visitorData || '';

        for (const cli of CLIENTES_INNERTUBE) {
            verificarCancelacion();
            try {
                const payload = {
                    context: {
                        client: {
                            ...cli.context,
                            ...(vData ? { visitorData: vData } : {})
                        },
                        ...(cli.nombre === 'WEB_EMBEDDED_PLAYER'
                            ? { thirdParty: { embedUrl: 'https://www.youtube.com/' } }
                            : {})
                    },
                    videoId,
                    contentCheckOk: true,
                    racyCheckOk: true,
                    ...(cfg.sts
                        ? { playbackContext: { contentPlaybackContext: { signatureTimestamp: Number(cfg.sts) } } }
                        : {})
                };

                const headersCli = {
                    'Content-Type': 'application/json',
                    'X-Youtube-Client-Name': cli.id,
                    'X-Youtube-Client-Version': cli.context.clientVersion,
                    Origin: 'https://www.youtube.com',
                    'X-Origin': 'https://www.youtube.com',
                    ...(vData ? { 'X-Goog-Visitor-Id': vData } : {}),
                    ...(cli.ua ? { 'User-Agent': cli.ua } : {})
                };

                // Android e iOS suelen responder sin requerir cookies de sesión web.
                for (const modoAnonimo of [true, false]) {
                    verificarCancelacion();
                    const hFinal = { ...headersCli };
                    if (!modoAnonimo) {
                        const auth = await calcularSapisidHash('https://www.youtube.com');
                        if (auth) hFinal.Authorization = auth;
                    }
                    const resp = await peticionHttpBaja(urlPlayer, {
                        method: 'POST',
                        headers: hFinal,
                        body: JSON.stringify(payload),
                        anonymous: modoAnonimo,
                        timeout: 8000
                    });

                    if (resp.status === 200 && resp.text) {
                        const pr = JSON.parse(resp.text);
                        const pistas = extraerPistasDePlayerResponse(pr);
                        if (pistas.length > 0) {
                            return {
                                cliente: cli.nombre,
                                pr,
                                pistas,
                                titulo: texto(pr?.videoDetails?.title || ''),
                                fecha: extraerFechaPublicacion(pr),
                                playabilityStatus: pr?.playabilityStatus?.status || 'OK'
                            };
                        }
                    }
                }
            } catch (e) {
                if (e.esCancelacion || estado.cancelado) throw e;
            }
        }
        return null;
    }

    async function extraerSubtitulosViaGetTranscript(videoId, pistaElegida = null, paramsExtraidosHtml = []) {
        verificarCancelacion();
        const { headers, cfg } = await construirHeadersInnerTube(true);
        const urlEndpoint = `https://www.youtube.com/youtubei/v1/get_transcript?prettyPrint=false${cfg.apiKey ? `&key=${encodeURIComponent(cfg.apiKey)}` : ''}`;

        const generados = generarParamsProtobufGetTranscript(
            videoId,
            pistaElegida?.languageCode || 'es',
            pistaElegida?.kind ?? 'asr'
        );

        const unicos = Array.from(new Set([...(paramsExtraidosHtml || []), ...generados]));

        const contextPayload = cfg.fullContext || {
            client: {
                clientName: 'WEB',
                clientVersion: cfg.clientVersion || '2.20260401.01.00',
                hl: cfg.hl || 'es',
                gl: cfg.gl || 'ES',
                ...(cfg.visitorData ? { visitorData: cfg.visitorData } : {})
            }
        };

        for (const paramsStr of unicos) {
            verificarCancelacion();
            try {
                const resp = await peticionHttpBaja(urlEndpoint, {
                    method: 'POST',
                    preferirFetch: true,
                    headers,
                    body: JSON.stringify({
                        context: contextPayload,
                        params: paramsStr
                    }),
                    timeout: 8500
                });

                if (resp.status === 200 && resp.text) {
                    const data = JSON.parse(resp.text);
                    const subtitulos = parsearRespuestaGetTranscript(data);
                    if (subtitulos.length > 0) {
                        return subtitulos;
                    }
                }
            } catch (e) {
                if (e.esCancelacion || estado.cancelado) throw e;
            }
        }

        return [];
    }

    async function obtenerSubtitulosRobusto(pistaElegida, videoId, idiomaPreferido = 'es') {
        const codigoIdioma = pistaElegida?.languageCode || idiomaPreferido;
        const esAuto = pistaElegida?.kind === 'asr';
        const necesitaTraducir = !!pistaElegida?.necesitaTraducir;

        if (estado.subtitulosCachePorVideoId.has(videoId)) {
            const cuesCache = parsearPayloadSubtitulo(estado.subtitulosCachePorVideoId.get(videoId));
            if (cuesCache && cuesCache.length > 0) {
                return decodeSubtitles(cuesCache).filter(s => s.text.length > 0);
            }
        }

        const candidatos = generarCandidatosSubtitulos(
            pistaElegida?.baseUrl,
            videoId,
            codigoIdioma,
            esAuto,
            necesitaTraducir
        );

        for (const candUrl of candidatos) {
            verificarCancelacion();

            for (const preferirFetch of [true, false]) {
                try {
                    const res = await peticionHttpBaja(candUrl, {
                        method: 'GET',
                        preferirFetch,
                        timeout: 7000
                    });
                    if (res.status === 200 && res.text) {
                        const cues = parsearPayloadSubtitulo(res.text);
                        if (cues && cues.length > 0) {
                            return decodeSubtitles(cues).filter(s => s.text.length > 0);
                        }
                    }
                } catch (e) {
                    if (e.esCancelacion || estado.cancelado) throw e;
                }
            }
        }

        return [];
    }

    async function activarSubtitulosEnPlayerActivoDom(videoId) {
        try {
            if (!location.pathname.includes('/watch') || new URLSearchParams(location.search).get('v') !== videoId) {
                return [];
            }

            if (estado.transcriptJsonPorVideoId.has(videoId)) {
                const sub = parsearRespuestaGetTranscript(JSON.parse(estado.transcriptJsonPorVideoId.get(videoId)));
                if (sub.length > 0) return sub;
            }
            if (estado.subtitulosCachePorVideoId.has(videoId)) {
                const cues = parsearPayloadSubtitulo(estado.subtitulosCachePorVideoId.get(videoId));
                if (cues && cues.length > 0) return decodeSubtitles(cues).filter(s => s.text.length > 0);
            }

            activarSubtitulosMoviePlayer(false);

            const btnTranscriptDom = document.querySelector(
                'ytd-video-description-transcript-section-renderer button, button[aria-label*="transcripci" i], button[aria-label*="transcript" i]'
            );
            if (btnTranscriptDom) {
                btnTranscriptDom.click();
            }

            const inicio = Date.now();
            while (Date.now() - inicio < 3200) {
                if (estado.transcriptJsonPorVideoId.has(videoId)) {
                    const sub = parsearRespuestaGetTranscript(JSON.parse(estado.transcriptJsonPorVideoId.get(videoId)));
                    if (sub.length > 0) return sub;
                }
                if (estado.subtitulosCachePorVideoId.has(videoId)) {
                    const cues = parsearPayloadSubtitulo(estado.subtitulosCachePorVideoId.get(videoId));
                    if (cues && cues.length > 0) {
                        return decodeSubtitles(cues).filter(s => s.text.length > 0);
                    }
                }
                const segsDom = document.querySelectorAll('ytd-transcript-segment-renderer, transcript-segment-view-model');
                if (segsDom.length > 0) {
                    const domCues = [];
                    segsDom.forEach(nodo => {
                        const tTxt = nodo.querySelector('.segment-timestamp, [class*="timestamp"]')?.textContent?.trim() || '0:00';
                        const bTxt =
                            nodo.querySelector('.segment-text, yt-formatted-string, [class*="segment-text"]')?.textContent?.trim() ||
                            '';
                        if (bTxt) domCues.push({ tTxt, bTxt });
                    });
                    const convertidos = convertirDomCuesASubtitulos(domCues);
                    if (convertidos.length > 0) return convertidos;
                }
                await dormir(130);
            }
        } catch {
            // Devolver vacío para permitir capas posteriores.
        }
        return [];
    }

    async function procesarVideoATxt(itemVideo) {
        verificarCancelacion();

        const videoId = itemVideo.videoId;
        let tituloReal = texto(itemVideo.nombre || videoId);
        let fecha = '0000-00-00';
        let subtitulos = [];
        let pistaUsada = null;
        let tuvoPistas = false;
        let estadoPlayability = 'OK';
        let transcriptParamsHtml = [];
        let visitorDataVideo = '';

        const enMismoVideoWatch =
            location.pathname.includes('/watch') &&
            new URLSearchParams(location.search).get('v') === videoId;

        // Capa 0: estado vivo de /watch cuando el usuario está dentro del propio video.
        if (enMismoVideoWatch) {
            try {
                const snap = obtenerSnapshotPagina(videoId);
                const prDom = snap?.pr;
                if (prDom) {
                    if (prDom.videoDetails?.title) tituloReal = texto(prDom.videoDetails.title);
                    const fDom = extraerFechaPublicacion(prDom);
                    if (fDom !== '0000-00-00') fecha = fDom;
                    const pistasDom = extraerPistasDePlayerResponse(prDom);
                    if (pistasDom.length > 0) {
                        tuvoPistas = true;
                        pistaUsada = elegirPistaSubtitulo(pistasDom);
                    }
                }
                if (snap?.initData) {
                    const strInit = JSON.stringify(snap.initData);
                    const re = /"getTranscriptEndpoint"\s*:\s*\{\s*"params"\s*:\s*"([^"]+)"/g;
                    let m;
                    while ((m = re.exec(strInit)) !== null) {
                        if (m[1]) {
                            transcriptParamsHtml.push(m[1]);
                            tuvoPistas = true;
                        }
                    }
                }
            } catch {
                // Continuar con descarga directa HTML + Innertube.
            }
        }

        // Capa 1: HTML ligero /watch + Innertube /next en paralelo.
        if (!enMismoVideoWatch || fecha === '0000-00-00' || transcriptParamsHtml.length === 0) {
            try {
                const [rawHtml, paramsNext] = await Promise.all([
                    !enMismoVideoWatch
                        ? fetchTexto(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=es`).catch(() => '')
                        : Promise.resolve(''),
                    obtenerDatosViaInnertubeNext(videoId).catch(() => [])
                ]);

                if (rawHtml) {
                    const datosHtml = extraerDatosLigerosDeHtmlWatch(rawHtml);
                    if (datosHtml.titulo) tituloReal = datosHtml.titulo;
                    if (datosHtml.fecha !== '0000-00-00') fecha = datosHtml.fecha;
                    if (datosHtml.playabilityStatus) estadoPlayability = datosHtml.playabilityStatus;
                    if (datosHtml.visitorData) visitorDataVideo = datosHtml.visitorData;
                    if (datosHtml.transcriptParams.length > 0) {
                        transcriptParamsHtml.push(...datosHtml.transcriptParams);
                        tuvoPistas = true;
                    }
                    if (datosHtml.pistas.length > 0) {
                        tuvoPistas = true;
                        pistaUsada = elegirPistaSubtitulo(datosHtml.pistas);
                    }
                }

                if (Array.isArray(paramsNext) && paramsNext.length > 0) {
                    transcriptParamsHtml.push(...paramsNext);
                    tuvoPistas = true;
                }
                transcriptParamsHtml = Array.from(new Set(transcriptParamsHtml));
            } catch (e) {
                if (e.esCancelacion || estado.cancelado) throw e;
            }
        }

        // Capa 2: endpoint /youtubei/v1/get_transcript cuando no requiere traducción automática.
        if (subtitulos.length === 0 && (transcriptParamsHtml.length > 0 || tuvoPistas)) {
            if (!pistaUsada?.necesitaTraducir || /^es/i.test(pistaUsada?.languageCode || 'es')) {
                subtitulos = await extraerSubtitulosViaGetTranscript(videoId, pistaUsada, transcriptParamsHtml);
            }
        }

        // Capa 3: clientes móviles Innertube (ANDROID, IOS, MWEB, WEB_EMBEDDED).
        if (subtitulos.length === 0) {
            const infoMovil = await obtenerPlayerMultiCliente(videoId, visitorDataVideo);
            if (infoMovil) {
                if (infoMovil.titulo && (!tituloReal || tituloReal === videoId)) tituloReal = infoMovil.titulo;
                if (infoMovil.fecha && infoMovil.fecha !== '0000-00-00' && fecha === '0000-00-00') {
                    fecha = infoMovil.fecha;
                }
                if (infoMovil.pistas?.length > 0) {
                    tuvoPistas = true;
                    const pistaMovil = elegirPistaSubtitulo(infoMovil.pistas);
                    if (pistaMovil) {
                        pistaUsada = pistaMovil;
                        subtitulos = await obtenerSubtitulosRobusto(pistaMovil, videoId, 'es');
                    }
                }
            }
        }

        // Capa 4: pista web directa y activación en reproductor DOM si estamos en /watch.
        if (subtitulos.length === 0 && pistaUsada?.baseUrl) {
            subtitulos = await obtenerSubtitulosRobusto(pistaUsada, videoId, 'es');
        }

        if (subtitulos.length === 0 && enMismoVideoWatch) {
            subtitulos = await activarSubtitulosEnPlayerActivoDom(videoId);
        }

        if (subtitulos.length === 0 && transcriptParamsHtml.length > 0) {
            subtitulos = await extraerSubtitulosViaGetTranscript(videoId, pistaUsada, transcriptParamsHtml);
        }

        // Capa 5: pool de iframes reales /watch como respaldo definitivo.
        if (subtitulos.length === 0 && !enMismoVideoWatch) {
            const resWorker = await extraerMedianteIframeWatchReal(videoId);
            if (resWorker) {
                if (resWorker.titulo) tituloReal = texto(resWorker.titulo);
                if (resWorker.fecha && resWorker.fecha !== '0000-00-00') fecha = resWorker.fecha;
                if (resWorker.playabilityStatus) estadoPlayability = resWorker.playabilityStatus;

                if (resWorker.noTieneSubtitulos && !tuvoPistas) {
                    tuvoPistas = false;
                } else {
                    tuvoPistas = true;
                    if (Array.isArray(resWorker.pistas) && resWorker.pistas.length > 0 && !pistaUsada) {
                        pistaUsada = elegirPistaSubtitulo(resWorker.pistas);
                    }
                    if (resWorker.rawTranscriptJson) {
                        try {
                            const parsedTr = JSON.parse(resWorker.rawTranscriptJson);
                            subtitulos = parsearRespuestaGetTranscript(parsedTr);
                        } catch {
                            // Pasar al siguiente origen del worker.
                        }
                    }
                    if (subtitulos.length === 0 && resWorker.domTranscriptCues) {
                        subtitulos = convertirDomCuesASubtitulos(resWorker.domTranscriptCues);
                    }
                    if (subtitulos.length === 0 && resWorker.rawTimedtextPayload) {
                        const cues = parsearPayloadSubtitulo(resWorker.rawTimedtextPayload);
                        if (cues && cues.length > 0) {
                            subtitulos = decodeSubtitles(cues).filter(s => s.text.length > 0);
                        }
                    }
                    if (subtitulos.length === 0 && pistaUsada?.baseUrl) {
                        subtitulos = await obtenerSubtitulosRobusto(pistaUsada, videoId, 'es');
                    }
                    if (subtitulos.length === 0 && resWorker.transcriptParams) {
                        subtitulos = await extraerSubtitulosViaGetTranscript(videoId, pistaUsada, [
                            resWorker.transcriptParams
                        ]);
                    }
                }
            }
        }

        estado.subtitulosCachePorVideoId.delete(videoId);
        estado.transcriptJsonPorVideoId.delete(videoId);

        // Regla estricta del color azul: solo aplica cuando ninguna fuente reportó pistas disponibles.
        if (!tuvoPistas && subtitulos.length === 0) {
            const err = new Error(
                `No existe posibilidad de sacar subtítulos porque el video no tiene ninguno habilitado (${estadoPlayability})`
            );
            err.noTieneSubtitulos = true;
            throw err;
        }

        if (subtitulos.length === 0) {
            throw new Error(`No se pudo extraer el cuerpo del subtítulo (${pistaUsada?.languageCode || 'es'})`);
        }

        const contenidoTxt = construirArchivoTxt(subtitulos, {
            title: tituloReal,
            videoId
        });

        const idiomaEtiqueta =
            (pistaUsada?.languageCode || 'es') +
            (pistaUsada?.kind === 'asr' ? ' auto' : '') +
            (pistaUsada?.necesitaTraducir ? ' -> es' : '');

        return {
            fecha,
            titulo: tituloReal,
            idioma: idiomaEtiqueta,
            bloques: construirBloquesSubtitulos(subtitulos, CFG.BLOCK_SIZE).length,
            nombreArchivo: `${fecha} ${seguro(tituloReal)}.txt`,
            bytes: new TextEncoder().encode(contenidoTxt)
        };
    }

    // --- Módulo 9: Descubrimiento de canal, listas (UULF/UUSH/UULV) y marcado DOM ---

    // Detección del canal, conteo por listas (UULF/UUSH/UULV), paginación, marcado de tarjetas y armado de cola.


    const UC_RE = /^UC[\w-]{22}$/;

    function enPantallaDeCanal() {
        return /^\/(?:@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)(?:\/|$)/i.test(location.pathname);
    }

    function obtenerClaveCanalUrl() {
        const m = location.pathname.match(/^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)/i);
        return m ? m[1].toLowerCase() : '';
    }

    function obtenerNombreCanalDom(initialData = null) {
        const deJson =
            initialData?.metadata?.channelMetadataRenderer?.title ||
            initialData?.header?.pageHeaderRenderer?.pageTitle;
        if (deJson && texto(deJson)) {
            return seguro(deJson, 'Canal de YouTube');
        }

        const h1 = document.querySelector('yt-page-header-view-model h1, #channel-name #text, ytd-channel-name #text');
        if (h1 && texto(h1.textContent)) {
            return seguro(h1.textContent, 'Canal de YouTube');
        }

        const t = texto(document.title).replace(/\s*-\s*YouTube$/i, '');
        return seguro(t, 'Canal de YouTube');
    }

    function resolverChannelIdInstantaneo(snap = null) {
        const metaVal = document.querySelector('meta[itemprop="channelId"]')?.getAttribute('content');
        if (metaVal && UC_RE.test(metaVal)) return metaVal;

        const canonicalMatch = (document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '').match(
            /\/channel\/(UC[\w-]{22})/
        );
        if (canonicalMatch?.[1]) return canonicalMatch[1];

        const browseNode = document.querySelector('ytd-browse[page-subtype="channels"], ytd-browse');
        const attrId = browseNode?.getAttribute?.('channel-id') || browseNode?.getAttribute?.('external-id');
        if (attrId && UC_RE.test(attrId)) return attrId;

        const canalHref = document.querySelector(
            'ytd-channel-name a[href*="/channel/UC"], #channel-name a[href*="/channel/UC"], a[href^="/channel/UC"]'
        );
        const hrefMatch = (canalHref?.getAttribute('href') || '').match(/\/channel\/(UC[\w-]{22})/);
        if (hrefMatch?.[1]) return hrefMatch[1];

        const actual = snap || obtenerSnapshotPagina();

        try {
            const initData = actual?.initData;
            const deInit =
                initData?.metadata?.channelMetadataRenderer?.externalId ||
                initData?.header?.c4TabbedHeaderRenderer?.channelId;
            if (deInit && UC_RE.test(deInit)) return deInit;

            const rows =
                initData?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel?.metadata
                    ?.contentMetadataViewModel?.metadataRows || [];
            for (const row of rows) {
                for (const part of row.metadataParts || []) {
                    const txt = part?.text?.content || '';
                    if (UC_RE.test(txt)) return txt;
                }
            }
        } catch {
            // Ignorar si ytInitialData aún no se hidrata en la navegación SPA.
        }

        try {
            const cfgId = actual?.ytcfg?.channelId;
            if (cfgId && UC_RE.test(cfgId)) return cfgId;
        } catch {
            // Ignorar.
        }

        const urlMatch = location.pathname.match(/\/channel\/(UC[\w-]{22})/);
        if (urlMatch?.[1]) return urlMatch[1];

        return null;
    }

    function obtenerConteoAproximadoHeader(snap = null) {
        const actual = snap || obtenerSnapshotPagina();
        try {
            const rows =
                actual?.initData?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel?.metadata
                    ?.contentMetadataViewModel?.metadataRows || [];
            for (const fila of rows) {
                for (const parte of fila.metadataParts || []) {
                    const txt = parte?.text?.content || '';
                    if (/\b\d+(?:[.,]\d+)?\s*[kKmMbB]?\s*video/i.test(txt)) {
                        return txt.trim();
                    }
                }
            }
        } catch {
            // Seguir al respaldo sobre nodos visibles del encabezado.
        }

        const nodos = document.querySelectorAll(
            'yt-page-header-view-model span, ytd-channel-name span, #channel-header span, #meta span'
        );
        for (const el of nodos) {
            const txt = el.textContent || '';
            if (/\b\d+(?:[.,]\d+)?\s*[kKmMbB]?\s*videos?\b/i.test(txt)) {
                return txt.trim();
            }
        }

        return '';
    }

    async function resolverDatosCanalActual() {
        const snap = obtenerSnapshotPagina();
        let channelId = resolverChannelIdInstantaneo(snap);
        let clientVersion = snap?.ytcfg?.clientVersion || '2.20260401.01.00';
        let nombreCanal = obtenerNombreCanalDom(snap?.initData);
        let textoTotalHeader = obtenerConteoAproximadoHeader(snap);

        if (channelId && nombreCanal) {
            return {
                channelId,
                nombreCanal,
                clientVersion,
                textoTotalHeader
            };
        }

        let htmlCanal = '';
        try {
            htmlCanal = await fetchTexto(location.href);
        } catch {
            htmlCanal = '';
        }

        const initialData = htmlCanal ? extraerYtInitialDataDeHtml(htmlCanal) : null;

        if (!channelId && htmlCanal) {
            channelId =
                initialData?.metadata?.channelMetadataRenderer?.externalId ||
                initialData?.header?.c4TabbedHeaderRenderer?.channelId ||
                htmlCanal.match(/"externalId"\s*:\s*"(UC[\w-]{22})"/)?.[1] ||
                htmlCanal.match(/"browseId"\s*:\s*"(UC[\w-]{22})"/)?.[1] ||
                htmlCanal.match(/\/channel\/(UC[\w-]{22})/)?.[1] ||
                '';
        }

        if ((!clientVersion || clientVersion === '2.20260401.01.00') && htmlCanal) {
            clientVersion =
                htmlCanal.match(/"INNERTUBE_CLIENT_VERSION"\s*:\s*"([^"]+)"/)?.[1] || clientVersion;
        }

        htmlCanal = '';

        if (!nombreCanal || nombreCanal === 'Canal de YouTube') {
            nombreCanal = obtenerNombreCanalDom(initialData);
        }

        if (!textoTotalHeader && initialData) {
            try {
                const filasMeta =
                    initialData?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel?.metadata
                        ?.contentMetadataViewModel?.metadataRows || [];
                for (const fila of filasMeta) {
                    for (const parte of fila.metadataParts || []) {
                        const txt = parte?.text?.content || '';
                        if (/video|vídeo/i.test(txt)) {
                            textoTotalHeader = txt;
                        }
                    }
                }
            } catch {
                // El canal puede ocultar el total en el encabezado.
            }
        }

        return {
            channelId,
            nombreCanal,
            clientVersion,
            textoTotalHeader
        };
    }

    function extraerNumeroEnteroDeTexto(str) {
        const limpio = String(str || '').replace(/[.,\s\u00a0]/g, '');
        const m = limpio.match(/(\d+)/);
        return m ? parseInt(m[1], 10) : null;
    }

    function parsearConteoPlaylist(data) {
        try {
            const numTxt =
                data?.header?.playlistHeaderRenderer?.numVideosText?.simpleText ||
                data?.header?.playlistHeaderRenderer?.numVideosText?.runs?.map(r => r.text).join('') ||
                '';
            if (numTxt && !/[kKmM]\b/.test(numTxt)) {
                const n = extraerNumeroEnteroDeTexto(numTxt);
                if (Number.isFinite(n)) return n;
            }

            const stats =
                data?.sidebar?.playlistSidebarRenderer?.items?.[0]?.playlistSidebarPrimaryInfoRenderer
                    ?.stats;
            if (Array.isArray(stats) && stats[0]) {
                const txt = stats[0].simpleText || stats[0].runs?.map(r => r.text).join('') || '';
                if (!/[kKmM]\b/.test(txt)) {
                    const n = extraerNumeroEnteroDeTexto(txt);
                    if (Number.isFinite(n)) return n;
                }
            }

            const rows =
                data?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel?.metadata
                    ?.contentMetadataViewModel?.metadataRows || [];
            for (const r of rows) {
                for (const p of r.metadataParts || []) {
                    const txt = p?.text?.content || '';
                    if (/video|vídeo/i.test(txt) && !/[kKmM]\b/.test(txt)) {
                        const n = extraerNumeroEnteroDeTexto(txt);
                        if (Number.isFinite(n)) return n;
                    }
                }
            }
        } catch {
            // Estructuras variables según layout del canal.
        }
        return null;
    }

    function extraerItemsYContinuacionDePlaylist(nodoRaiz, categoria) {
        const videos = [];
        let tokenContinuacion = null;

        const recorrer = obj => {
            if (!obj || typeof obj !== 'object') return;

            if (Array.isArray(obj)) {
                for (const el of obj) recorrer(el);
                return;
            }

            if (obj.playlistVideoRenderer) {
                const pvr = obj.playlistVideoRenderer;
                const videoId = pvr.videoId;
                const nombre =
                    pvr.title?.runs?.map(r => r.text).join('') ||
                    pvr.title?.simpleText ||
                    videoId;
                if (videoId) {
                    videos.push({
                        videoId,
                        nombre: texto(nombre),
                        categoria
                    });
                }
                return;
            }

            if (obj.lockupViewModel) {
                const lvm = obj.lockupViewModel;
                const videoId =
                    lvm.contentId ||
                    lvm.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint?.videoId;
                const nombre =
                    lvm.metadata?.lockupMetadataViewModel?.title?.content ||
                    lvm.rendererContext?.accessibilityContext?.label ||
                    videoId;
                if (videoId) {
                    videos.push({
                        videoId,
                        nombre: texto(nombre),
                        categoria
                    });
                    return;
                }
            }

            if (obj.shortsLockupViewModel) {
                const slvm = obj.shortsLockupViewModel;
                const url = slvm.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url || '';
                const mShort = url.match(/\/shorts\/([\w-]{11})/);
                const videoId = mShort?.[1] || slvm.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId || '';
                const nombre = slvm.overlayMetadata?.primaryText?.content || slvm.accessibilityText || videoId;
                if (videoId) {
                    videos.push({
                        videoId,
                        nombre: texto(nombre),
                        categoria: 'Shorts'
                    });
                    return;
                }
            }

            if (obj.continuationItemRenderer) {
                const cir = obj.continuationItemRenderer;
                const token =
                    cir.continuationEndpoint?.continuationCommand?.token ||
                    cir.continuationEndpoint?.commandExecutorCommand?.commands?.find(
                        c => c.continuationCommand?.token
                    )?.continuationCommand?.token;
                if (token) {
                    tokenContinuacion = token;
                }
                return;
            }

            if (obj.continuationItemViewModel) {
                const civm = obj.continuationItemViewModel;
                const token =
                    civm.continuationCommand?.continuationCommand?.token ||
                    civm.continuationCommand?.innertubeCommand?.continuationCommand?.token;
                if (token) {
                    tokenContinuacion = token;
                }
                return;
            }

            for (const val of Object.values(obj)) {
                if (val && typeof val === 'object') {
                    recorrer(val);
                }
            }
        };

        recorrer(nodoRaiz);
        return { videos, tokenContinuacion };
    }

    async function consultarPrimeraPaginaPlaylist(playlistId, categoria) {
        try {
            const url = `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}&hl=es`;
            let html = await fetchTexto(url);
            const data = extraerYtInitialDataDeHtml(html);
            html = '';
            if (!data) {
                return { conteo: 0, videos: [], tokenContinuacion: null, ok: false };
            }

            const { videos, tokenContinuacion } = extraerItemsYContinuacionDePlaylist(data.contents, categoria);
            const conteoCabecera = parsearConteoPlaylist(data);
            const conteo = Math.max(conteoCabecera || 0, videos.length);

            return {
                conteo,
                videos,
                tokenContinuacion,
                ok: true
            };
        } catch {
            return { conteo: 0, videos: [], tokenContinuacion: null, ok: false };
        }
    }

    async function cargarContinuacionPlaylist(token, clientVersion, categoria) {
        const resTxt = await fetchTexto('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                context: {
                    client: {
                        clientName: 'WEB',
                        clientVersion: clientVersion || '2.20260401.01.00',
                        hl: 'es'
                    }
                },
                continuation: token
            })
        });

        const data = JSON.parse(resTxt);
        return extraerItemsYContinuacionDePlaylist(
            data.onResponseReceivedActions || data.continuationContents || data,
            categoria
        );
    }

    function obtenerRaizCanalDom() {
        return (
            document.querySelector('ytd-browse[page-subtype="channels"]:not([hidden])') ||
            document.querySelector('ytd-browse:not([hidden])') ||
            document
        );
    }

    function obtenerVideosEnPantallaDom() {
        const vistos = new Set();
        const lista = [];

        const esTabShorts = /\/shorts\b/i.test(location.pathname);
        const esTabStreams = /\/streams\b/i.test(location.pathname);
        const raiz = obtenerRaizCanalDom();

        const selectores =
            'a#video-title-link[href],' +
            'a#video-title[href],' +
            'a.yt-lockup-metadata-view-model__title[href],' +
            'a.ytLockupMetadataViewModelTitle[href],' +
            'a.shortsLockupViewModelHostEndpoint[href],' +
            'ytd-rich-item-renderer a[href*="/watch?v="],' +
            'ytd-rich-item-renderer a[href*="/shorts/"],' +
            'yt-lockup-view-model a[href*="/watch?v="],' +
            'ytm-shorts-lockup-view-model a[href*="/shorts/"]';

        for (const a of raiz.querySelectorAll(selectores)) {
            const href = a.getAttribute('href') || '';
            let videoId = '';
            let categoria = esTabShorts ? 'Shorts' : esTabStreams ? 'En vivo' : 'Videos';

            const mWatch = href.match(/[?&]v=([\w-]{11})/);
            const mShorts = href.match(/\/shorts\/([\w-]{11})/);

            if (mWatch) {
                videoId = mWatch[1];
            } else if (mShorts) {
                videoId = mShorts[1];
                categoria = 'Shorts';
            }

            if (!videoId || vistos.has(videoId)) continue;

            const card = a.closest(
                'ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer, yt-lockup-view-model, ytm-shorts-lockup-view-model'
            );

            const tituloNodo =
                card?.querySelector(
                    '#video-title, .yt-lockup-metadata-view-model__title, .ytLockupMetadataViewModelTitle, h3 a, h3, [class*="Title"]'
                ) || a;

            const nombre =
                texto(
                    tituloNodo?.getAttribute?.('title') ||
                        tituloNodo?.getAttribute?.('aria-label') ||
                        tituloNodo?.textContent
                ) || videoId;

            vistos.add(videoId);
            lista.push({
                videoId,
                nombre,
                categoria
            });
        }

        return lista;
    }

    function buscarTarjetaVideoDom(videoId) {
        if (!videoId) return null;
        const raiz = obtenerRaizCanalDom();
        const link = raiz.querySelector(`a[href*="${videoId}"]`);
        return (
            link?.closest(
                'ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer, yt-lockup-view-model, ytm-shorts-lockup-view-model'
            ) || null
        );
    }

    function colorearVideoDom(videoId, estadoFila, detalle) {
        if (!videoId) return;
        guardarEnMapaConLimite(estado.estadoFilas, videoId, { estado: estadoFila, detalle }, 500);

        const card = buscarTarjetaVideoDom(videoId);
        if (!card) return;

        card.classList.remove(
            'maximus-fila-ok',
            'maximus-fila-error',
            'maximus-fila-omitido',
            'maximus-fila-sin-subtitulos'
        );
        card.classList.add(`maximus-fila-${estadoFila}`);
        card.title = detalle;
    }

    function restaurarColoresVideosDom() {
        for (const [videoId, info] of estado.estadoFilas.entries()) {
            const card = buscarTarjetaVideoDom(videoId);
            if (card) {
                card.classList.remove(
                    'maximus-fila-ok',
                    'maximus-fila-error',
                    'maximus-fila-omitido',
                    'maximus-fila-sin-subtitulos'
                );
                card.classList.add(`maximus-fila-${info.estado}`);
                card.title = info.detalle;
            }
        }
    }

    async function construirColaVideos(pc, onProgreso, onDescubrir) {
        if (pc.modo === 'pantalla') {
            const enDom = obtenerVideosEnPantallaDom();
            if (!enDom.length) {
                throw new Error('No se encontraron videos visibles en la pantalla actual');
            }
            return enDom;
        }

        if (!pc.conteoListo && typeof onDescubrir === 'function') {
            onProgreso?.(pc, 0, 1, 'Obteniendo información del canal...');
            await onDescubrir(pc);
        }

        const limiteGlobal =
            pc.modo === 'ultimos'
                ? Math.max(1, parseInt(pc.inputUltimos.value, 10) || CFG.ULTIMOS_DEFECTO)
                : Infinity;

        const cola = [];
        const vistos = new Set();

        for (const cat of CATEGORIAS) {
            if (cola.length >= limiteGlobal) break;

            const infoCat = pc.categoriasDescubiertas.get(cat.clave);
            if (!infoCat || !infoCat.videos?.length) continue;

            const listaCat = [...infoCat.videos];
            let token = infoCat.tokenContinuacion;
            let pagina = 1;

            while (token && cola.length + listaCat.length < limiteGlobal && pagina < 100) {
                verificarCancelacion();
                onProgreso?.(
                    pc,
                    listaCat.length,
                    infoCat.conteo || listaCat.length + 100,
                    `Listando ${cat.clave} del canal (${listaCat.length}/${infoCat.conteo || '?'})...`
                );

                try {
                    const sig = await cargarContinuacionPlaylist(token, pc.clientVersion, cat.clave);
                    if (!sig.videos.length) break;
                    listaCat.push(...sig.videos);
                    token = sig.tokenContinuacion;
                    pagina++;
                } catch {
                    break;
                }
            }

            for (const v of listaCat) {
                if (cola.length >= limiteGlobal) break;
                if (vistos.has(v.videoId)) continue;
                vistos.add(v.videoId);
                cola.push({
                    ...v,
                    carpeta: cat.carpeta
                });
            }
        }

        if (cola.length < limiteGlobal && pc.infoGeneralUU) {
            const infoUU = pc.infoGeneralUU;
            let tokenUU = infoUU.tokenContinuacion;
            let paginaUU = 1;

            for (const v of infoUU.videos || []) {
                if (cola.length >= limiteGlobal) break;
                if (vistos.has(v.videoId)) continue;
                vistos.add(v.videoId);
                cola.push({
                    ...v,
                    carpeta: 'Videos'
                });
            }

            while (tokenUU && cola.length < limiteGlobal && paginaUU < 100) {
                verificarCancelacion();
                onProgreso?.(
                    pc,
                    cola.length,
                    pc.totalExactoCanal || cola.length + 100,
                    `Listando videos del canal (${cola.length}/${pc.totalExactoCanal || '?'})...`
                );
                try {
                    const sig = await cargarContinuacionPlaylist(tokenUU, pc.clientVersion, 'Videos');
                    if (!sig.videos.length) break;
                    for (const v of sig.videos) {
                        if (cola.length >= limiteGlobal) break;
                        if (vistos.has(v.videoId)) continue;
                        vistos.add(v.videoId);
                        cola.push({
                            ...v,
                            carpeta: 'Videos'
                        });
                    }
                    tokenUU = sig.tokenContinuacion;
                    paginaUU++;
                } catch {
                    break;
                }
            }
        }

        if (!cola.length) {
            const fallbackDom = obtenerVideosEnPantallaDom();
            if (fallbackDom.length) {
                return fallbackDom.slice(0, limiteGlobal);
            }
            throw new Error('No se detectaron videos disponibles en este canal');
        }

        return cola;
    }

    // --- Módulo 10: Estilos CSS, barra de progreso por bloques y logo en botones ---

    // Estilos CSS, barra de progreso por bloques, botones con logo en Base64 y puntos de anclaje en YouTube.


    function crearLogoNodo() {
        return crearElemento('img', {
            className: 'maximus-logo',
            src: LOGO_BASE64,
            alt: ''
        });
    }

    function crearBotonConLogo(props, etiquetaInicial) {
        const spanTexto = crearElemento('span', {
            className: 'maximus-boton-texto',
            textContent: etiquetaInicial
        });
        return crearElemento('button', props, [crearLogoNodo(), spanTexto]);
    }

    function cambiarTextoBoton(boton, etiqueta) {
        if (!boton) return;
        let span = boton.querySelector('.maximus-boton-texto');
        if (!span) {
            boton.textContent = '';
            boton.appendChild(crearLogoNodo());
            span = crearElemento('span', { className: 'maximus-boton-texto' });
            boton.appendChild(span);
        }
        span.textContent = etiqueta;
    }

    function obtenerTextoBoton(boton) {
        if (!boton) return '';
        const span = boton.querySelector('.maximus-boton-texto');
        return span ? span.textContent : boton.textContent;
    }

    function inyectarCss() {
        let style = document.getElementById('maximus-yt-css');
        if (!style) {
            style = document.createElement('style');
            style.id = 'maximus-yt-css';
            (document.head || document.documentElement).append(style);
        }

        style.textContent = `
            .maximus-panel {
                position: relative !important;
                z-index: 9 !important;
                display: grid !important;
                grid-template-columns: max-content minmax(220px, 1fr);
                align-items: center;
                gap: 6px 8px;
                box-sizing: border-box !important;
                margin: 12px 0 4px 0 !important;
                padding: 8px 10px !important;
                width: 100% !important;
                max-width: 780px !important;
                border: 1px solid rgba(113, 131, 153, 0.45) !important;
                border-radius: 6px !important;
                background: rgba(248, 250, 252, 0.96) !important;
                color: #26394b !important;
                font: 12px Arial, sans-serif !important;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08) !important;
            }

            html[dark] .maximus-panel {
                background: rgba(24, 28, 34, 0.95) !important;
                border-color: #3d4f63 !important;
                color: #e2e8f0 !important;
            }

            .maximus-controles-izq {
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
                flex-wrap: wrap !important;
            }

            .maximus-boton,
            .maximus-barra {
                height: 32px !important;
                min-height: 32px !important;
                max-height: 32px !important;
                box-sizing: border-box !important;
                margin: 0 !important;
            }

            .maximus-boton {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 6px !important;
                padding: 0 11px !important;
                background: #fff !important;
                border: 1px solid #718399 !important;
                border-radius: 4px !important;
                color: #26394b !important;
                white-space: nowrap !important;
                cursor: pointer !important;
                font: 600 12px Arial, sans-serif !important;
                transition: background-color .15s, border-color .15s, color .15s;
            }

            .maximus-logo {
                width: 16px !important;
                height: 16px !important;
                flex: 0 0 16px !important;
                object-fit: contain !important;
                pointer-events: none !important;
                opacity: .9;
            }

            html[dark] .maximus-logo,
            html[darker-dark-theme] .maximus-logo,
            [dark] .maximus-logo {
                filter: invert(1);
            }

            html[dark] .maximus-boton {
                background: #222b35 !important;
                border-color: #64788f !important;
                color: #f1f5f9 !important;
            }

            .maximus-boton:hover:not(:disabled) {
                background: #f1f5f9 !important;
            }

            html[dark] .maximus-boton:hover:not(:disabled) {
                background: #2d3846 !important;
            }

            .maximus-boton.listo {
                background: #e8f8ee !important;
                border-color: #29aa59 !important;
                color: #166534 !important;
            }

            html[dark] .maximus-boton.listo {
                background: #143823 !important;
                border-color: #29aa59 !important;
                color: #86efac !important;
            }

            .maximus-boton.detener {
                background: #fee2e2 !important;
                border-color: #dc2626 !important;
                color: #991b1b !important;
                cursor: pointer !important;
            }

            html[dark] .maximus-boton.detener {
                background: #451a1a !important;
                border-color: #ef4444 !important;
                color: #fca5a5 !important;
            }

            .maximus-boton.captcha {
                background: #fef3c7 !important;
                border-color: #f59e0b !important;
                color: #92400e !important;
                font-weight: 700 !important;
                cursor: pointer !important;
                animation: maximus-parpadeo 1.2s infinite ease-in-out !important;
            }

            html[dark] .maximus-boton.captcha {
                background: #451a03 !important;
                border-color: #f59e0b !important;
                color: #fde68a !important;
            }

            .maximus-panel.alerta-captcha {
                border-color: #f59e0b !important;
                box-shadow: 0 0 14px rgba(245, 158, 11, 0.55) !important;
                animation: maximus-latido 1.6s infinite ease-in-out !important;
            }

            @keyframes maximus-latido {
                0%, 100% {
                    border-color: #f59e0b;
                    box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
                }
                50% {
                    border-color: #ef4444;
                    box-shadow: 0 0 18px rgba(239, 68, 68, 0.65);
                }
            }

            @keyframes maximus-parpadeo {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.75; }
            }

            .maximus-boton:disabled {
                opacity: .55 !important;
                cursor: not-allowed !important;
            }

            .maximus-btn-video {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 6px !important;
                cursor: pointer !important;
                font: 600 12px Arial, sans-serif !important;
                white-space: nowrap !important;
                color: #0f0f0f !important;
                background-color: rgba(0, 0, 0, 0.05) !important;
                border: 1px solid rgba(0, 0, 0, 0.1) !important;
                border-radius: 18px !important;
                padding: 0 14px !important;
                height: 36px !important;
                margin-inline-end: 8px !important;
                transition: background-color .15s, transform .1s !important;
            }

            html[dark] .maximus-btn-video,
            html[darker-dark-theme] .maximus-btn-video,
            [dark] .maximus-btn-video,
            ytd-app[dark] .maximus-btn-video {
                color: #f1f1f1 !important;
                background-color: rgba(255, 255, 255, 0.1) !important;
                border-color: rgba(255, 255, 255, 0.15) !important;
            }

            .maximus-btn-video:hover:not(:disabled) {
                background-color: rgba(0, 0, 0, 0.1) !important;
            }

            html[dark] .maximus-btn-video:hover:not(:disabled),
            [dark] .maximus-btn-video:hover:not(:disabled) {
                background-color: rgba(255, 255, 255, 0.2) !important;
            }

            .maximus-btn-video:disabled {
                opacity: .6 !important;
                cursor: not-allowed !important;
            }

            .maximus-btn-video.copiado {
                background-color: #10b981 !important;
                color: #ffffff !important;
                border-color: #059669 !important;
            }

            .maximus-btn-video.sin-subtitulos {
                background-color: #2563eb !important;
                color: #ffffff !important;
                border-color: #1d4ed8 !important;
            }

            .maximus-modos {
                display: inline-flex !important;
                align-items: center !important;
                border: 1px solid #94a3b8 !important;
                border-radius: 4px !important;
                overflow: hidden !important;
                height: 32px !important;
                box-sizing: border-box !important;
            }

            html[dark] .maximus-modos {
                border-color: #4b5d73 !important;
            }

            .maximus-modo-btn {
                height: 100% !important;
                padding: 0 8px !important;
                border: 0 !important;
                border-right: 1px solid #cbd5e1 !important;
                background: #f1f5f9 !important;
                color: #475569 !important;
                cursor: pointer !important;
                font: 600 11px Arial, sans-serif !important;
                white-space: nowrap !important;
            }

            .maximus-modo-btn:last-of-type {
                border-right: 0 !important;
            }

            html[dark] .maximus-modo-btn {
                background: #182029 !important;
                color: #94a3b8 !important;
                border-right-color: #334155 !important;
            }

            .maximus-modo-btn.activo {
                background: #26394b !important;
                color: #fff !important;
            }

            html[dark] .maximus-modo-btn.activo {
                background: #38bdf8 !important;
                color: #0f172a !important;
            }

            .maximus-input-ultimos {
                width: 48px !important;
                height: 100% !important;
                border: 0 !important;
                border-left: 1px solid #cbd5e1 !important;
                padding: 0 4px !important;
                text-align: center !important;
                font: 600 11px Arial, sans-serif !important;
                background: #fff !important;
                color: #1e293b !important;
                outline: none !important;
            }

            html[dark] .maximus-input-ultimos {
                background: #0f172a !important;
                color: #f8fafc !important;
                border-left-color: #334155 !important;
            }

            .maximus-barra {
                display: flex !important;
                gap: 0 !important;
                padding: 0 !important;
                min-width: 0 !important;
                position: relative !important;
                overflow: hidden !important;
                border: 1px solid #afbfcc !important;
                border-radius: 4px !important;
                background: #e8edf2 !important;
            }

            html[dark] .maximus-barra {
                background: #26313d !important;
                border-color: #4c6075 !important;
            }

            .maximus-pieza {
                flex: 1 1 0 !important;
                min-width: 0 !important;
                height: 100% !important;
                padding: 0 !important;
                margin: 0 !important;
                border: 0 !important;
                border-radius: 0 !important;
                background: #dbe3eb;
                transition: background-color .15s;
            }

            html[dark] .maximus-pieza {
                background: #2f3d4c;
            }

            .maximus-pieza.ok { background: #4dc86e !important; }
            .maximus-pieza.error { background: #ea5151 !important; }
            .maximus-pieza.sin-subtitulos { background: #3b82f6 !important; }
            .maximus-pieza.omitido { background: #3b82f6 !important; }
            .maximus-pieza.procesando { background: #f0c34f !important; }

            .maximus-pct {
                position: absolute !important;
                inset: 0 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                pointer-events: none !important;
                color: #1e293b !important;
                font: bold 11px Arial, sans-serif !important;
                text-shadow: 0 0 4px rgba(255, 255, 255, 0.95), 0 1px 2px #fff !important;
            }

            html[dark] .maximus-pct,
            html[darker-dark-theme] .maximus-pct,
            html[darker-dark-theme-deprecate] .maximus-pct,
            [dark] .maximus-pct,
            [darker-dark-theme] .maximus-pct,
            ytd-app[dark] .maximus-pct {
                color: #ffffff !important;
                text-shadow: none !important;
            }

            .maximus-pie {
                grid-column: 1 / -1 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 10px !important;
                min-width: 0 !important;
            }

            .maximus-estado {
                color: #52708b !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                font: 11px Arial, sans-serif !important;
                flex: 1 1 auto !important;
            }

            html[dark] .maximus-estado {
                color: #9fb3c8 !important;
            }

            .maximus-log {
                padding: 0 !important;
                border: 0 !important;
                background: transparent !important;
                color: #26618f !important;
                cursor: pointer !important;
                text-decoration: underline !important;
                font: 600 11px Arial, sans-serif !important;
                white-space: nowrap !important;
            }

            html[dark] .maximus-log {
                color: #60a5fa !important;
            }

            .maximus-fila-ok {
                background: rgba(41, 170, 89, 0.14) !important;
                box-shadow: inset 4px 0 #29aa59 !important;
                border-radius: 8px !important;
            }

            .maximus-fila-error {
                background: rgba(211, 63, 69, 0.16) !important;
                box-shadow: inset 4px 0 #d33f45 !important;
                border-radius: 8px !important;
            }

            .maximus-fila-sin-subtitulos,
            .maximus-fila-omitido {
                background: rgba(59, 130, 246, 0.18) !important;
                box-shadow: inset 4px 0 #3b82f6 !important;
                border-radius: 8px !important;
            }

            @media (max-width: 720px) {
                .maximus-panel {
                    grid-template-columns: 1fr !important;
                }
            }
        `;
    }

    function progreso(pc, n, total, mensaje) {
        if (!pc?.pct || !pc?.estado) return;
        const pctNum = total ? Math.round((n / total) * 100) : 0;
        pc.pct.textContent = total ? `${pctNum}% (${n}/${total})` : '0%';
        pc.estado.textContent = mensaje;
        pc.estado.title = mensaje;
    }

    function crearPiezas(pc, items) {
        if (!pc?.barra) return;
        pc.barra.querySelectorAll('.maximus-pieza').forEach(x => x.remove());

        const maxSegmentos = Math.min(items.length, 300);
        pc.totalItemsBarra = items.length;
        pc.piezas = [];

        for (let s = 0; s < maxSegmentos; s++) {
            const x = document.createElement('span');
            x.className = 'maximus-pieza';
            pc.barra.insertBefore(x, pc.pct);
            pc.piezas.push(x);
        }
    }

    function pieza(pc, i, estadoPieza, nombre, detalle = '') {
        if (!pc?.piezas?.length) return;
        const total = pc.totalItemsBarra || pc.piezas.length;
        const idxVisual = Math.min(
            pc.piezas.length - 1,
            Math.floor((i / Math.max(1, total)) * pc.piezas.length)
        );
        const nodo = pc.piezas[idxVisual];
        if (!nodo) return;
        nodo.className = `maximus-pieza ${estadoPieza}`;
        nodo.title = `${i + 1}. ${nombre}: ${detalle || estadoPieza}`;
    }

    function buscarAnclaDebajoSuscribirse(raiz) {
        const scope = raiz || document;

        const accionesHeader = scope.querySelector(
            'yt-page-header-view-model yt-flexible-actions-view-model, ' +
                'yt-page-header-view-model .ytPageHeaderViewModelFlexibleActions, ' +
                'yt-page-header-view-model .ytFlexibleActionsViewModelHost, ' +
                'yt-page-header-renderer yt-flexible-actions-view-model, ' +
                '#page-header yt-flexible-actions-view-model, ' +
                '#page-header .ytPageHeaderViewModelFlexibleActions, ' +
                '#page-header .ytFlexibleActionsViewModelHost'
        );
        if (accionesHeader?.parentElement) {
            return { contenedor: accionesHeader.parentElement, referenciaDespuesDe: accionesHeader };
        }

        const infoHeader = scope.querySelector(
            '.ytPageHeaderViewModelHeadlineInfo, ' +
                '.yt-page-header-view-model__page-header-headline-info, ' +
                '.page-header-view-model-wiz__page-header-headline-info, ' +
                'yt-page-header-view-model .ytPageHeaderViewModelContent, ' +
                'yt-page-header-view-model, ' +
                '#page-header'
        );
        if (infoHeader) {
            return { contenedor: infoHeader, referenciaDespuesDe: null };
        }

        const clasico = scope.querySelector('#inner-header-container, #channel-header-container');
        if (clasico) {
            return { contenedor: clasico, referenciaDespuesDe: null };
        }

        return null;
    }

    function insertarPanelEnAncla(panel, ancla) {
        if (ancla.referenciaDespuesDe && ancla.referenciaDespuesDe.parentElement) {
            ancla.referenciaDespuesDe.insertAdjacentElement('afterend', panel);
        } else if (ancla.contenedor) {
            ancla.contenedor.appendChild(panel);
        }
    }

    // --- Módulo 11: Montaje de panel, botones de video/Shorts y arranque SPA ---

    // Orquestador principal: panel de canal, cola concurrente, botones en videos/Shorts y arranque SPA.


    function actualizarResumenEstadoModo(pc) {
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

    function actualizarConteoEnPantallaUI() {
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

    async function descubrirTotalesCanalEnSegundoPlano(pc) {
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

    function empaquetarYDescargarZipFinal(
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

    async function ejecutarDescargaCanal(pc) {
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

    function montarPanelCanal() {
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

    function obtenerInfoPaginaActual() {
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

    async function descargarTranscripcionVideoActual(botonEl, info) {
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

    function montarBotonVideoSuelto() {
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

    function agendar() {
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

    function iniciar() {
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
})();
