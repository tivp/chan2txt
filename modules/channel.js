import {
    win,
    CFG,
    CATEGORIAS,
    estadoFilas,
    guardarEnMapaConLimite
} from './config.js';
import { dormir, texto, seguro, extraerYtInitialDataDeHtml } from './utils.js';
import { construirHeadersInnerTube, peticionHttpBaja, fetchTexto } from './http.js';
import { progreso } from './ui.js';
import { cancelado, verificarCancelacion, descubrirTotalesCanalEnSegundoPlano } from './main.js';

// ==================================================
// DESCUBRIMIENTO DE CANAL Y CONTEO TOTAL DE VIDEOS (UULF / UUSH / UULV)
// ==================================================

export function enPantallaDeCanal() {
    return /^\/(?:@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)(?:\/|$)/i.test(
        location.pathname
    );
}

export function obtenerClaveCanalUrl() {
    const m = location.pathname.match(
        /^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)/i
    );
    return m ? m[1].toLowerCase() : '';
}

export function obtenerNombreCanalDom(initialData = null) {
    const deJson =
        initialData?.metadata?.channelMetadataRenderer?.title ||
        initialData?.header?.pageHeaderRenderer?.pageTitle;
    if (deJson && texto(deJson)) {
        return seguro(deJson, 'Canal de YouTube');
    }

    const h1 = document.querySelector(
        'yt-page-header-view-model h1, #channel-name #text, ytd-channel-name #text'
    );
    if (h1 && texto(h1.textContent)) {
        return seguro(h1.textContent, 'Canal de YouTube');
    }

    const t = texto(document.title).replace(/\s*-\s*YouTube$/i, '');
    return seguro(t, 'Canal de YouTube');
}

export const UC_RE = /^UC[\w-]{22}$/;

export function resolverChannelIdInstantaneo() {
    const metaVal = document.querySelector('meta[itemprop="channelId"]')?.getAttribute('content');
    if (metaVal && UC_RE.test(metaVal)) return metaVal;

    const canonicalMatch = (document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '')
        .match(/\/channel\/(UC[\w-]{22})/);
    if (canonicalMatch?.[1]) return canonicalMatch[1];

    const browseNode = document.querySelector('ytd-browse[page-subtype="channels"], ytd-browse');
    const attrId = browseNode?.getAttribute?.('channel-id') || browseNode?.getAttribute?.('external-id');
    if (attrId && UC_RE.test(attrId)) return attrId;

    const canalHref = document.querySelector('ytd-channel-name a[href*="/channel/UC"], #channel-name a[href*="/channel/UC"], a[href^="/channel/UC"]');
    const hrefMatch = (canalHref?.getAttribute('href') || '').match(/\/channel\/(UC[\w-]{22})/);
    if (hrefMatch?.[1]) return hrefMatch[1];

    try {
        const initData = win.ytInitialData;
        const deInit =
            initData?.metadata?.channelMetadataRenderer?.externalId ||
            initData?.header?.c4TabbedHeaderRenderer?.channelId;
        if (deInit && UC_RE.test(deInit)) return deInit;

        const rows = initData?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel
            ?.metadata?.contentMetadataViewModel?.metadataRows || [];
        for (const row of rows) {
            for (const part of row.metadataParts || []) {
                const txt = part?.text?.content || '';
                if (UC_RE.test(txt)) return txt;
            }
        }
    } catch {}

    try {
        const cfgId = win.ytcfg?.get?.('CHANNEL_ID');
        if (cfgId && UC_RE.test(cfgId)) return cfgId;
    } catch {}

    const urlMatch = location.pathname.match(/\/channel\/(UC[\w-]{22})/);
    if (urlMatch?.[1]) return urlMatch[1];

    return null;
}

