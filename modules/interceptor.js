// Captura en vivo de parámetros PO Token, respuestas timedtext y mensajes entre ventanas.

import { POT_CARRIED_PARAM_NAMES, estado, guardarEnMapaConLimite } from './config.js';

let receptorMensajesRegistrado = false;

export function recordarPotDeTimedtextUrl(rawUrl) {
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

export function recordarCuerpoSubtitulo(rawUrl, bodyText) {
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
export function instalarHooksPotUnaVez() {
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

export function registrarReceptorMensajesVentana() {
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
