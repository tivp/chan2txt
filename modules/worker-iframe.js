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
import { _potLatestParams, _esAnuncioEnReproductor } from './interceptor.js';
import { generarParamsProtobufGetPanel, elegirPistaSubtitulo } from './subtitles.js';
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

        if (paramsUrl.get('maximus_audio') === '1') {
            await capturarAudioSourceBufferEnIframe({
                workerVideoId,
                player,
                titulo,
                fecha,
                playabilityStatus,
                silenciarBuffersDeVideo
            });
            return;
        }

        let pistas =
            pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks ||
            pr?.captions?.playerCaptionsRenderer?.captionTracks ||
            [];

        let transcriptParams = buscarParamTranscriptEnObjeto(initData);

        // 1. Intentar get_panel (PAmodern_transcript_view) y get_transcript desde el contexto first-party del iframe
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

            const paramsPanelIframe = generarParamsProtobufGetPanel(workerVideoId);
            if (paramsPanelIframe) {
                const resPanel = await win.fetch(`https://www.youtube.com/youtubei/v1/get_panel?prettyPrint=false${apiKey ? `&key=${apiKey}` : ''}`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: headersTr,
                    body: JSON.stringify({
                        context: ctx,
                        panelId: 'PAmodern_transcript_view',
                        params: paramsPanelIframe
                    })
                });
                if (resPanel.ok) {
                    const jsonPanel = await resPanel.text();
                    if (jsonPanel && (jsonPanel.includes('transcriptSegment') || jsonPanel.includes('transcriptCue'))) {
                        window.parent.postMessage({
                            type: 'MAXIMUS_WORKER_DONE',
                            videoId: workerVideoId,
                            noTieneSubtitulos: false,
                            titulo,
                            fecha,
                            pistas,
                            rawTranscriptJson: jsonPanel
                        }, '*');
                        return;
                    }
                }
            }

            if (transcriptParams) {
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
                    if (jsonTr && (jsonTr.includes('transcriptSegment') || jsonTr.includes('transcriptCue'))) {
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
            }
        } catch {}

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

            const btnExpand = document.querySelector('#description-inline-expander #expand, ytd-text-inline-expander #expand');
            if (btnExpand) btnExpand.click();

            const btnTranscriptDom = document.querySelector(
                'ytd-video-description-transcript-section-renderer button, button[aria-label*="Mostrar transcripci" i], button[aria-label*="Show transcript" i], button[aria-label*="transcripci" i], button[aria-label*="transcript" i]'
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
                    const tTxt = nodo.querySelector('.segment-timestamp, .ytwTranscriptSegmentViewModelTimestamp, [class*="Timestamp"], [class*="timestamp"]')?.textContent?.trim() || '0:00';
                    const bTxt = nodo.querySelector('.segment-text, yt-formatted-string, span[role="text"], .yt-core-attributed-string, [class*="segment-text"]')?.textContent?.trim() || '';
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
        const elegida = elegirPistaSubtitulo(pistas);

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

    async function capturarAudioSourceBufferEnIframe({
        workerVideoId,
        player,
        titulo,
        fecha,
        playabilityStatus,
        silenciarBuffersDeVideo
    }) {
        const responder = payload => {
            window.parent.postMessage(
                {
                    type: 'MAXIMUS_WORKER_DONE',
                    videoId: workerVideoId,
                    esAudioCaptura: true,
                    titulo,
                    fecha,
                    playabilityStatus,
                    ...payload
                },
                '*',
                payload.audioBuffer instanceof ArrayBuffer ? [payload.audioBuffer] : undefined
            );
        };

        try {
            const durEsperada = Math.max(0, Number(paramsUrl.get('maximus_dur') || 0));
            const clicarSaltarAnuncio = () => {
                const adBtn = document.querySelector(
                    '.ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern'
                );
                if (adBtn) adBtn.click();
            };

            const adelantarAnuncioEnIframe = (videoEl, playerEl) => {
                clicarSaltarAnuncio();
                try {
                    if (videoEl) {
                        videoEl.playbackRate = 16;
                        if (
                            Number.isFinite(videoEl.duration) &&
                            videoEl.duration > 0.6 &&
                            videoEl.currentTime < videoEl.duration - 0.25
                        ) {
                            videoEl.currentTime = videoEl.duration - 0.1;
                        }
                    }
                    const state = playerEl?.getPlayerState?.();
                    if (state !== 1 && state !== 3) playerEl?.playVideo?.();
                } catch {}
            };

            let v = null;
            let mp = player || win.document?.getElementById('movie_player');
            for (let i = 0; i < 300; i++) {
                v = document.querySelector('video');
                mp = mp || win.document?.getElementById('movie_player');
                silenciarBuffersDeVideo();
                try {
                    mp?.mute?.();
                    mp?.setPlaybackQualityRange?.('tiny', 'tiny');
                    mp?.setPlaybackQuality?.('tiny');
                    const state = mp?.getPlayerState?.();
                    if (state !== 1 && state !== 3) mp?.playVideo?.();
                } catch {}
                const ad = _esAnuncioEnReproductor(mp, workerVideoId);
                if (ad) {
                    adelantarAnuncioEnIframe(v, mp);
                } else if (v && v.playbackRate !== 1) {
                    try {
                        v.playbackRate = 1;
                    } catch {}
                }
                const durActual = Number(v?.duration || 0);
                const durCoincide =
                    durActual > 0 &&
                    (durEsperada <= 12 || durActual >= durEsperada * 0.72);
                if (v && !ad && Number.isFinite(durActual) && durCoincide) break;
                await new Promise(r => setTimeout(r, 150));
            }

            if (!v || !Number.isFinite(v.duration) || v.duration <= 0) {
                responder({ error: 'Video sin duración reproducible en iframe' });
                return;
            }
            try {
                v.playbackRate = 1;
            } catch {}

            const esBufferVivo = ent => {
                if (!ent?.sb) return false;
                if (ent.ms && ent.ms.readyState === 'closed') return false;
                try {
                    void ent.sb.buffered;
                    return true;
                } catch {
                    return false;
                }
            };
            const seleccionarEntradaAudio = capState => {
                let mejor = esBufferVivo(capState?.activeEntry) ? capState.activeEntry : null;
                if (capState?.entries?.size) {
                    for (const ent of capState.entries.values()) {
                        if (!esBufferVivo(ent)) continue;
                        if (!mejor || (ent?.bytes || 0) > (mejor?.bytes || 0)) {
                            mejor = ent;
                        }
                    }
                    if (!mejor) {
                        for (const ent of capState.entries.values()) {
                            if (!mejor || (ent?.bytes || 0) > (mejor?.bytes || 0)) {
                                mejor = ent;
                            }
                        }
                    }
                }
                return mejor || capState?.activeEntry || null;
            };
            const leerMaxEndSeguro = (sb, videoEl) => {
                let max = 0;
                const leerRanges = r => {
                    for (let b = 0; b < (r?.length || 0); b++) {
                        if (r.end(b) > max) max = r.end(b);
                    }
                };
                try {
                    if (sb?.buffered?.length) leerRanges(sb.buffered);
                } catch {}
                if (max <= 0) {
                    try {
                        if (videoEl?.buffered?.length) leerRanges(videoEl.buffered);
                    } catch {}
                }
                return max;
            };

            let lastEnd = -1;
            let lastBytes = 0;
            let stalls = 0;
            let lastSeekAt = 0;
            let lastSeekEnd = -1;

            for (let step = 0; step < 480; step++) {
                silenciarBuffersDeVideo();
                if (_esAnuncioEnReproductor(mp, workerVideoId)) {
                    adelantarAnuncioEnIframe(v, mp);
                    await new Promise(r => setTimeout(r, 250));
                    continue;
                }

                const curEntry = seleccionarEntradaAudio(win.__chan2txtAudioCap);
                const maxEnd = leerMaxEndSeguro(curEntry?.sb, v);

                const curBytes = curEntry?.bytes || 0;
                const liveDur = Number(v.duration) || 0;
                const bytesGrew = curBytes > lastBytes + 64;
                const endGrew = maxEnd > lastEnd + 0.05;

                if (!endGrew && !bytesGrew) stalls++;
                else stalls = 0;
                lastEnd = maxEnd;
                lastBytes = curBytes;

                if (!Number.isFinite(liveDur) || maxEnd >= liveDur - 1.5 || stalls >= 40) {
                    break;
                }

                const ahora = Date.now();
                const bufferAvanzoDesdeUltimoSeek = maxEnd > lastSeekEnd + 1.0;
                const reintentoPorPausa = !bytesGrew && stalls >= 10 && stalls % 10 === 0;
                const cooldownListo = ahora - lastSeekAt >= 900;

                // Solo hacer seek cuando el buffer avanzó (o tras estancamiento real) para no abortar descargas en curso.
                if (cooldownListo && (lastSeekAt === 0 || bufferAvanzoDesdeUltimoSeek || reintentoPorPausa)) {
                    const saltoExtra = reintentoPorPausa ? Math.min(20, (stalls / 10) * 6) : 0;
                    const nextT = Math.min(liveDur - 0.5, maxEnd + 0.5 + saltoExtra);
                    if (nextT >= liveDur - 1 && maxEnd >= liveDur - 5) break;
                    lastSeekAt = ahora;
                    lastSeekEnd = maxEnd;
                    try {
                        if (typeof mp?.seekTo === 'function') mp.seekTo(nextT, true);
                        else v.currentTime = nextT;
                        const st = mp?.getPlayerState?.();
                        if (st !== 1 && st !== 3) mp?.playVideo?.();
                    } catch {}
                }
                await new Promise(r => setTimeout(r, 250));
            }

            const entryFinal = seleccionarEntradaAudio(win.__chan2txtAudioCap);
            const chunks = entryFinal?.chunks || [];
            if (!chunks.length) {
                responder({ error: 'SourceBuffer no recibió chunks de audio' });
                return;
            }

            const totalLen = chunks.reduce((acc, c) => acc + c.byteLength, 0);
            const joined = new Uint8Array(totalLen);
            let off = 0;
            for (const c of chunks) {
                joined.set(c, off);
                off += c.byteLength;
            }

            responder({
                audioBuffer: joined.buffer,
                audioMime: entryFinal.mime || 'audio/webm',
                audioDuration: Number(v.duration) || 0
            });
        } catch (err) {
            responder({ error: err?.message || 'Error capturando SourceBuffer de audio' });
        }
    }

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

async function lanzarWorkerIframeWatch(videoId, { querySuffix, timeoutMs }) {
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
            iframe.src = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=es${querySuffix}`;
            iframesActivosSet.add(iframe);
            (document.body || document.documentElement).appendChild(iframe);
        } catch {
            terminar(null);
        }
    });
}

export function extraerMedianteIframeWatchReal(videoId, timeoutMs = CFG.TIMEOUT_IFRAME) {
    return lanzarWorkerIframeWatch(videoId, {
        querySuffix: '&cc_load_policy=1&maximus_worker=1',
        timeoutMs
    });
}

export function capturarAudioConIframeWatch(videoId, timeoutMs = 110000, expectedDurSec = 0) {
    return lanzarWorkerIframeWatch(videoId, {
        querySuffix: `&maximus_worker=1&maximus_audio=1&maximus_dur=${Math.max(0, Math.round(Number(expectedDurSec) || 0))}`,
        timeoutMs
    });
}