export function obtenerConteoAproximadoHeader() {
    try {
        const rows = win.ytInitialData?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel
            ?.metadata?.contentMetadataViewModel?.metadataRows || [];
        for (const fila of rows) {
            for (const parte of fila.metadataParts || []) {
                const txt = parte?.text?.content || '';
                if (/\b\d+(?:[.,]\d+)?\s*[kKmMbB]?\s*video/i.test(txt)) {
                    return txt.trim();
                }
            }
        }
    } catch {}

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

export async function resolverDatosCanalActual() {
    let channelId = resolverChannelIdInstantaneo();
    let clientVersion = win.ytcfg?.get?.('INNERTUBE_CLIENT_VERSION') || '2.20260401.01.00';
    let nombreCanal = obtenerNombreCanalDom(win.ytInitialData);
    let textoTotalHeader = obtenerConteoAproximadoHeader();

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
            htmlCanal.match(/"INNERTUBE_CLIENT_VERSION"\s*:\s*"([^"]+)"/)?.[1] ||
            clientVersion;
    }

    htmlCanal = '';

    if (!nombreCanal || nombreCanal === 'Canal de YouTube') {
        nombreCanal = obtenerNombreCanalDom(initialData);
    }

    if (!textoTotalHeader && initialData) {
        try {
            const filasMeta =
                initialData?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel
                    ?.metadata?.contentMetadataViewModel?.metadataRows || [];
            for (const fila of filasMeta) {
                for (const parte of fila.metadataParts || []) {
                    const txt = parte?.text?.content || '';
                    if (/video|vídeo/i.test(txt)) {
                        textoTotalHeader = txt;
                    }
                }
            }
        } catch {}
    }

    return {
        channelId,
        nombreCanal,
        clientVersion,
        textoTotalHeader
    };
}

export function extraerNumeroEnteroDeTexto(str) {
    const limpio = String(str || '').replace(/[.,\s\u00a0]/g, '');
    const m = limpio.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
}

export function parsearConteoPlaylist(data) {
    try {
        const numTxt =
            data?.header?.playlistHeaderRenderer?.numVideosText?.simpleText ||
            data?.header?.playlistHeaderRenderer?.numVideosText?.runs
                ?.map(r => r.text)
                .join('') ||
            '';
        if (numTxt && !/[kKmM]\b/.test(numTxt)) {
            const n = extraerNumeroEnteroDeTexto(numTxt);
            if (Number.isFinite(n)) return n;
        }

        const stats =
            data?.sidebar?.playlistSidebarRenderer?.items?.[0]
                ?.playlistSidebarPrimaryInfoRenderer?.stats;
        if (Array.isArray(stats) && stats[0]) {
            const txt =
                stats[0].simpleText ||
                stats[0].runs?.map(r => r.text).join('') ||
                '';
            if (!/[kKmM]\b/.test(txt)) {
                const n = extraerNumeroEnteroDeTexto(txt);
                if (Number.isFinite(n)) return n;
            }
        }

        const rows =
            data?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel
                ?.metadata?.contentMetadataViewModel?.metadataRows || [];
        for (const r of rows) {
            for (const p of r.metadataParts || []) {
                const txt = p?.text?.content || '';
                if (/video|vídeo/i.test(txt) && !/[kKmM]\b/.test(txt)) {
                    const n = extraerNumeroEnteroDeTexto(txt);
                    if (Number.isFinite(n)) return n;
                }
            }
        }
    } catch {}
    return null;
}

