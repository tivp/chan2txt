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
import {
    extraerMedianteIframeWatchReal,
    capturarAudioConIframeWatch
} from './worker-iframe.js';
import {
    calcularSapisidHash,
    construirHeadersInnerTube,
    obtenerConfigYtcfg,
    esRespuestaCaptcha,
    peticionHttpBaja,
    fetchTexto
} from './http.js';
import {
    generarCandidatosSubtitulos,
    generarParamsProtobufGetTranscript,
    generarParamsProtobufGetPanel,
    decodeSubtitles,
    construirBloquesSubtitulos,
    construirArchivoTxt,
    elegirPistaSubtitulo,
    esIdiomaScriptLatino,
    parseSubtitleVTT,
    parsearPayloadSubtitulo,
    parsearRespuestaGetTranscript,
    parsearRespuestaGetPanel,
    convertirDomCuesASubtitulos,
    decodificarAudioAPcm16,
    seleccionarMejorFormatoAudioDirecto,
    descargarAudioDirectoCorto,
    resolverMotoresSttActivos,
    transcribirPcm16ConMotor
} from './subtitles.js';
import { cancelado, verificarCancelacion } from './main.js';

let _timedtextBloqueadoHasta = 0;

export function esTimedtextBloqueado() {
    return Date.now() < _timedtextBloqueadoHasta;
}

export function marcarTimedtextBloqueado(ms = 90000) {
    const hasta = Date.now() + ms;
    if (hasta > _timedtextBloqueadoHasta) {
        _timedtextBloqueadoHasta = hasta;
    }
}

const INVIDIOUS_SEEDS = Object.freeze([
    'https://yt.chocolatemoo53.com'
]);
const _invidiousHostFallidos = new Map();
let _invidiousInstanciasCache = [];
let _invidiousInstanciasExpira = 0;
let _invidiousInstanciasPromesa = null;

async function fetchPublicoCors(url, timeoutMs = 6500) {
    verificarCancelacion();
    try {
        return await peticionHttpBaja(url, {
            method: 'GET',
            preferirFetch: true,
            anonymous: true,
            timeout: timeoutMs
        });
    } catch (e) {
        if (e?.esCancelacion || cancelado) throw e;
    }
    verificarCancelacion();
    return peticionHttpBaja(url, {
        method: 'GET',
        preferirFetch: false,
        anonymous: true,
        timeout: timeoutMs
    });
}

async function obtenerInstanciasInvidiousCors() {
    const ahora = Date.now();
    const filtrarSanas = lista =>
        lista.filter(base => !_invidiousHostFallidos.has(base) || ahora >= _invidiousHostFallidos.get(base));

    if (_invidiousInstanciasCache.length > 0 && ahora < _invidiousInstanciasExpira) {
        return filtrarSanas(_invidiousInstanciasCache);
    }

    if (!_invidiousInstanciasPromesa) {
        _invidiousInstanciasPromesa = (async () => {
            const descubiertas = [];
            try {
                const res = await fetchPublicoCors('https://api.invidious.io/instances.json', 4500);
                if (res?.status === 200 && res.text) {
                    const lista = JSON.parse(res.text);
                    if (Array.isArray(lista)) {
                        lista
                            .filter(([, meta]) => meta && meta.api && meta.cors && meta.type === 'https' && meta.uri)
                            .sort((a, b) => Number(b[1]?.monitor?.uptime || 0) - Number(a[1]?.monitor?.uptime || 0))
                            .forEach(([, meta]) => {
                                const uri = String(meta.uri).replace(/\/+$/, '');
                                if (uri && !descubiertas.includes(uri)) descubiertas.push(uri);
                            });
                    }
                }
            } catch (e) {
                if (e?.esCancelacion || cancelado) throw e;
            }
            const combinadas = Array.from(new Set([...descubiertas, ...INVIDIOUS_SEEDS]));
            _invidiousInstanciasCache = combinadas;
            _invidiousInstanciasExpira = Date.now() + (descubiertas.length > 0 ? 30 * 60 * 1000 : 2 * 60 * 1000);
            return combinadas;
        })().finally(() => {
            _invidiousInstanciasPromesa = null;
        });
    }

    const baseList = await _invidiousInstanciasPromesa;
    return filtrarSanas(baseList);
}

