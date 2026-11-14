import {
    win,
    CFG,
    CLIENTES_INNERTUBE,
    _subtitulosCachePorVideoId,
    _transcriptJsonPorVideoId
} from './config.js';
import {
    dormir,
    texto,
    seguro,
    extraerJsonBalanceadoDesdeIndice
} from './utils.js';
import { extraerMedianteIframeWatchReal } from './worker-iframe.js';
import {
    calcularSapisidHash,
    construirHeadersInnerTube,
    obtenerConfigYtcfg,
    peticionHttpBaja,
    fetchTexto
} from './http.js';
import {
    generarCandidatosSubtitulos,
    generarParamsProtobufGetTranscript,
    decodeSubtitles,
    construirBloquesSubtitulos,
    construirArchivoTxt,
    elegirPistaSubtitulo,
    parsearPayloadSubtitulo,
    parsearRespuestaGetTranscript,
    convertirDomCuesASubtitulos
} from './subtitles.js';
import { cancelado, verificarCancelacion } from './main.js';

export function extraerDatosLigerosDeHtmlWatch(html) {
    if (!html || typeof html !== 'string') {
        return { titulo: '', fecha: '0000-00-00', pistas: [], transcriptParams: [], playabilityStatus: 'OK', visitorData: '' };
    }

    const transcriptParams = [];
    const reTranscript = /"getTranscriptEndpoint"\s*:\s*\{\s*"params"\s*:\s*"([^"]+)"/g;
    let m;
    while ((m = reTranscript.exec(html)) !== null) {
        if (m[1]) transcriptParams.push(m[1]);
    }

    let visitorData = '';
    const mVis = html.match(/"VISITOR_DATA"\s*:\s*"([^"]+)"/) || html.match(/"visitorData"\s*:\s*"([^"]+)"/);
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
        const objCap = extraerJsonBalanceadoDesdeIndice(html, idxCaptions + '"playerCaptionsTracklistRenderer":'.length);
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

// Consulta /youtubei/v1/next para obtener el getTranscriptEndpoint firmado oficial de un video sin cargar el DOM
export async function obtenerDatosViaInnertubeNext(videoId) {
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
        if (cancelado) throw e;
    }
    return [];
}

// Consulta /youtubei/v1/player con clientes ANDROID / IOS / MWEB / WEB_EMBEDDED (que entregan URLs de subtítulos sin exigencia de PO Token de navegador)
export async function obtenerPlayerMultiCliente(videoId, visitorDataOverride = '') {
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
                ...(cfg.sts ? { playbackContext: { contentPlaybackContext: { signatureTimestamp: Number(cfg.sts) } } } : {})
            };

            const headersCli = {
                'Content-Type': 'application/json',
                'X-Youtube-Client-Name': cli.id,
                'X-Youtube-Client-Version': cli.context.clientVersion,
                'Origin': 'https://www.youtube.com',
                'X-Origin': 'https://www.youtube.com',
                ...(vData ? { 'X-Goog-Visitor-Id': vData } : {}),
                ...(cli.ua ? { 'User-Agent': cli.ua } : {})
            };

            // Intento 1: anónimo (Android/iOS funcionan de maravilla sin cookies de navegador web)
            for (const modoAnonimo of [true, false]) {
                verificarCancelacion();
                const hFinal = { ...headersCli };
                if (!modoAnonimo) {
                    const auth = await calcularSapisidHash('https://www.youtube.com');
                    if (auth) hFinal['Authorization'] = auth;
                }
                for (const preferirFetch of [true, false]) {
                    try {
                        const resp = await peticionHttpBaja(urlPlayer, {
                            method: 'POST',
                            preferirFetch,
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
                            if (typeof window !== 'undefined' && window.__chan2txtGmPolyfillReady) {
                                break;
                            }
                        }
                    } catch (eCli) {
                        if (cancelado) throw eCli;
                    }
                }
            }
        } catch (e) {
            if (cancelado) throw e;
        }
    }
    return null;
}

export async function extraerSubtitulosViaGetTranscript(videoId, pistaElegida = null, paramsExtraidosHtml = []) {
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
            if (cancelado) throw e;
        }
    }

    return [];
}

