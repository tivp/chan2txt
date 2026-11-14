// Corre en el mundo MAIN para interceptar timedtext/get_transcript y exponer ytcfg, ytInitialData y #movie_player.

(() => {
    'use strict';

    const esIframe = typeof window !== 'undefined' && window.top !== window.self;
    const esIframeTrabajador = esIframe && location.search.includes('maximus_worker=1');

    if (esIframe && !esIframeTrabajador) {
        return;
    }

    if (window.__chan2txtPageHookReady) {
        return;
    }
    window.__chan2txtPageHookReady = true;

    if (document.documentElement) {
        document.documentElement.dataset.chan2txtPageHook = '1';
    }

    const POT_PARAMS = [
        'pot', 'potc', 'c', 'cver', 'cplayer', 'cos', 'cosver',
        'cplatform', 'cbr', 'cbrver', 'xorb', 'xobt', 'xovt'
    ];

    function emitirTimedtextPot(rawUrl) {
        try {
            if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.includes('/api/timedtext')) return;
            const u = new URL(rawUrl, 'https://www.youtube.com');
            const videoId = u.searchParams.get('v');
            const pot = u.searchParams.get('pot');
            if (!pot) return;

            const collected = {};
            for (const name of POT_PARAMS) {
                const val = u.searchParams.get(name);
                if (val !== null && val !== '') collected[name] = val;
            }

            const msg = {
                type: 'MAXIMUS_POT_CAPTURED',
                videoId,
                potParams: collected
            };
            window.postMessage(msg, '*');
            if (esIframeTrabajador && window.parent && window.parent !== window) {
                window.parent.postMessage(msg, '*');
            }
        } catch {
            // Ignorar URLs inválidas.
        }
    }

    function emitirCuerpoSubtitulo(rawUrl, bodyText) {
        try {
            if (!rawUrl || typeof rawUrl !== 'string') return;
            if (typeof bodyText !== 'string' || bodyText.trim().length < 15 || bodyText.length > 2500000) return;

            if (rawUrl.includes('/api/timedtext')) {
                const u = new URL(rawUrl, 'https://www.youtube.com');
                const videoId = u.searchParams.get('v');
                if (!videoId) return;

                const msg = {
                    type: 'MAXIMUS_SUBTITLE_CAPTURED',
                    videoId,
                    rawPayload: bodyText
                };
                window.postMessage(msg, '*');
                if (esIframeTrabajador && window.parent && window.parent !== window) {
                    window.parent.postMessage(msg, '*');
                }
            } else if (rawUrl.includes('/youtubei/v1/get_transcript')) {
                const vidActual = new URLSearchParams(location.search).get('v') || '';
                if (
                    vidActual &&
                    (bodyText.includes('transcriptSegment') || bodyText.includes('macroMarkersPanelItem'))
                ) {
                    const msg = {
                        type: 'MAXIMUS_TRANSCRIPT_JSON_CAPTURED',
                        videoId: vidActual,
                        rawTranscriptJson: bodyText
                    };
                    window.postMessage(msg, '*');
                    if (esIframeTrabajador && window.parent && window.parent !== window) {
                        window.parent.postMessage(msg, '*');
                    }
                }
            }
        } catch {
            // Ignorar errores al clonar cuerpos no textuales.
        }
    }

    try {
        const origFetch = window.fetch;
        if (typeof origFetch === 'function') {
            window.fetch = function (...args) {
                try {
                    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
                    if (
                        url &&
                        typeof url === 'string' &&
                        (url.includes('/api/timedtext') || url.includes('/youtubei/v1/get_transcript'))
                    ) {
                        if (url.includes('/api/timedtext')) emitirTimedtextPot(url);
                        const p = origFetch.apply(this, args);
                        p.then(res => {
                            if (res && res.ok) {
                                res
                                    .clone()
                                    .text()
                                    .then(b => emitirCuerpoSubtitulo(url, b))
                                    .catch(() => {});
                            }
                        }).catch(() => {});
                        return p;
                    }
                } catch {
                    // Continuar con fetch original.
                }
                return origFetch.apply(this, args);
            };
        }

        const xhrProto = window.XMLHttpRequest?.prototype;
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
                        if (url.includes('/api/timedtext')) emitirTimedtextPot(url);
                        this.addEventListener(
                            'loadend',
                            function () {
                                try {
                                    if (this.status === 200 && typeof this.responseText === 'string') {
                                        emitirCuerpoSubtitulo(url, this.responseText);
                                    }
                                } catch {
                                    // Ignorar respuestas binarias.
                                }
                            },
                            { once: true }
                        );
                    }
                } catch {
                    // No interferir con peticiones de YouTube.
                }
                return origOpen.apply(this, args);
            };
        }
    } catch {
        // Entorno donde no se permite reasignar fetch/XHR.
    }

    function leerYtcfgSeguro() {
        const get = k => {
            try {
                return window.ytcfg?.get?.(k) ?? window.ytcfg?.data_?.[k];
            } catch {
                return undefined;
            }
        };
        const ctx = get('INNERTUBE_CONTEXT') || null;
        return {
            apiKey: get('INNERTUBE_API_KEY') || '',
            clientVersion: get('INNERTUBE_CLIENT_VERSION') || ctx?.client?.clientVersion || '2.20260401.01.00',
            clientName: get('INNERTUBE_CONTEXT_CLIENT_NAME') || 1,
            visitorData: get('VISITOR_DATA') || ctx?.client?.visitorData || '',
            sessionIndex: String(get('SESSION_INDEX') ?? '0'),
            delegatedSessionId: get('DELEGATED_SESSION_ID') || '',
            sts: get('STS') || null,
            channelId: get('CHANNEL_ID') || '',
            fullContext: ctx
        };
    }

    // Responde de forma síncrona a los módulos que corren en ISOLATED o USER_SCRIPT.
    window.addEventListener('chan2txt-req', ev => {
        let req = null;
        try {
            req = typeof ev.detail === 'string' ? JSON.parse(ev.detail) : ev.detail;
        } catch {
            return;
        }
        if (!req?.reqId || !req?.accion) return;

        let resultado = null;

        if (req.accion === 'GET_SNAPSHOT') {
            const player = document.getElementById('movie_player');
            let pr = null;
            try {
                pr = player?.getPlayerResponse?.() || window.ytInitialPlayerResponse || null;
            } catch {
                pr = window.ytInitialPlayerResponse || null;
            }
            const initData = window.ytInitialData || null;
            resultado = {
                ytcfg: leerYtcfgSeguro(),
                pr,
                initData
            };
        } else if (req.accion === 'ACTIVATE_CAPTIONS') {
            const player = document.getElementById('movie_player');
            let tracklist = [];
            if (player) {
                try {
                    if (req.silenciar) player.mute?.();
                    player.loadModule?.('captions');
                    player.loadModule?.('cc');
                    tracklist = player.getOption?.('captions', 'tracklist') || [];
                    const trackEsp = tracklist.find(t => /^es/i.test(t.languageCode)) || tracklist[0];
                    if (trackEsp) {
                        player.setOption?.('captions', 'track', trackEsp);
                    }
                } catch {
                    tracklist = [];
                }
            }
            resultado = { tracklist };
        }

        let serializado = 'null';
        try {
            serializado = JSON.stringify(resultado);
        } catch {
            serializado = JSON.stringify({ ytcfg: leerYtcfgSeguro(), pr: null, initData: null });
        }

        window.dispatchEvent(
            new CustomEvent(`chan2txt-res-${req.reqId}`, {
                detail: serializado
            })
        );
    });
})();