function elegirPistaInvidious(captions, idiomaPreferido = 'es', pistaPreferida = null) {
    if (!Array.isArray(captions) || !captions.length) return null;

    const pistas = captions
        .map(c => ({
            languageCode: String(c?.languageCode || c?.language_code || '').trim(),
            label: String(c?.label || ''),
            url: String(c?.url || ''),
            esAuto: /auto[- ]?generat|autom[aá]tic/i.test(String(c?.label || ''))
        }))
        .filter(p => p.languageCode || p.url);

    if (!pistas.length) return null;

    const baseObjetivo = String(idiomaPreferido || 'es').toLowerCase().split('-')[0];
    const esMismoIdioma = (code, baseTarget) => {
        const clean = String(code || '').toLowerCase();
        return clean === baseTarget || clean.startsWith(`${baseTarget}-`);
    };

    const prefManual = pistas.find(p => esMismoIdioma(p.languageCode, baseObjetivo) && !p.esAuto);
    if (prefManual) return { ...prefManual, necesitaTraducir: false };

    const prefAuto = pistas.find(p => esMismoIdioma(p.languageCode, baseObjetivo));
    if (prefAuto) return { ...prefAuto, necesitaTraducir: false };

    const hayPistaLatina = pistas.some(p => esIdiomaScriptLatino(p.languageCode));
    const prefEsAsrNoLatino =
        pistaPreferida?.kind === 'asr' &&
        !esIdiomaScriptLatino(pistaPreferida?.languageCode) &&
        hayPistaLatina;

    if (pistaPreferida?.languageCode && !prefEsAsrNoLatino) {
        const basePref = String(pistaPreferida.languageCode).toLowerCase().split('-')[0];
        const matchPref =
            pistas.find(p => p.languageCode.toLowerCase() === String(pistaPreferida.languageCode).toLowerCase()) ||
            pistas.find(p => esMismoIdioma(p.languageCode, basePref));
        if (matchPref) return { ...matchPref, necesitaTraducir: true };
    }

    const enManual = pistas.find(p => esMismoIdioma(p.languageCode, 'en') && !p.esAuto);
    if (enManual) return { ...enManual, necesitaTraducir: true };

    const latinManual = pistas.find(p => esIdiomaScriptLatino(p.languageCode) && !p.esAuto);
    if (latinManual) return { ...latinManual, necesitaTraducir: true };

    const origManual = pistas.find(p => !p.esAuto);
    if (origManual) return { ...origManual, necesitaTraducir: true };

    const enAuto = pistas.find(p => esMismoIdioma(p.languageCode, 'en'));
    if (enAuto) return { ...enAuto, necesitaTraducir: true };

    const latinAuto = pistas.find(p => esIdiomaScriptLatino(p.languageCode));
    if (latinAuto) return { ...latinAuto, necesitaTraducir: true };

    return { ...pistas[0], necesitaTraducir: true };
}

function distribuirTraduccionPorCaracteres(batch, textoTraducido) {
    const palabras = textoTraducido.replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (!palabras.length) return batch;
    const totalChars = batch.reduce((acc, c) => acc + Math.max(1, c.text.length), 0);
    let cursor = 0;

    return batch.map((cue, idx) => {
        if (idx === batch.length - 1) {
            const resto = palabras.slice(cursor).join(' ').trim();
            return { ...cue, text: resto || cue.text };
        }
        const proporcion = Math.max(1, cue.text.length) / totalChars;
        const cantidad = Math.max(1, Math.round(proporcion * palabras.length));
        const trozo = palabras.slice(cursor, cursor + cantidad).join(' ').trim();
        cursor += cantidad;
        return { ...cue, text: trozo || cue.text };
    });
}

