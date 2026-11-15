import {
    win,
    esIframe,
    esIframeTrabajador,
    _potCarriedParamNames,
    _potParamsByVideoId,
    _subtitulosCachePorVideoId,
    _transcriptJsonPorVideoId,
    guardarEnMapaConLimite,
    callbacksWorkersIframe
} from './config.js';

// ==================================================
// INTERCEPTACIÓN EN VIVO DE SUBTÍTULOS, GET_TRANSCRIPT Y TOKENS POT
// ==================================================
export let _potLatestParams = null;
let _potHooksInstalled = false;

export function _rememberPotFromTimedtextUrl(rawUrl) {
    try {
        if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.includes('/api/timedtext')) return;
        const u = new URL(rawUrl, 'https://www.youtube.com');
        const videoId = u.searchParams.get('v');
        const pot = u.searchParams.get('pot');
        if (pot) {
            const collected = {};
            for (const name of _potCarriedParamNames) {
                const val = u.searchParams.get(name);
                if (val !== null && val !== '') collected[name] = val;
            }
            _potLatestParams = collected;
            if (videoId) {
                guardarEnMapaConLimite(_potParamsByVideoId, videoId, collected, 80);
            }
            if (esIframeTrabajador && window.parent && window.parent !== window) {
                try {
                    window.parent.postMessage({
                        type: 'MAXIMUS_POT_CAPTURED',
                        videoId,
                        potParams: collected
                    }, '*');
                } catch {}
            }
        }
    } catch {}
}

export function _rememberSubtitleBody(rawUrl, bodyText) {
    try {
        if (!rawUrl || typeof rawUrl !== 'string') return;
        if (typeof bodyText !== 'string' || bodyText.trim().length < 15 || bodyText.length > 2500000) return;

        if (rawUrl.includes('/api/timedtext')) {
            const u = new URL(rawUrl, 'https://www.youtube.com');
            const videoId = u.searchParams.get('v');
            if (videoId) {
                guardarEnMapaConLimite(_subtitulosCachePorVideoId, videoId, bodyText, 50);
                if (esIframeTrabajador && window.parent && window.parent !== window) {
                    try {
                        window.parent.postMessage({
                            type: 'MAXIMUS_SUBTITLE_CAPTURED',
                            videoId,
                            rawPayload: bodyText
                        }, '*');
                    } catch {}
                }
            }
        } else if (rawUrl.includes('/youtubei/v1/get_transcript') || rawUrl.includes('/youtubei/v1/get_panel')) {
            const vidActual = new URLSearchParams(location.search).get('v') || '';
            if (vidActual && (bodyText.includes('transcriptSegment') || bodyText.includes('transcriptCue'))) {
                guardarEnMapaConLimite(_transcriptJsonPorVideoId, vidActual, bodyText, 50);
                if (esIframeTrabajador && window.parent && window.parent !== window) {
                    try {
                        window.parent.postMessage({
                            type: 'MAXIMUS_TRANSCRIPT_JSON_CAPTURED',
                            videoId: vidActual,
                            rawTranscriptJson: bodyText
                        }, '*');
                    } catch {}
                }
            }
        }
    } catch {}
}

export function _installPotHooksOnce() {
    if (esIframe && !esIframeTrabajador) return;
    if (_potHooksInstalled) return;
    if (!win) return;
    try {
        const origFetch = win.fetch;
        if (typeof origFetch === 'function') {
            win.fetch = function (...args) {
                try {
                    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
                    if (url && typeof url === 'string' && (url.includes('/api/timedtext') || url.includes('/youtubei/v1/get_transcript') || url.includes('/youtubei/v1/get_panel'))) {
                        if (url.includes('/api/timedtext')) _rememberPotFromTimedtextUrl(url);
                        const p = origFetch.apply(this, args);
                        p.then(res => {
                            if (res && res.ok) {
                                res.clone().text().then(b => _rememberSubtitleBody(url, b)).catch(() => {});
                            }
                        }).catch(() => {});
                        return p;
                    }
                } catch {}
                return origFetch.apply(this, args);
            };
        }
        const xhrProto = win.XMLHttpRequest?.prototype;
        if (xhrProto && typeof xhrProto.open === 'function') {
            const origOpen = xhrProto.open;
            xhrProto.open = function (...args) {
                try {
                    const url = args[1];
                    if (url && typeof url === 'string' && (url.includes('/api/timedtext') || url.includes('/youtubei/v1/get_transcript') || url.includes('/youtubei/v1/get_panel'))) {
                        if (url.includes('/api/timedtext')) _rememberPotFromTimedtextUrl(url);
                        this.addEventListener('loadend', function () {
                            try {
                                if (this.status === 200 && typeof this.responseText === 'string') {
                                    _rememberSubtitleBody(url, this.responseText);
                                }
                            } catch {}
                        }, { once: true });
                    }
                } catch {}
                return origOpen.apply(this, args);
            };
        }
        _potHooksInstalled = true;
    } catch {}
}
_installPotHooksOnce();