export async function obtenerSubtitulosRobusto(pistaElegida, videoId, idiomaPreferido = 'es') {
    const codigoIdioma = pistaElegida?.languageCode || idiomaPreferido;
    const esAuto = pistaElegida?.kind === 'asr';
    const necesitaTraducir = !!pistaElegida?.necesitaTraducir;

    if (_subtitulosCachePorVideoId.has(videoId)) {
        const cuesCache = parsearPayloadSubtitulo(_subtitulosCachePorVideoId.get(videoId));
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

        // Intento A: vía peticionHttpBaja (GM_xmlhttpRequest / fetch)
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
                if (cancelado) throw e;
            }
        }
    }

    return [];
}

// Extracción infalible cuando el usuario está dentro de /watch?v=ID
export async function activarSubtitulosEnPlayerActivoDom(videoId) {
    try {
        if (!location.pathname.includes('/watch') || new URLSearchParams(location.search).get('v') !== videoId) {
            return [];
        }

        // 1. Revisar si ya está en caché de get_transcript o timedtext
        if (_transcriptJsonPorVideoId.has(videoId)) {
            const sub = parsearRespuestaGetTranscript(JSON.parse(_transcriptJsonPorVideoId.get(videoId)));
            if (sub.length > 0) return sub;
        }
        if (_subtitulosCachePorVideoId.has(videoId)) {
            const cues = parsearPayloadSubtitulo(_subtitulosCachePorVideoId.get(videoId));
            if (cues && cues.length > 0) return decodeSubtitles(cues).filter(s => s.text.length > 0);
        }

        // 2. Activar subtítulos en movie_player y abrir panel de transcripción si existe
        const player = win.document?.getElementById('movie_player');
        if (player) {
            player.loadModule?.('captions');
            player.loadModule?.('cc');
            const tracklist = player.getOption?.('captions', 'tracklist') || [];
            const esp = tracklist.find(t => /^es/i.test(t.languageCode)) || tracklist[0];
            if (esp) {
                player.setOption?.('captions', 'track', esp);
            }
        }

        const btnTranscriptDom = document.querySelector(
            'ytd-video-description-transcript-section-renderer button, button[aria-label*="transcripci" i], button[aria-label*="transcript" i]'
        );
        if (btnTranscriptDom) {
            btnTranscriptDom.click();
        }

        const inicio = Date.now();
        while (Date.now() - inicio < 3200) {
            if (_transcriptJsonPorVideoId.has(videoId)) {
                const sub = parsearRespuestaGetTranscript(JSON.parse(_transcriptJsonPorVideoId.get(videoId)));
                if (sub.length > 0) return sub;
            }
            if (_subtitulosCachePorVideoId.has(videoId)) {
                const cues = parsearPayloadSubtitulo(_subtitulosCachePorVideoId.get(videoId));
                if (cues && cues.length > 0) {
                    return decodeSubtitles(cues).filter(s => s.text.length > 0);
                }
            }
            const segsDom = document.querySelectorAll('ytd-transcript-segment-renderer, transcript-segment-view-model');
            if (segsDom.length > 0) {
                const domCues = [];
                segsDom.forEach(nodo => {
                    const tTxt = nodo.querySelector('.segment-timestamp, [class*="timestamp"]')?.textContent?.trim() || '0:00';
                    const bTxt = nodo.querySelector('.segment-text, yt-formatted-string, [class*="segment-text"]')?.textContent?.trim() || '';
                    if (bTxt) domCues.push({ tTxt, bTxt });
                });
                const convertidos = convertirDomCuesASubtitulos(domCues);
                if (convertidos.length > 0) return convertidos;
            }
            await dormir(130);
        }
    } catch {}
    return [];
}