async function traducirSubtitulosGtx(subtitulos, idiomaOrigen = 'auto', idiomaDestino = 'es') {
    if (!Array.isArray(subtitulos) || !subtitulos.length) return [];
    const baseDst = String(idiomaDestino || 'es').toLowerCase().split('-')[0];
    const srcNorm = String(idiomaOrigen || 'auto').trim();
    const baseSrc = /^auto$/i.test(srcNorm) ? 'auto' : srcNorm.split('-')[0].toLowerCase();
    if (baseSrc !== 'auto' && baseSrc === baseDst) return subtitulos;

    const salida = [];
    let i = 0;
    while (i < subtitulos.length) {
        verificarCancelacion();
        const batch = [];
        let acumuladoLen = 0;
        while (i < subtitulos.length && batch.length < 25) {
            const cand = subtitulos[i];
            const lineaLimpia = String(cand.text || '').replace(/\r?\n/g, ' ').trim();
            const costo = encodeURIComponent(`${lineaLimpia}\n`).length;
            if (batch.length > 0 && acumuladoLen + costo > 1300) break;
            batch.push({ ...cand, text: lineaLimpia });
            acumuladoLen += costo;
            i++;
        }

        const traducirLoteConReintento = async (lote, intento = 0) => {
            if (cancelado) { verificarCancelacion?.(); }
            if (!lote.length) return [];

            const q = lote.map(c => c.text).join('\n');
            const encodedQ = encodeURIComponent(q);
            if (encodedQ.length > 1700 && lote.length > 2) {
                const mitad = Math.ceil(lote.length / 2);
                const izq = await traducirLoteConReintento(lote.slice(0, mitad), intento);
                await dormir(150);
                const der = await traducirLoteConReintento(lote.slice(mitad), intento);
                return [...izq, ...der];
            }

            const trUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(baseSrc)}&tl=${encodeURIComponent(baseDst)}&dt=t&q=${encodedQ}`;
            try {
                const res = await fetchPublicoCors(trUrl, 9000);
                if (res?.status === 200 && res.text) {
                    const parsed = JSON.parse(res.text);
                    if (Array.isArray(parsed?.[0])) {
                        const textoTr = parsed[0].map(seg => seg?.[0] || '').join('');
                        const lineasTr = textoTr.replace(/\r/g, '').split('\n');
                        if (lineasTr.length === lote.length) {
                            return lote.map((c, j) => ({
                                ...c,
                                text: lineasTr[j].trim() || c.text
                            }));
                        }
                        return distribuirTraduccionPorCaracteres(lote, textoTr);
                    }
                }
            } catch (e) {
                if (e?.esCancelacion || cancelado) throw e;
            }

            if (intento < 3) {
                const espera = (650 * (1 << intento)) + Math.floor(Math.random() * 350);
                await dormir(espera);
                return traducirLoteConReintento(lote, intento + 1);
            }

            if (lote.length > 4) {
                const mitad = Math.ceil(lote.length / 2);
                await dormir(300);
                const izq = await traducirLoteConReintento(lote.slice(0, mitad), 1);
                await dormir(300);
                const der = await traducirLoteConReintento(lote.slice(mitad), 1);
                return [...izq, ...der];
            }

            return lote;
        };

        const loteTraducido = await traducirLoteConReintento(batch);
        salida.push(...loteTraducido);
        await dormir(120);
    }

    return salida;
}

export async function obtenerSubtitulosViaInvidious(videoId, idiomaPreferido = 'es', opciones = {}) {
    const instancias = await obtenerInstanciasInvidiousCors();
    const limite = instancias.slice(0, 3);

    for (const baseUrl of limite) {
        verificarCancelacion();
        try {
            const resLista = await fetchPublicoCors(`${baseUrl}/api/v1/captions/${encodeURIComponent(videoId)}`, 6500);
            if (resLista.status === 429 || resLista.status === 403 || resLista.status >= 500 || !resLista.status) {
                _invidiousHostFallidos.set(baseUrl, Date.now() + 90000);
                continue;
            }
            if (resLista.status !== 200 || !resLista.text) continue;

            let dataLista;
            try {
                dataLista = JSON.parse(resLista.text);
            } catch {
                _invidiousHostFallidos.set(baseUrl, Date.now() + 90000);
                continue;
            }

            if (Array.isArray(dataLista?.captions) && dataLista.captions.length === 0) {
                return [];
            }

            const pista = elegirPistaInvidious(dataLista?.captions, idiomaPreferido, opciones?.pistaPreferida || null);
            if (!pista) continue;

            const vttUrl = pista.url && pista.url.startsWith('/')
                ? `${baseUrl}${pista.url}`
                : `${baseUrl}/api/v1/captions/${encodeURIComponent(videoId)}?lang=${encodeURIComponent(pista.languageCode)}`;

            const resVtt = await fetchPublicoCors(vttUrl, 7500);
            if (resVtt.status === 429 || resVtt.status === 403 || resVtt.status >= 500 || !resVtt.status) {
                _invidiousHostFallidos.set(baseUrl, Date.now() + 90000);
                continue;
            }
            if (resVtt.status !== 200 || !resVtt.text) continue;

            let subs = decodeSubtitles(parseSubtitleVTT(resVtt.text)).filter(s => s.text.length > 0);
            if (subs.length > 0) {
                if (pista.necesitaTraducir && idiomaPreferido) {
                    subs = await traducirSubtitulosGtx(subs, pista.languageCode || 'auto', idiomaPreferido);
                }
                return subs;
            }
        } catch (e) {
            if (e?.esCancelacion || cancelado) throw e;
            _invidiousHostFallidos.set(baseUrl, Date.now() + 90000);
        }
    }

    return [];
}

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
        if (e.esCancelacion || cancelado) throw e;
    }
    return [];
}

function construirResumenPlayerResponse(pr, cliente = 'WEB') {
    if (!pr || typeof pr !== 'object') return null;
    return {
        cliente,
        pr,
        pistas: extraerPistasDePlayerResponse(pr),
        titulo: texto(pr?.videoDetails?.title || ''),
        fecha: extraerFechaPublicacion(pr),
        playabilityStatus: pr?.playabilityStatus?.status || 'OK',
        visitorData: pr?.responseContext?.visitorData || ''
    };
}

function viasFetchDisponibles() {
    const enYoutube = typeof location !== 'undefined' && /^https:\/\/(?:www|m)\.youtube\.com$/i.test(location.origin);
    return enYoutube ? [true, false] : [false, true];
}

// Consulta ligera WEB /youtubei/v1/player para obtener publishDate, titulo y estado en JSON (~15 KB vs 900 KB HTML)
export async function obtenerPlayerWebLigero(videoId) {
    verificarCancelacion();
    const cfg = obtenerConfigYtcfg();
    const urlPlayer = `https://www.youtube.com/youtubei/v1/player?prettyPrint=false${cfg.apiKey ? `&key=${encodeURIComponent(cfg.apiKey)}` : ''}`;
    const payload = {
        context: {
            client: {
                clientName: 'WEB',
                clientVersion: cfg.clientVersion || '2.20260401.01.00',
                hl: cfg.hl || 'es',
                gl: cfg.gl || 'ES',
                ...(cfg.visitorData ? { visitorData: cfg.visitorData } : {})
            }
        },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true
    };
    const headersWeb = {
        'Content-Type': 'application/json',
        'X-Youtube-Client-Name': '1',
        'X-Youtube-Client-Version': String(cfg.clientVersion || '2.20260401.01.00')
    };

    for (const preferirFetch of viasFetchDisponibles()) {
        verificarCancelacion();
        try {
            const resp = await peticionHttpBaja(urlPlayer, {
                method: 'POST',
                preferirFetch,
                headers: headersWeb,
                body: JSON.stringify(payload),
                timeout: 5000
            });
            if (resp.status === 200 && resp.text) {
                return construirResumenPlayerResponse(JSON.parse(resp.text), 'WEB');
            }
        } catch (e) {
            if (e.esCancelacion || cancelado) throw e;
        }
    }
    return null;
}

// Consulta /youtubei/v1/player con clientes ANDROID / IOS / MWEB / WEB_EMBEDDED (URLs sin exigencia de PO Token)
export async function obtenerPlayerMultiCliente(videoId, visitorDataOverride = '') {
    verificarCancelacion();
    const cfg = obtenerConfigYtcfg();
    const urlPlayer = `https://www.youtube.com/youtubei/v1/player?prettyPrint=false${cfg.apiKey ? `&key=${encodeURIComponent(cfg.apiKey)}` : ''}`;
    const vData = visitorDataOverride || cfg.visitorData || '';
    const vias = viasFetchDisponibles();
    let mejorMeta = null;

    const consultarCliente = async (cli, modoAnonimo) => {
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

        if (!modoAnonimo) {
            const auth = await calcularSapisidHash('https://www.youtube.com');
            if (auth) headersCli['Authorization'] = auth;
        }

        for (const preferirFetch of vias) {
            verificarCancelacion();
            try {
                const resp = await peticionHttpBaja(urlPlayer, {
                    method: 'POST',
                    preferirFetch,
                    headers: headersCli,
                    body: JSON.stringify(payload),
                    anonymous: modoAnonimo,
                    timeout: 5000
                });
                if (resp.status === 200 && resp.text) {
                    const resumen = construirResumenPlayerResponse(JSON.parse(resp.text), cli.nombre);
                    if (resumen) {
                        if (!mejorMeta && (resumen.titulo || resumen.playabilityStatus !== 'OK')) {
                            mejorMeta = resumen;
                        }
                        if (resumen.pistas.length > 0) return resumen;
                        // Ya obtuvimos respuesta 200 JSON valida sin pistas; no repetir otro transporte para este mismo cliente
                        break;
                    }
                }
            } catch (e) {
                if (e.esCancelacion || cancelado) throw e;
            }
        }
        return null;
    };

    // Fase 1: clientes anonimos (ANDROID e IOS resuelven en ~100ms sin cookies)
    for (const cli of CLIENTES_INNERTUBE) {
        verificarCancelacion();
        const hit = await consultarCliente(cli, true);
        if (hit) return hit;
    }

    // Fase 2: si el video requiere sesion (edad/miembros) y no entrego pistas en anonimo, reintentar autenticado en clientes clave
    if (mejorMeta && mejorMeta.playabilityStatus !== 'OK') {
        for (const cli of CLIENTES_INNERTUBE) {
            if (cli.nombre !== 'ANDROID' && cli.nombre !== 'WEB_EMBEDDED_PLAYER') continue;
            verificarCancelacion();
            const hit = await consultarCliente(cli, false);
            if (hit) return hit;
        }
    }

    return mejorMeta;
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

    const unicos = Array.from(
        new Set([
            ...(paramsExtraidosHtml || []).slice(0, 2),
            ...generados.slice(0, 2)
        ])
    );

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
                timeout: 4500
            });

            if (resp.status === 400 || resp.status === 403 || resp.status === 429) {
                break;
            }

            if (resp.status === 200 && resp.text) {
                const data = JSON.parse(resp.text);
                const subtitulos = parsearRespuestaGetTranscript(data);
                if (subtitulos.length > 0) {
                    return subtitulos;
                }
            }
        } catch (e) {
            if (e.esCancelacion || cancelado) throw e;
            break;
        }
    }

    return [];
}

