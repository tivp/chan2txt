import {
    win,
    CFG,
    esIframeTrabajador,
    _potParamsByVideoId,
    _subtitulosCachePorVideoId,
    _transcriptJsonPorVideoId,
    callbacksWorkersIframe,
    iframesActivosSet
} from './config.js';
import { _potLatestParams } from './interceptor.js';
import { verificarCancelacion } from './main.js';

// ==================================================
// MODO AGENTE DENTRO DEL IFRAME TRABAJADOR (/watch?v=ID&maximus_worker=1)
// ==================================================
if (esIframeTrabajador) {
    const paramsUrl = new URLSearchParams(location.search);
    const workerVideoId = paramsUrl.get('v') || '';

    const silenciarBuffersDeVideo = () => {
        try {
            const vids = document.getElementsByTagName('video');
            for (let i = 0; i < vids.length; i++) {
                const v = vids[i];
                v.muted = true;
                v.volume = 0;
            }
        } catch {}
    };

    const buscarParamTranscriptEnObjeto = raiz => {
        if (!raiz) return '';
        try {
            const str = typeof raiz === 'string' ? raiz : JSON.stringify(raiz);
            const m = str.match(/"getTranscriptEndpoint"\s*:\s*\{\s*"params"\s*:\s*"([^"]+)"/);
            return m?.[1] || '';
        } catch {
            return '';
        }
    };

    const intentarExtraccionDesdeAdentroDelIframe = async () => {
        const inicio = Date.now();
        let pr = null;
        let initData = null;
        let player = null;

        while (Date.now() - inicio < 10000) {
            silenciarBuffersDeVideo();
            player = win.document?.getElementById('movie_player');
            pr = player?.getPlayerResponse?.() || win.ytInitialPlayerResponse;
            initData = win.ytInitialData;

            if (pr && (pr.videoDetails?.videoId === workerVideoId || pr.captions || pr.playabilityStatus)) {
                break;
            }
            await new Promise(r => setTimeout(r, 150));
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

        let transcriptParams = buscarParamTranscriptEnObjeto(initData);

        // 1. Si hay transcriptParams en ytInitialData, disparar get_transcript desde el contexto first-party del iframe
        if (transcriptParams) {
            try {
                const apiKey = win.ytcfg?.get?.('INNERTUBE_API_KEY') || '';
                const ctx = win.ytcfg?.get?.('INNERTUBE_CONTEXT') || {
                    client: {
                        clientName: 'WEB',
                        clientVersion: win.ytcfg?.get?.('INNERTUBE_CLIENT_VERSION') || '2.20260401.01.00',
                        hl: 'es'
                    }
                };
                const visitorData = win.ytcfg?.get?.('VISITOR_DATA') || ctx?.client?.visitorData || '';
                const headersTr = {
                    'Content-Type': 'application/json',
                    'X-Youtube-Client-Name': String(win.ytcfg?.get?.('INNERTUBE_CONTEXT_CLIENT_NAME') || 1),
                    'X-Youtube-Client-Version': String(win.ytcfg?.get?.('INNERTUBE_CLIENT_VERSION') || '2.20260401.01.00')
                };
                if (visitorData) headersTr['X-Goog-Visitor-Id'] = visitorData;

                const resTr = await win.fetch(`https://www.youtube.com/youtubei/v1/get_transcript?prettyPrint=false${apiKey ? `&key=${apiKey}` : ''}`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: headersTr,
                    body: JSON.stringify({
                        context: ctx,
                        params: transcriptParams
                    })
                });
                if (resTr.ok) {
                    const jsonTr = await resTr.text();
                    if (jsonTr && (jsonTr.includes('transcriptSegment') || jsonTr.includes('macroMarkersPanelItem'))) {
                        window.parent.postMessage({
                            type: 'MAXIMUS_WORKER_DONE',
                            videoId: workerVideoId,
                            noTieneSubtitulos: false,
                            titulo,
                            fecha,
                            pistas,
                            rawTranscriptJson: jsonTr
                        }, '*');
                        return;
                    }
                }
            } catch {}
        }

        // 2. Activar subtítulos y clic en botón CC / Panel de transcripción real del DOM del iframe
        try {
            if (player) {
                player.mute?.();
                player.loadModule?.('captions');
                player.loadModule?.('cc');
                const tracklist = player.getOption?.('captions', 'tracklist') || [];
                if (tracklist.length > 0 && pistas.length === 0) {
                    pistas = tracklist;
                }
                const trackEsp = tracklist.find(t => /^es/i.test(t.languageCode)) || tracklist[0];
                if (trackEsp) {
                    player.setOption?.('captions', 'track', trackEsp);
                }
            }
            const btnCc = document.querySelector('.ytp-subtitles-button[aria-pressed="false"]');
            if (btnCc) btnCc.click();

            const btnTranscriptDom = document.querySelector(
                'ytd-video-description-transcript-section-renderer button, button[aria-label*="transcripci" i], button[aria-label*="transcript" i]'
            );
            if (btnTranscriptDom) btnTranscriptDom.click();
        } catch {}

        // 3. Esperar hasta 3.8s por captura en vivo (de get_transcript o de timedtext con PO Token real)
        const esperaCache = Date.now();
        while (Date.now() - esperaCache < 3800) {
            silenciarBuffersDeVideo();

            if (_transcriptJsonPorVideoId.has(workerVideoId)) {
                window.parent.postMessage({
                    type: 'MAXIMUS_WORKER_DONE',
                    videoId: workerVideoId,
                    noTieneSubtitulos: false,
                    titulo,
                    fecha,
                    pistas,
                    rawTranscriptJson: _transcriptJsonPorVideoId.get(workerVideoId),
                    potParams: _potParamsByVideoId.get(workerVideoId) || _potLatestParams
                }, '*');
                return;
            }

            if (_subtitulosCachePorVideoId.has(workerVideoId)) {
                window.parent.postMessage({
                    type: 'MAXIMUS_WORKER_DONE',
                    videoId: workerVideoId,
                    noTieneSubtitulos: false,
                    titulo,
                    fecha,
                    pistas,
                    rawTimedtextPayload: _subtitulosCachePorVideoId.get(workerVideoId),
                    potParams: _potParamsByVideoId.get(workerVideoId) || _potLatestParams
                }, '*');
                return;
            }

            // Verificar si se renderizaron segmentos directamente en el DOM del panel de transcripción
            const segsDom = document.querySelectorAll('ytd-transcript-segment-renderer, transcript-segment-view-model');
            if (segsDom.length > 0) {
                const domCues = [];
                segsDom.forEach(nodo => {
                    const tTxt = nodo.querySelector('.segment-timestamp, [class*="timestamp"]')?.textContent?.trim() || '0:00';
                    const bTxt = nodo.querySelector('.segment-text, yt-formatted-string, [class*="segment-text"]')?.textContent?.trim() || '';
                    if (bTxt) domCues.push({ tTxt, bTxt });
                });
                if (domCues.length > 0) {
                    window.parent.postMessage({
                        type: 'MAXIMUS_WORKER_DONE',
                        videoId: workerVideoId,
                        noTieneSubtitulos: false,
                        titulo,
                        fecha,
                        pistas,
                        domTranscriptCues: domCues
                    }, '*');
                    return;
                }
            }

            await new Promise(r => setTimeout(r, 140));
        }

        // Re-verificar pistas del player por si cargaron tarde
        if (pistas.length === 0 && player?.getPlayerResponse) {
            const prLate = player.getPlayerResponse();
            pistas =
                prLate?.captions?.playerCaptionsTracklistRenderer?.captionTracks ||
                prLate?.captions?.playerCaptionsRenderer?.captionTracks ||
                [];
        }

        if (pistas.length === 0 && !transcriptParams) {
            window.parent.postMessage({
                type: 'MAXIMUS_WORKER_DONE',
                videoId: workerVideoId,
                noTieneSubtitulos: true,
                titulo,
                fecha,
                playabilityStatus
            }, '*');
            return;
        }

        // 4. Descargar directamente la pista desde adentro del iframe
        const esEspanol = code => /^es(?:-|$)/i.test(String(code || ''));
        const elegida =
            pistas.find(t => esEspanol(t.languageCode) && t.kind !== 'asr') ||
            pistas.find(t => esEspanol(t.languageCode) && t.kind === 'asr') ||
            pistas.find(t => t.kind !== 'asr') ||
            pistas[0];

        if (elegida?.baseUrl) {
            let urlPista = elegida.baseUrl.replace(/\\u0026/g, '&');
            if (!esEspanol(elegida.languageCode)) {
                urlPista += (urlPista.includes('?') ? '&' : '?') + 'tlang=es';
            }
            const pot = _potParamsByVideoId.get(workerVideoId) || _potLatestParams;
            if (pot) {
                for (const [k, v] of Object.entries(pot)) {
                    if (!urlPista.includes(`${k}=`)) {
                        urlPista += `&${k}=${encodeURIComponent(v)}`;
                    }
                }
            }
            for (const sufijo of ['', '&fmt=json3', '&fmt=srv1', '&fmt=vtt']) {
                try {
                    const r = await win.fetch(urlPista + sufijo, { credentials: 'include' });
                    if (r.ok) {
                        const txt = await r.text();
                        if (txt && txt.trim().length > 20 && !txt.includes('<!DOCTYPE')) {
                            window.parent.postMessage({
                                type: 'MAXIMUS_WORKER_DONE',
                                videoId: workerVideoId,
                                noTieneSubtitulos: false,
                                titulo,
                                fecha,
                                pistas,
                                pistaElegida: elegida,
                                rawTimedtextPayload: txt,
                                potParams: pot
                            }, '*');
                            return;
                        }
                    }
                } catch {}
            }
        }

        window.parent.postMessage({
            type: 'MAXIMUS_WORKER_DONE',
            videoId: workerVideoId,
            noTieneSubtitulos: false,
            titulo,
            fecha,
            pistas,
            transcriptParams,
            potParams: _potParamsByVideoId.get(workerVideoId) || _potLatestParams
        }, '*');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', intentarExtraccionDesdeAdentroDelIframe, { once: true });
    } else {
        intentarExtraccionDesdeAdentroDelIframe();
    }
}