export function extraerFechaPublicacion(playerResponse, html = '') {
    const mf = playerResponse?.microformat?.playerMicroformatRenderer;
    const rawFecha =
        mf?.publishDate ||
        mf?.uploadDate ||
        (html ? (
            html.match(/"publishDate"\s*:\s*"(\d{4}-\d{2}-\d{2})/)?.[1] ||
            html.match(/"uploadDate"\s*:\s*"(\d{4}-\d{2}-\d{2})/)?.[1] ||
            html.match(/itemprop="datePublished"\s+content="(\d{4}-\d{2}-\d{2})/)?.[1]
        ) : '') ||
        '';

    const m = String(rawFecha).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '0000-00-00';
}

export function extraerPistasDePlayerResponse(pr) {
    return (
        pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks ||
        pr?.captions?.playerCaptionsRenderer?.captionTracks ||
        []
    );
}

// ==================================================
// PIPELINE MAESTRO DE EXTRACCIÓN (5 CAPAS DE INGENIERÍA ANTI-ROJO)
// ==================================================

export async function procesarVideoATxt(itemVideo) {
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

    // CAPA 0: Si estamos dentro del propio video (/watch), usar directamente el estado vivo de la página
    if (enMismoVideoWatch) {
        try {
            const playerDom = win.document?.getElementById('movie_player');
            const prDom = playerDom?.getPlayerResponse?.() || win.ytInitialPlayerResponse;
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
            if (win.ytInitialData) {
                const strInit = JSON.stringify(win.ytInitialData);
                const re = /"getTranscriptEndpoint"\s*:\s*\{\s*"params"\s*:\s*"([^"]+)"/g;
                let m;
                while ((m = re.exec(strInit)) !== null) {
                    if (m[1]) {
                        transcriptParamsHtml.push(m[1]);
                        tuvoPistas = true;
                    }
                }
            }
        } catch {}
    }

    // CAPA 1: Extracción ligera de HTML /watch + Innertube /next en paralelo para obtener fecha, título, pistas y getTranscriptEndpoint firmado
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
            if (cancelado) throw e;
        }
    }

    // CAPA 2: Descarga vía /youtubei/v1/get_transcript con los params oficiales (no requiere PO Token de reproductor)
    if (subtitulos.length === 0 && (transcriptParamsHtml.length > 0 || tuvoPistas)) {
        if (!pistaUsada?.necesitaTraducir || /^es/i.test(pistaUsada?.languageCode || 'es')) {
            subtitulos = await extraerSubtitulosViaGetTranscript(videoId, pistaUsada, transcriptParamsHtml);
        }
    }

    // CAPA 3: Multi-Cliente Innertube (/youtubei/v1/player con ANDROID, IOS, MWEB, WEB_EMBEDDED)
    // Las pistas devueltas por clientes móviles tienen URLs firmadas que descargan el XML/JSON3 al primer intento sin bloqueo de PO Token.
    if (subtitulos.length === 0) {
        const infoMovil = await obtenerPlayerMultiCliente(videoId, visitorDataVideo);
        if (infoMovil) {
            if (infoMovil.titulo && (!tituloReal || tituloReal === videoId)) tituloReal = infoMovil.titulo;
            if (infoMovil.fecha && infoMovil.fecha !== '0000-00-00' && fecha === '0000-00-00') fecha = infoMovil.fecha;
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

    // CAPA 4: Si la pista web normal ya tiene PO Token o funciona directo, probarla
    if (subtitulos.length === 0 && pistaUsada?.baseUrl) {
        subtitulos = await obtenerSubtitulosRobusto(pistaUsada, videoId, 'es');
    }

    // Si estamos en /watch y aún no salió, activar el DOM del reproductor actual
    if (subtitulos.length === 0 && enMismoVideoWatch) {
        subtitulos = await activarSubtitulosEnPlayerActivoDom(videoId);
    }

    // Si la pista era en otro idioma y get_transcript está disponible, usar get_transcript antes de ir al iframe
    if (subtitulos.length === 0 && transcriptParamsHtml.length > 0) {
        subtitulos = await extraerSubtitulosViaGetTranscript(videoId, pistaUsada, transcriptParamsHtml);
    }

    // CAPA 5 (FALLBACK DEFINITIVO): Pool de Iframes /watch Reales con auto-apertura de CC y Panel de Transcripción
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
                    } catch {}
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
                    subtitulos = await extraerSubtitulosViaGetTranscript(videoId, pistaUsada, [resWorker.transcriptParams]);
                }
            }
        }
    }

    _subtitulosCachePorVideoId.delete(videoId);
    _transcriptJsonPorVideoId.delete(videoId);

    // REGLA ESTRICTA DEL COLOR AZUL:
    if (!tuvoPistas && subtitulos.length === 0) {
        const err = new Error(
            `No existe posibilidad de sacar subtítulos porque el video no tiene ninguno habilitado (${estadoPlayability})`
        );
        err.noTieneSubtitulos = true;
        throw err;
    }

    if (subtitulos.length === 0) {
        throw new Error(
            `No se pudo extraer el cuerpo del subtítulo (${pistaUsada?.languageCode || 'es'})`
        );
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