export function _esAnuncioEnReproductor(mp, workerVideoId = '') {
    if (!mp) return false;
    if (
        mp.classList.contains('ad-showing') ||
        mp.classList.contains('ad-interrupting') ||
        mp.classList.contains('ytp-ad-playing') ||
        mp.classList.contains('ytp-ad-showing')
    ) {
        return true;
    }
    try {
        const vd = mp.getVideoData?.();
        if (workerVideoId && vd?.video_id && vd.video_id !== workerVideoId) {
            return true;
        }
    } catch {}
    return false;
}

function _esSegmentoInitMedia(u8) {
    if (!u8 || u8.byteLength < 8) return false;
    // WebM EBML header: 1A 45 DF A3
    if (u8[0] === 0x1a && u8[1] === 0x45 && u8[2] === 0xdf && u8[3] === 0xa3) return true;
    // MP4 ftyp box
    if (u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) return true;
    return false;
}

export function _installAudioSourceBufferHookOnce() {
    if (!esIframeTrabajador || !location.search.includes('maximus_audio=1')) return;
    if (win.__chan2txtAudioCap?.instalado) return;
    if (!win?.MediaSource?.prototype || !win?.SourceBuffer?.prototype) return;

    try {
        const paramsAudio = new URLSearchParams(location.search);
        const workerVid =
            paramsAudio.get('v') ||
            (location.pathname.match(/\/shorts\/([^/?]+)/)?.[1] || '');

        const cap = {
            instalado: true,
            workerVideoId: workerVid,
            vioAnuncio: false,
            entries: new Map(),
            activeEntry: null,
            mime: '',
            totalBytes: 0,
            lastAppendAt: 0,
            seq: 1
        };
        win.__chan2txtAudioCap = cap;

        const origAdd = win.MediaSource.prototype.addSourceBuffer;
        win.MediaSource.prototype.addSourceBuffer = function (mime) {
            const sb = origAdd.call(this, mime);
            if (String(mime).startsWith('audio/')) {
                cap.entries.set(sb, {
                    id: cap.seq++,
                    ms: this,
                    sb,
                    mime: String(mime),
                    chunks: [],
                    bytes: 0
                });
            }
            return sb;
        };

        const origAppend = win.SourceBuffer.prototype.appendBuffer;
        win.SourceBuffer.prototype.appendBuffer = function (data) {
            const entry = cap.entries.get(this);
            if (entry && entry.bytes < 120 * 1024 * 1024) {
                const mp = document.getElementById('movie_player');
                if (_esAnuncioEnReproductor(mp, cap.workerVideoId)) {
                    cap.vioAnuncio = true;
                } else if (data) {
                    const u8 =
                        data instanceof ArrayBuffer
                            ? new Uint8Array(data)
                            : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
                    const copy = u8.slice();
                    if (cap.vioAnuncio && _esSegmentoInitMedia(copy)) {
                        entry.chunks = [];
                        entry.bytes = 0;
                        cap.vioAnuncio = false;
                    }
                    entry.chunks.push(copy);
                    entry.bytes += copy.byteLength;
                    cap.activeEntry = entry;
                    cap.mime = entry.mime;
                    cap.totalBytes = entry.bytes;
                    cap.lastAppendAt = Date.now();
                }
            }
            return origAppend.apply(this, arguments);
        };
    } catch {}
}
_installAudioSourceBufferHookOnce();

if (!esIframe) {
    window.addEventListener('message', ev => {
        try {
            const d = ev.data;
            if (!d || typeof d !== 'object') return;

            if (d.type === 'MAXIMUS_POT_CAPTURED' && d.potParams) {
                _potLatestParams = d.potParams;
                if (d.videoId) {
                    guardarEnMapaConLimite(_potParamsByVideoId, d.videoId, d.potParams, 80);
                }
            }

            if (d.type === 'MAXIMUS_SUBTITLE_CAPTURED' && d.videoId && d.rawPayload) {
                guardarEnMapaConLimite(_subtitulosCachePorVideoId, d.videoId, d.rawPayload, 50);
            }

            if (d.type === 'MAXIMUS_TRANSCRIPT_JSON_CAPTURED' && d.videoId && d.rawTranscriptJson) {
                guardarEnMapaConLimite(_transcriptJsonPorVideoId, d.videoId, d.rawTranscriptJson, 50);
            }

            if (d.type === 'MAXIMUS_WORKER_DONE' && d.videoId) {
                if (d.potParams) {
                    _potLatestParams = d.potParams;
                    guardarEnMapaConLimite(_potParamsByVideoId, d.videoId, d.potParams, 80);
                }
                if (d.rawTimedtextPayload) {
                    guardarEnMapaConLimite(_subtitulosCachePorVideoId, d.videoId, d.rawTimedtextPayload, 50);
                }
                if (d.rawTranscriptJson) {
                    guardarEnMapaConLimite(_transcriptJsonPorVideoId, d.videoId, d.rawTranscriptJson, 50);
                }
                const resolver = callbacksWorkersIframe.get(d.videoId);
                if (resolver) {
                    callbacksWorkersIframe.delete(d.videoId);
                    resolver(d);
                }
            }
        } catch {}
    });
}
