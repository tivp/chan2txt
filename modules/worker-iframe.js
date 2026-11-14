// Pool de iframes ocultos /watch?v=ID&maximus_worker=1 para extraer pistas y transcripciones reales del DOM.

import { CFG, estado, verificarCancelacion } from './config.js';
import { activarSubtitulosMoviePlayer, dormir, obtenerSnapshotPagina } from './utils.js';

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

export async function ejecutarAgenteIframeTrabajador() {
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

export function destruirIframeSeguro(iframe) {
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

export function limpiarTodosLosIframesTrabajadores() {
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

export async function extraerMedianteIframeWatchReal(videoId, timeoutMs = CFG.TIMEOUT_IFRAME) {
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