let iframesEnCurso = 0;

// ==================================================
// POOL DE IFRAMES /WATCH EN SIMULTÁNEO
// ==================================================

export function destruirIframeSeguro(iframe) {
    if (!iframe) return;
    iframesActivosSet.delete(iframe);
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
            } catch {}
            try {
                iframe.contentWindow.stop?.();
            } catch {}
        }
        iframe.src = 'about:blank';
        if (iframe.contentDocument?.body) {
            iframe.contentDocument.body.textContent = '';
        }
    } catch {}
    setTimeout(() => {
        try {
            iframe.remove();
        } catch {}
    }, 40);
}

export function limpiarTodosLosIframesTrabajadores() {
    for (const iframe of iframesActivosSet) {
        destruirIframeSeguro(iframe);
    }
    iframesActivosSet.clear();
    for (const [, res] of callbacksWorkersIframe) {
        try { res(null); } catch {}
    }
    callbacksWorkersIframe.clear();
    iframesEnCurso = 0;
}

export async function extraerMedianteIframeWatchReal(videoId, timeoutMs = CFG.TIMEOUT_IFRAME) {
    verificarCancelacion();

    while (iframesEnCurso >= CFG.MAX_IFRAMES_SIMULTANEOS) {
        verificarCancelacion();
        await new Promise(r => setTimeout(r, 120));
    }

    iframesEnCurso++;

    return new Promise(resolve => {
        let finalizado = false;
        let iframe = null;
        let timer = null;

        const terminar = resultado => {
            if (finalizado) return;
            finalizado = true;
            clearTimeout(timer);
            callbacksWorkersIframe.delete(videoId);
            iframesEnCurso = Math.max(0, iframesEnCurso - 1);
            destruirIframeSeguro(iframe);
            resolve(resultado);
        };

        callbacksWorkersIframe.set(videoId, datos => {
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
            iframesActivosSet.add(iframe);
            (document.body || document.documentElement).appendChild(iframe);
        } catch {
            terminar(null);
        }
    });
}