export function extraerItemsYContinuacionDePlaylist(nodoRaiz, categoria) {
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

        if (obj.videoRenderer || obj.gridVideoRenderer) {
            const vr = obj.videoRenderer || obj.gridVideoRenderer;
            const videoId = vr.videoId;
            const nombre =
                vr.title?.runs?.map(r => r.text).join('') ||
                vr.title?.simpleText ||
                vr.title?.accessibility?.accessibilityData?.label ||
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

        if (obj.reelItemRenderer) {
            const rir = obj.reelItemRenderer;
            const videoId = rir.videoId;
            const nombre =
                rir.headline?.simpleText ||
                rir.headline?.runs?.map(r => r.text).join('') ||
                rir.accessibility?.accessibilityData?.label ||
                videoId;
            if (videoId) {
                videos.push({
                    videoId,
                    nombre: texto(nombre),
                    categoria: 'Shorts'
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
            const videoId =
                mShort?.[1] ||
                slvm.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId ||
                '';
            const nombre =
                slvm.overlayMetadata?.primaryText?.content ||
                slvm.accessibilityText ||
                videoId;
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
                )?.continuationCommand?.token ||
                cir.button?.buttonRenderer?.command?.continuationCommand?.token;
            if (token) {
                tokenContinuacion = token;
            }
            return;
        }

        if (obj.continuationItemViewModel) {
            const civm = obj.continuationItemViewModel;
            const token =
                civm.continuationCommand?.token ||
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

export async function consultarPrimeraPaginaPlaylist(playlistId, categoria) {
    try {
        const url = `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}&hl=es`;
        let html = await fetchTexto(url);
        const data = extraerYtInitialDataDeHtml(html);
        html = '';
        if (!data) {
            return { conteo: 0, videos: [], tokenContinuacion: null, ok: false };
        }

        const { videos, tokenContinuacion } = extraerItemsYContinuacionDePlaylist(
            data.contents,
            categoria
        );

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

export async function cargarContinuacionPlaylist(token, clientVersion, categoria) {
    let ultimoError = null;

    for (let intento = 0; intento < 3; intento++) {
        verificarCancelacion();
        if (intento > 0) {
            await dormir(600 * intento);
            verificarCancelacion();
        }

        let respuestaValida = false;
        let hitRateLimit = false;

        try {
            const { headers, cfg } = await construirHeadersInnerTube(true);
            const urlBrowse = `https://www.youtube.com/youtubei/v1/browse?prettyPrint=false${cfg.apiKey ? `&key=${encodeURIComponent(cfg.apiKey)}` : ''}`;
            const contextPayload = cfg.fullContext || {
                client: {
                    clientName: 'WEB',
                    clientVersion: clientVersion || cfg.clientVersion || '2.20260401.01.00',
                    hl: cfg.hl || 'es',
                    gl: cfg.gl || 'ES',
                    ...(cfg.visitorData ? { visitorData: cfg.visitorData } : {})
                }
            };

            const resp = await peticionHttpBaja(urlBrowse, {
                method: 'POST',
                preferirFetch: true,
                headers,
                body: JSON.stringify({
                    context: contextPayload,
                    continuation: token
                })
            });

            if (resp.status === 429) hitRateLimit = true;
            if (resp.status >= 200 && resp.status < 300 && resp.text) {
                const data = JSON.parse(resp.text);
                const parsed = extraerItemsYContinuacionDePlaylist(data, categoria);
                if (parsed.videos.length > 0) {
                    return parsed;
                }
                respuestaValida = true;
            }
        } catch (e) {
            if (cancelado) throw e;
            ultimoError = e;
        }

        try {
            const respAnon = await peticionHttpBaja(
                'https://www.youtube.com/youtubei/v1/browse?prettyPrint=false',
                {
                    method: 'POST',
                    preferirFetch: true,
                    anonymous: true,
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
                }
            );

            if (respAnon.status === 429) hitRateLimit = true;
            if (respAnon.status >= 200 && respAnon.status < 300 && respAnon.text) {
                const dataAnon = JSON.parse(respAnon.text);
                const parsedAnon = extraerItemsYContinuacionDePlaylist(dataAnon, categoria);
                if (parsedAnon.videos.length > 0) {
                    return parsedAnon;
                }
                respuestaValida = true;
            }
        } catch (e) {
            if (cancelado) throw e;
            ultimoError = e;
        }

        if (hitRateLimit) {
            await dormir(2000);
            continue;
        }

        if (respuestaValida) {
            return { videos: [], tokenContinuacion: null };
        }
    }

    if (ultimoError) throw ultimoError;
    return { videos: [], tokenContinuacion: null };
}

export function obtenerRaizCanalDom() {
    return (
        document.querySelector('ytd-browse[page-subtype="channels"]:not([hidden])') ||
        document.querySelector('ytd-browse:not([hidden])') ||
        document
    );
}

export function obtenerVideosEnPantallaDom() {
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
        let categoria = esTabShorts
            ? 'Shorts'
            : esTabStreams
              ? 'En vivo'
              : 'Videos';

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

// ==================================================
// COLOREADO DE TARJETAS DE VIDEO EN LA CUADRÍCULA DEL CANAL
// ==================================================

export function buscarTarjetaVideoDom(videoId) {
    if (!videoId) return null;
    const raiz = obtenerRaizCanalDom();
    const link = raiz.querySelector(`a[href*="${videoId}"]`);
    return (
        link?.closest(
            'ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer, yt-lockup-view-model, ytm-shorts-lockup-view-model'
        ) || null
    );
}

export function colorearVideoDom(videoId, estado, detalle) {
    if (!videoId) return;
    guardarEnMapaConLimite(estadoFilas, videoId, { estado, detalle }, 500);

    const card = buscarTarjetaVideoDom(videoId);
    if (!card) return;

    card.classList.remove(
        'maximus-fila-ok',
        'maximus-fila-error',
        'maximus-fila-omitido',
        'maximus-fila-sin-subtitulos'
    );
    card.classList.add(`maximus-fila-${estado}`);
    card.title = detalle;
}

export function restaurarColoresVideosDom() {
    for (const [videoId, info] of estadoFilas.entries()) {
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

// ==================================================
// RECOLECCIÓN COMPLETA DE LA COLA DE VIDEOS SEGÚN EL MODO ELEGIDO
// ==================================================

export async function construirColaVideos(pc) {
    if (pc.modo === 'pantalla') {
        const enDom = obtenerVideosEnPantallaDom();
        if (!enDom.length) {
            throw new Error('No se encontraron videos visibles en la pantalla actual');
        }
        return enDom;
    }

    if (!pc.conteoListo || pc.categoriasDescubiertas.size === 0) {
        progreso(pc, 0, 1, 'Obteniendo información del canal...');
        await descubrirTotalesCanalEnSegundoPlano(pc);
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

        while (
            token &&
            cola.length + listaCat.length < limiteGlobal &&
            pagina < 500
        ) {
            verificarCancelacion();
            progreso(
                pc,
                listaCat.length,
                infoCat.conteo || listaCat.length + 100,
                `Listando ${cat.clave} del canal (${listaCat.length}/${infoCat.conteo || '?'})...`
            );

            try {
                const sig = await cargarContinuacionPlaylist(
                    token,
                    pc.clientVersion,
                    cat.clave
                );
                if (!sig.videos.length) break;
                listaCat.push(...sig.videos);
                token = sig.tokenContinuacion;
                pagina++;
            } catch (e) {
                if (cancelado || e?.esCancelacion) throw e;
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
                carpeta: v.categoria === 'Shorts' ? 'Shorts' : 'Videos'
            });
        }

        while (tokenUU && cola.length < limiteGlobal && paginaUU < 500) {
            verificarCancelacion();
            progreso(
                pc,
                cola.length,
                pc.totalExactoCanal || cola.length + 100,
                `Listando videos del canal (${cola.length}/${pc.totalExactoCanal || '?'})...`
            );
            try {
                const sig = await cargarContinuacionPlaylist(
                    tokenUU,
                    pc.clientVersion,
                    'Videos'
                );
                if (!sig.videos.length) break;
                for (const v of sig.videos) {
                    if (cola.length >= limiteGlobal) break;
                    if (vistos.has(v.videoId)) continue;
                    vistos.add(v.videoId);
                    cola.push({
                        ...v,
                        carpeta: v.categoria === 'Shorts' ? 'Shorts' : 'Videos'
                    });
                }
                tokenUU = sig.tokenContinuacion;
                paginaUU++;
            } catch (e) {
                if (cancelado || e?.esCancelacion) throw e;
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
