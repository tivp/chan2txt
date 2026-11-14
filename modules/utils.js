// Funciones de texto, DOM, tiempos ETA, parseo JSON y comunicación con el mundo MAIN.

import { estado } from './config.js';

export const dormir = ms => new Promise(resolve => setTimeout(resolve, ms));

export function crearElemento(tag, props = {}, hijos = []) {
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

export const texto = value =>
    String(value ?? '')
        .replace(/[\u200b-\u200d\ufeff\u00a0]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

export const canon = value => texto(value).toLocaleLowerCase('es');

export const seguro = (value, defecto = 'Sin titulo') => {
    const nombre = texto(value)
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[. ]+$/g, '')
        .slice(0, 140);

    return nombre || defecto;
};

export const clonarBytes = src => {
    if (!src) return new Uint8Array(0);
    const vista = src instanceof Uint8Array ? src : new Uint8Array(src);
    const limpio = new Uint8Array(vista.byteLength);
    limpio.set(vista);
    return limpio;
};

export function descargarBlob(bytes, nombreArchivo, mimeType = 'text/plain;charset=utf-8') {
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

export async function copiarAlPortapapeles(contenido) {
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

export function formatearTiempoRestante(segundosTotales) {
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

export function calcularEta(procesados, total, tiempoInicioMs) {
    if (procesados < 2 || total <= procesados) return '';
    const segundosTranscurridos = (Date.now() - tiempoInicioMs) / 1000;
    if (segundosTranscurridos < 2) return '';
    const velocidad = procesados / segundosTranscurridos;
    if (velocidad <= 0) return '';
    const segundosRestantes = (total - procesados) / velocidad;
    return formatearTiempoRestante(segundosRestantes);
}

export function extraerJsonBalanceadoDesdeIndice(str, idxInicioLlave) {
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

export function extraerJsonBalanceado(html, marcador) {
    const idx = html.indexOf(marcador);
    if (idx === -1) return null;
    return extraerJsonBalanceadoDesdeIndice(html, idx + marcador.length);
}

export function extraerYtInitialDataDeHtml(html) {
    return (
        extraerJsonBalanceado(html, 'var ytInitialData =') ||
        extraerJsonBalanceado(html, 'window["ytInitialData"] =') ||
        extraerJsonBalanceado(html, 'ytInitialData =')
    );
}

// Consulta al mundo MAIN mediante eventos síncronos del DOM cuando el script corre aislado (extensión MV3).
export function solicitarEstadoPaginaMain(accion, extra = {}) {
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
export function obtenerSnapshotPagina(videoId = '') {
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

export function activarSubtitulosMoviePlayer(silenciar = false) {
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