// Obtiene transcripcion completa sin pasar por /api/timedtext usando PAmodern_transcript_view
export async function obtenerSubtitulosViaGetPanel(videoId, idiomaPreferido = 'es') {
    verificarCancelacion();

    if (_transcriptJsonPorVideoId.has(videoId)) {
        try {
            const subCache = parsearRespuestaGetPanel(JSON.parse(_transcriptJsonPorVideoId.get(videoId)));
            if (subCache.length > 0) return subCache;
        } catch {}
    }

    const paramsPanel = generarParamsProtobufGetPanel(videoId);
    if (!paramsPanel) return [];

    const { headers, cfg } = await construirHeadersInnerTube(true);
    const urlEndpoint = `https://www.youtube.com/youtubei/v1/get_panel?prettyPrint=false${cfg.apiKey ? `&key=${encodeURIComponent(cfg.apiKey)}` : ''}`;

    const clientVersion = cfg.clientVersion || '2.20260401.01.00';
    const hl = cfg.hl || idiomaPreferido || 'es';
    const gl = cfg.gl || 'ES';

    const ctxWebLimpio = {
        client: {
            clientName: 'WEB',
            clientVersion,
            hl,
            gl,
            ...(cfg.visitorData ? { visitorData: cfg.visitorData } : {})
        }
    };
    const contextPayload = cfg.fullContext?.client?.clientName === 'WEB' ? cfg.fullContext : ctxWebLimpio;

    const intentarPanel = async (contexto, hdrs, anonymous = false) => {
        const resp = await peticionHttpBaja(urlEndpoint, {
            method: 'POST',
            preferirFetch: true,
            anonymous,
            headers: hdrs,
            body: JSON.stringify({
                context: contexto,
                panelId: 'PAmodern_transcript_view',
                params: paramsPanel
            }),
            timeout: 7000
        });
        if (resp.status === 200 && resp.text) {
            const data = JSON.parse(resp.text);
            return { status: 200, subs: parsearRespuestaGetPanel(data) };
        }
        return { status: resp.status, subs: [] };
    };

    try {
        const res1 = await intentarPanel(contextPayload, headers, false);
        if (res1.subs.length > 0) return res1.subs;
        if (res1.status === 400 || res1.status === 401 || res1.status === 403) {
            const hdrsMin = {
                'Content-Type': 'application/json',
                'X-YouTube-Client-Name': '1',
                'X-YouTube-Client-Version': clientVersion
            };
            const res2 = await intentarPanel(ctxWebLimpio, hdrsMin, true);
            if (res2.subs.length > 0) return res2.subs;
        }
    } catch (e) {
        if (e?.esCancelacion || cancelado) throw e;
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

    if (esTimedtextBloqueado()) {
        return [];
    }

    const candidatos = generarCandidatosSubtitulos(
        pistaElegida?.baseUrl,
        videoId,
        codigoIdioma,
        esAuto,
        necesitaTraducir
    );
    const vias = viasFetchDisponibles();

    for (const candUrl of candidatos) {
        verificarCancelacion();

        for (const preferirFetch of vias) {
            try {
                const res = await peticionHttpBaja(candUrl, {
                    method: 'GET',
                    preferirFetch,
                    timeout: 5500
                });

                if (
                    res.status === 429 ||
                    String(res.finalUrl || '').toLowerCase().includes('/sorry') ||
                    esRespuestaCaptcha(res.status, res.text, res.finalUrl)
                ) {
                    marcarTimedtextBloqueado(90000);
                    return [];
                }

                if (res.status === 200 && res.text) {
                    const cues = parsearPayloadSubtitulo(res.text);
                    if (cues && cues.length > 0) {
                        return decodeSubtitles(cues).filter(s => s.text.length > 0);
                    }
                    // HTTP 200 con cuerpo vacio indica que esta URL firmada requiere otro formato o PO Token, no otro transporte
                    break;
                }
            } catch (e) {
                if (e.esCancelacion || cancelado) throw e;
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

        // 1. Revisar si ya está en caché de get_transcript, get_panel o timedtext
        if (_transcriptJsonPorVideoId.has(videoId)) {
            const sub = parsearRespuestaGetPanel(JSON.parse(_transcriptJsonPorVideoId.get(videoId)));
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

        const btnExpand = document.querySelector('#description-inline-expander #expand, ytd-text-inline-expander #expand');
        if (btnExpand) btnExpand.click();

        const btnTranscriptDom = document.querySelector(
            'ytd-video-description-transcript-section-renderer button, button[aria-label*="Mostrar transcripci" i], button[aria-label*="Show transcript" i], button[aria-label*="transcripci" i], button[aria-label*="transcript" i]'
        );
        if (btnTranscriptDom) {
            btnTranscriptDom.click();
        }

        const inicio = Date.now();
        while (Date.now() - inicio < 3200) {
            if (_transcriptJsonPorVideoId.has(videoId)) {
                const sub = parsearRespuestaGetPanel(JSON.parse(_transcriptJsonPorVideoId.get(videoId)));
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
                    const tTxt = nodo.querySelector('.segment-timestamp, .ytwTranscriptSegmentViewModelTimestamp, [class*="Timestamp"], [class*="timestamp"]')?.textContent?.trim() || '0:00';
                    const bTxt = nodo.querySelector('.segment-text, yt-formatted-string, span[role="text"], .yt-core-attributed-string, [class*="segment-text"]')?.textContent?.trim() || '';
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
// PIPELINE MAESTRO HÍBRIDO DE EXTRACCIÓN (5 CAPAS DE ALTA VELOCIDAD)
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
    let infoMovilParaAudio = null;
    let vinoDePanelModerno = false;

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
            if (_transcriptJsonPorVideoId.has(videoId)) {
                const subCache = parsearRespuestaGetPanel(JSON.parse(_transcriptJsonPorVideoId.get(videoId)));
                if (subCache.length > 0) {
                    subtitulos = subCache;
                    vinoDePanelModerno = true;
                    tuvoPistas = true;
                }
            }
            if (subtitulos.length === 0 && _subtitulosCachePorVideoId.has(videoId) && pistaUsada) {
                subtitulos = await obtenerSubtitulosRobusto(pistaUsada, videoId, 'es');
            }
        } catch {}
    }

    // CAPA 1 HÍBRIDA (Paralelo get_panel PAmodern_transcript_view + WEB Player JSON ~120ms, 0 hits a /api/timedtext):
    // Resuelve videos, Shorts y Lives sin detonar los HTTP 429 de /api/timedtext; usa ANDROID/IOS/MWEB solo si hace falta.
    if (subtitulos.length === 0 || fecha === '0000-00-00') {
        try {
            const [subsPanel, infoWeb] = await Promise.all([
                subtitulos.length === 0
                    ? obtenerSubtitulosViaGetPanel(videoId, 'es').catch(e => {
                          if (e?.esCancelacion || cancelado) throw e;
                          return [];
                      })
                    : Promise.resolve([]),
                obtenerPlayerWebLigero(videoId).catch(e => {
                    if (e?.esCancelacion || cancelado) throw e;
                    return null;
                })
            ]);

            if (infoWeb?.titulo) tituloReal = infoWeb.titulo;
            if (infoWeb?.fecha && infoWeb.fecha !== '0000-00-00') fecha = infoWeb.fecha;
            if (infoWeb?.playabilityStatus && infoWeb.playabilityStatus !== 'OK') {
                estadoPlayability = infoWeb.playabilityStatus;
            }
            if (!visitorDataVideo && infoWeb?.visitorData) {
                visitorDataVideo = infoWeb.visitorData;
            }
            if (infoWeb?.pistas?.length > 0) {
                tuvoPistas = true;
                if (!pistaUsada) {
                    pistaUsada = elegirPistaSubtitulo(infoWeb.pistas);
                }
            }

            if (subsPanel.length > 0) {
                subtitulos = subsPanel;
                tuvoPistas = true;
                vinoDePanelModerno = true;
            }

            if (subtitulos.length === 0) {
                const infoMovil = await obtenerPlayerMultiCliente(videoId, visitorDataVideo).catch(e => {
                    if (e?.esCancelacion || cancelado) throw e;
                    return null;
                });
                if (infoMovil?.pr) infoMovilParaAudio = infoMovil;

                if (infoMovil?.titulo && (!tituloReal || tituloReal === videoId)) tituloReal = infoMovil.titulo;
                if (infoMovil?.fecha && infoMovil.fecha !== '0000-00-00' && fecha === '0000-00-00') {
                    fecha = infoMovil.fecha;
                }
                if (infoMovil?.playabilityStatus) {
                    if (infoMovil.playabilityStatus === 'OK') {
                        estadoPlayability = 'OK';
                    } else if (estadoPlayability === 'OK') {
                        estadoPlayability = infoMovil.playabilityStatus;
                    }
                }

                if (infoMovil?.pistas?.length > 0) {
                    tuvoPistas = true;
                    const pistaMovil = elegirPistaSubtitulo(infoMovil.pistas);
                    if (pistaMovil) {
                        pistaUsada = pistaMovil;
                        if (!esTimedtextBloqueado() || _subtitulosCachePorVideoId.has(videoId)) {
                            subtitulos = await obtenerSubtitulosRobusto(pistaMovil, videoId, 'es');
                        }
                    }
                }
            }
        } catch (e) {
            if (e.esCancelacion || cancelado) throw e;
        }
    }

    // CAPA 2 (Fallback ligero /watch HTML + Innertube /next): Solo se ejecuta si falta el subtítulo o la fecha
    if (
        (!enMismoVideoWatch && (subtitulos.length === 0 || fecha === '0000-00-00')) ||
        (enMismoVideoWatch && (fecha === '0000-00-00' || (subtitulos.length === 0 && transcriptParamsHtml.length === 0)))
    ) {
        try {
            const necesitaHtml = !enMismoVideoWatch && (subtitulos.length === 0 || fecha === '0000-00-00');
            const necesitaNext = subtitulos.length === 0;
            const [rawHtml, paramsNext] = await Promise.all([
                necesitaHtml
                    ? fetchTexto(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=es`).catch(() => '')
                    : Promise.resolve(''),
                necesitaNext
                    ? obtenerDatosViaInnertubeNext(videoId).catch(() => [])
                    : Promise.resolve([])
            ]);

            if (rawHtml) {
                const datosHtml = extraerDatosLigerosDeHtmlWatch(rawHtml);
                if (datosHtml.titulo) tituloReal = datosHtml.titulo;
                if (datosHtml.fecha !== '0000-00-00' && fecha === '0000-00-00') fecha = datosHtml.fecha;
                if (datosHtml.playabilityStatus) {
                    estadoPlayability = datosHtml.playabilityStatus;
                }
                if (datosHtml.visitorData) visitorDataVideo = datosHtml.visitorData;
                if (datosHtml.transcriptParams.length > 0) {
                    transcriptParamsHtml.push(...datosHtml.transcriptParams);
                    tuvoPistas = true;
                }
                if (datosHtml.pistas.length > 0) {
                    tuvoPistas = true;
                    if (subtitulos.length === 0 || !pistaUsada?.baseUrl) {
                        pistaUsada = elegirPistaSubtitulo(datosHtml.pistas);
                    }
                }
            }

            if (Array.isArray(paramsNext) && paramsNext.length > 0) {
                transcriptParamsHtml.push(...paramsNext);
                tuvoPistas = true;
            }
            transcriptParamsHtml = Array.from(new Set(transcriptParamsHtml));
        } catch (e) {
            if (e.esCancelacion || cancelado) throw e;
        }
    }

    // CAPA 3: Fallback /youtubei/v1/get_transcript (acotado) y pista web directa
    if (subtitulos.length === 0 && (transcriptParamsHtml.length > 0 || tuvoPistas)) {
        if (!pistaUsada?.necesitaTraducir || /^es/i.test(pistaUsada?.languageCode || 'es')) {
            subtitulos = await extraerSubtitulosViaGetTranscript(videoId, pistaUsada, transcriptParamsHtml);
        }
    }

    if (subtitulos.length === 0 && pistaUsada?.baseUrl && (!esTimedtextBloqueado() || _subtitulosCachePorVideoId.has(videoId))) {
        subtitulos = await obtenerSubtitulosRobusto(pistaUsada, videoId, 'es');
    }

    // CAPA 4: Si estamos en /watch y aún no salió, activar el DOM del reproductor actual
    if (subtitulos.length === 0 && enMismoVideoWatch) {
        subtitulos = await activarSubtitulosEnPlayerActivoDom(videoId);
    }

    if (subtitulos.length === 0 && transcriptParamsHtml.length > 0) {
        subtitulos = await extraerSubtitulosViaGetTranscript(videoId, pistaUsada, transcriptParamsHtml);
    }

    // CAPA 4.5 (FALLBACK EXTERNO CORS): Invidious API + Google Translate GTX cuando timedtext da 429 y get_panel/get_transcript vienen vacíos
    if (subtitulos.length === 0 && (tuvoPistas || estadoPlayability !== 'OK')) {
        try {
            subtitulos = await obtenerSubtitulosViaInvidious(videoId, 'es', {
                pistaPreferida: pistaUsada
            });
            if (subtitulos.length > 0) {
                tuvoPistas = true;
            }
        } catch (e) {
            if (e?.esCancelacion || cancelado) throw e;
        }
    }

    // CAPA 5 (FALLBACK DEFINITIVO): Pool de Iframes /watch Reales solo si el video tuvo pistas o requiere sesión
    if (subtitulos.length === 0 && !enMismoVideoWatch && (tuvoPistas || estadoPlayability !== 'OK')) {
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
                        subtitulos = parsearRespuestaGetPanel(parsedTr);
                        if (subtitulos.length === 0) {
                            subtitulos = parsearRespuestaGetTranscript(parsedTr);
                        }
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

    // CAPA 6 (RESCATE DE AUDIO-A-TXT): Whisper WebGPU/WASM local o APIs CORS gratuitas
    let detalleAudioError = '';
    if (subtitulos.length === 0 && !/LIVE_STREAM_OFFLINE|UNPLAYABLE/i.test(estadoPlayability)) {
        try {
            const motoresStt = await resolverMotoresSttActivos();
            if (motoresStt.length > 0) {
                verificarCancelacion();
                let infoPlayerAudio = infoMovilParaAudio;
                if (!infoPlayerAudio?.pr?.streamingData?.adaptiveFormats?.length) {
                    infoPlayerAudio = await obtenerPlayerMultiCliente(videoId, visitorDataVideo).catch(e => {
                        if (e?.esCancelacion || cancelado) throw e;
                        return infoPlayerAudio;
                    });
                }
                if (infoPlayerAudio?.titulo && (!tituloReal || tituloReal === videoId)) {
                    tituloReal = infoPlayerAudio.titulo;
                }
                if (infoPlayerAudio?.fecha && infoPlayerAudio.fecha !== '0000-00-00' && fecha === '0000-00-00') {
                    fecha = infoPlayerAudio.fecha;
                }

                const prAudio = infoPlayerAudio?.pr;
                const durEsperada = Number(prAudio?.videoDetails?.lengthSeconds || 0);
                const formatos = prAudio?.streamingData?.adaptiveFormats || [];
                const mejorFormato = seleccionarMejorFormatoAudioDirecto(formatos);

                const bytesFmt = Number(mejorFormato?.contentLength || 0);
                let audioPcm = null;
                if (mejorFormato && ((bytesFmt > 0 && bytesFmt <= 380000) || (durEsperada > 0 && durEsperada <= 24))) {
                    audioPcm = await descargarAudioDirectoCorto(mejorFormato, durEsperada).catch(() => null);
                }

                if (!audioPcm?.pcm16?.length) {
                    const timeoutAudio = Math.min(
                        240000,
                        Math.max(75000, (durEsperada || 120) * 160 + 45000)
                    );
                    const capIframe = await capturarAudioConIframeWatch(videoId, timeoutAudio, durEsperada);
                    if (capIframe?.titulo && (!tituloReal || tituloReal === videoId)) {
                        tituloReal = texto(capIframe.titulo);
                    }
                    if (capIframe?.fecha && capIframe.fecha !== '0000-00-00' && fecha === '0000-00-00') {
                        fecha = capIframe.fecha;
                    }
                    if (capIframe?.audioBuffer instanceof ArrayBuffer && capIframe.audioBuffer.byteLength > 64) {
                        audioPcm = await decodificarAudioAPcm16(capIframe.audioBuffer);
                        capIframe.audioBuffer = null;
                    } else if (capIframe?.error) {
                        detalleAudioError = capIframe.error;
                    }
                }

                if (audioPcm?.pcm16?.length) {
                    verificarCancelacion();
                    const resStt = await transcribirPcm16ConMotor(audioPcm.pcm16, audioPcm.duration, {
                        lang: 'es',
                        verificarCancelacion
                    });
                    if (Array.isArray(resStt?.subtitulos) && resStt.subtitulos.length > 0) {
                        subtitulos = resStt.subtitulos;
                        pistaUsada = {
                            languageCode: resStt.idioma || 'es',
                            kind: resStt.fuente || 'whisper',
                            necesitaTraducir: false,
                            etiquetaAudio: resStt.etiqueta || 'Audio IA'
                        };
                        tuvoPistas = true;
                    }
                }
            }
        } catch (e) {
            if (e?.esCancelacion || cancelado) throw e;
            detalleAudioError = e?.message || String(e || '');
        }
    }

    // REGLA ESTRICTA DEL COLOR AZUL:
    if (!tuvoPistas && subtitulos.length === 0) {
        const err = new Error(
            `No existe posibilidad de sacar subtítulos porque el video no tiene ninguno habilitado (${estadoPlayability})`
        );
        err.noTieneSubtitulos = true;
        if (detalleAudioError) err.audioDetalle = detalleAudioError;
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

    const idiomaEtiqueta = pistaUsada?.etiquetaAudio
        ? `${pistaUsada.languageCode || 'es'} (${pistaUsada.etiquetaAudio})`
        : (pistaUsada?.languageCode || 'es') +
          (pistaUsada?.kind === 'asr' ? ' auto' : '') +
          (pistaUsada?.necesitaTraducir && !vinoDePanelModerno ? ' -> es' : '');

    return {
        fecha,
        titulo: tituloReal,
        idioma: idiomaEtiqueta,
        bloques: construirBloquesSubtitulos(subtitulos, CFG.BLOCK_SIZE).length,
        nombreArchivo: `${fecha} ${seguro(tituloReal)}.txt`,
        bytes: new TextEncoder().encode(contenidoTxt)
    };
}
