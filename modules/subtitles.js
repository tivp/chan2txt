import { CFG, _potParamsByVideoId, _subtitulosCachePorVideoId } from './config.js';
import { _potLatestParams } from './interceptor.js';

// ==================================================
// CODIFICADOR PROTOBUF PARA /youtubei/v1/get_transcript
// ==================================================

export function encodeVarint(num) {
    const bytes = [];
    let n = num >>> 0;
    while (n > 127) {
        bytes.push((n & 0x7f) | 0x80);
        n >>>= 7;
    }
    bytes.push(n);
    return bytes;
}

export function encodeProtobufString(fieldNumber, str) {
    const utf8 = Array.from(new TextEncoder().encode(String(str)));
    const tag = (fieldNumber << 3) | 2;
    return [...encodeVarint(tag), ...encodeVarint(utf8.length), ...utf8];
}

export function bytesToBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) {
        bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin);
}

export function generarParamsProtobufGetTranscript(videoId, languageCode = 'es', kind = 'asr') {
    const candidatos = [];
    const idiomas = Array.from(new Set([languageCode || 'es', 'es', 'es-419', 'es-ES', 'en']));
    const tipos = Array.from(new Set([kind ?? 'asr', 'asr', '']));

    for (const lang of idiomas) {
        for (const k of tipos) {
            const inner = [
                ...encodeProtobufString(1, k),
                ...encodeProtobufString(2, lang),
                ...encodeProtobufString(3, '')
            ];
            const innerB64Url = encodeURIComponent(bytesToBase64(inner));
            const outerA = [
                ...encodeProtobufString(1, videoId),
                ...encodeProtobufString(2, innerB64Url),
                0x18, 0x01
            ];
            candidatos.push(bytesToBase64(outerA));

            const innerB64Raw = bytesToBase64(inner);
            const outerB = [
                ...encodeProtobufString(1, videoId),
                ...encodeProtobufString(2, innerB64Raw),
                0x18, 0x01
            ];
            candidatos.push(bytesToBase64(outerB));
        }
    }

    const outerDefault = [
        ...encodeProtobufString(1, videoId),
        0x18, 0x01
    ];
    candidatos.push(bytesToBase64(outerDefault));

    return Array.from(new Set(candidatos));
}

// Genera params Base64 del panel moderno de transcripcion (PAmodern_transcript_view)
export function generarParamsProtobufGetPanel(videoId) {
    if (!videoId) return '';
    const idBytes = Array.from(new TextEncoder().encode(String(videoId).trim()));
    const pushVarint = (arr, n) => {
        let v = n >>> 0;
        while (v >= 0x80) {
            arr.push((v & 0x7f) | 0x80);
            v >>>= 7;
        }
        arr.push(v);
    };
    const inner = [0x0a];
    pushVarint(inner, idBytes.length);
    inner.push(...idBytes, 0x18, 0x02);
    const outer = [0xaa, 0x09];
    pushVarint(outer, inner.length);
    outer.push(...inner);
    return bytesToBase64(outer);
}

// ==================================================
// NÚCLEO DE FORMATEO DE SUBTÍTULOS (BLOQUES DE 200 CARACTERES)
// ==================================================

export const ENTIDADES_HTML = Object.freeze({
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' '
});

export function decodeHtmlEntities(raw) {
    let str = String(raw ?? '');
    for (let pase = 0; pase < 2; pase++) {
        if (!str.includes('&')) break;
        str = str.replace(/&(?:#(\d+)|#x([\da-fA-F]+)|([a-zA-Z]+));/g, (match, dec, hex, named) => {
            if (dec !== undefined) {
                const cp = parseInt(dec, 10);
                return Number.isFinite(cp) ? String.fromCodePoint(cp) : match;
            }
            if (hex !== undefined) {
                const cp = parseInt(hex, 16);
                return Number.isFinite(cp) ? String.fromCodePoint(cp) : match;
            }
            const key = named.toLowerCase();
            return Object.prototype.hasOwnProperty.call(ENTIDADES_HTML, key)
                ? ENTIDADES_HTML[key]
                : match;
        });
    }
    return str;
}

export function formatTime(time) {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    if (hours > 0) {
        return `${String(hours)}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
}

export const pad2 = value => String(value).padStart(2, '0');

export const formatTxtTime = seconds =>
    `${Math.floor(seconds / 60)}:${pad2(Math.floor(seconds % 60))}`;

export function toSubtitles(cues) {
    return cues.map(({ text, start, dur }, index) => {
        const next = cues[index + 1];
        return {
            text,
            start,
            end: next ? next.start : start + dur,
            startInFormat: formatTime(start)
        };
    });
}

export function parseYouTubeSubtitles(xml) {
    const cues = [];
    const reText = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi;
    let m;
    while ((m = reText.exec(xml)) !== null) {
        const attrs = m[1] || '';
        const rawBody = m[2] || '';
        const mStart = attrs.match(/\bstart\s*=\s*["']([^"']+)["']/i);
        const mDur = attrs.match(/\bdur\s*=\s*["']([^"']+)["']/i);
        const limpio = rawBody.replace(/<[^>]+>/g, '').trim();
        if (limpio) {
            cues.push({
                text: limpio,
                start: parseFloat(mStart ? mStart[1] : '0') || 0,
                dur: parseFloat(mDur ? mDur[1] : '0') || 0
            });
        }
    }

    if (cues.length === 0) {
        const reP = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
        while ((m = reP.exec(xml)) !== null) {
            const attrs = m[1] || '';
            const rawBody = m[2] || '';
            const mT = attrs.match(/\bt\s*=\s*["']([^"']+)["']/i);
            const mD = attrs.match(/\bd\s*=\s*["']([^"']+)["']/i);
            const mStart = attrs.match(/\bstart\s*=\s*["']([^"']+)["']/i);
            const mDur = attrs.match(/\bdur\s*=\s*["']([^"']+)["']/i);
            const limpio = rawBody.replace(/<[^>]+>/g, '').trim();
            if (limpio) {
                const startVal = mT ? (parseFloat(mT[1]) || 0) / 1000 : (parseFloat(mStart ? mStart[1] : '0') || 0);
                const durVal = mD ? (parseFloat(mD[1]) || 0) / 1000 : (parseFloat(mDur ? mDur[1] : '0') || 0);
                cues.push({
                    text: limpio,
                    start: startVal,
                    dur: durVal
                });
            }
        }
    }

    return toSubtitles(cues);
}

export function parseJson3Subtitles(jsonStr) {
    const events = JSON.parse(jsonStr)?.events ?? [];
    return toSubtitles(
        events
            .filter(event => Array.isArray(event.segs) && !event.aAppend)
            .map(event => ({
                text: event.segs.map(seg => seg.utf8 ?? '').join(''),
                start: (event.tStartMs ?? 0) / 1000,
                dur: (event.dDurationMs ?? 0) / 1000
            }))
    );
}

export function parseSubtitleVTT(vttText) {
    const cues = [];
    String(vttText || '').replace(/\r/g, '').split(/\n\n+/).forEach(block => {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        if (!lines.length || lines[0] === 'WEBVTT') return;
        const timeIndex = lines.findIndex(l => l.includes('-->'));
        if (timeIndex < 0) return;
        const parts = lines[timeIndex].split('-->');
        if (parts.length < 2) return;
        const start = parseClockTimeToSeconds(parts[0].trim());
        const end = parseClockTimeToSeconds(parts[1].trim().split(/\s+/)[0]);
        const dur = Math.max(0, end - start);
        const text = lines.slice(timeIndex + 1).join(' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        if (text) cues.push({ start, dur, text });
    });
    return toSubtitles(cues);
}

export function parseClockTimeToSeconds(val) {
    const s = String(val || '').trim();
    if (!s) return 0;
    const parts = s.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return Number(s) || 0;
}

export function decodeSubtitles(subtitles) {
    return subtitles.map(subtitle => {
        let cleanedText = decodeHtmlEntities(subtitle.text);
        if (CFG.CLEAN_SUBTITLES) {
            cleanedText = cleanedText
                .replace(/\[.*?\]/g, '')
                .replace(/\s*>>\s*/g, ' ')
                .replace(/\s*♪\s*/g, ' ')
                .replace(/\s*━\s*/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }
        return {
            ...subtitle,
            text: cleanedText
        };
    });
}

export function construirBloquesSubtitulos(originals, blockSize = CFG.BLOCK_SIZE) {
    const merged = [];
    let block = null;
    let length = 0;

    originals.forEach((sub, index) => {
        const raw = String(sub.text ?? '').replace(/\s+/g, ' ').trim();
        if (!raw) return;

        const textSegment = {
            text: raw,
            start: sub.start,
            end: sub.end,
            index
        };

        if (block !== null && length + raw.length + 1 <= blockSize) {
            block.end = sub.end;
            block.textSegments.push(textSegment);
            length += raw.length + 1;
            return;
        }

        if (block !== null) {
            merged.push(block);
        }

        block = {
            ...sub,
            textSegments: [textSegment]
        };
        length = raw.length;
    });

    if (block !== null) {
        merged.push(block);
    }

    return merged
        .map(item => ({
            start: item.start,
            end: item.end,
            text: item.textSegments
                .map(segment => segment.text)
                .filter(Boolean)
                .join(' ')
        }))
        .filter(u => u.text !== '');
}

export function construirArchivoTxt(originals, { title, videoId }) {
    const units = construirBloquesSubtitulos(originals, CFG.BLOCK_SIZE);
    const url = videoId ? `https://youtu.be/${videoId}` : '';

    const head = CFG.EXPORT_HEADER
        ? [title, url].filter(Boolean).join('\n') + '\n\n'
        : '';

    const cuerpo = units
        .map(
            unit =>
                (CFG.EXPORT_TIME ? `${formatTxtTime(unit.start)}\n` : '') +
                unit.text
        )
        .join('\n\n');

    return head + cuerpo;
}

export function elegirPistaSubtitulo(captionTracks) {
    if (!Array.isArray(captionTracks) || !captionTracks.length) return null;

    const esEspanol = code => /^es(?:-|$)/i.test(String(code || ''));

    const esManual = captionTracks.find(t => esEspanol(t.languageCode) && t.kind !== 'asr');
    if (esManual) return { ...esManual, necesitaTraducir: false };

    const esAuto = captionTracks.find(t => esEspanol(t.languageCode) && t.kind === 'asr');
    if (esAuto) return { ...esAuto, necesitaTraducir: false };

    const origManual = captionTracks.find(t => t.kind !== 'asr');
    if (origManual) return { ...origManual, necesitaTraducir: true };

    return { ...captionTracks[0], necesitaTraducir: true };
}

export function agregarParametroSinRomperFirma(urlFirmada, clave, valor) {
    if (!urlFirmada) return urlFirmada;
    const re = new RegExp(`([?&])${clave}=[^&]*`);
    if (re.test(urlFirmada)) return urlFirmada;
    const sep = urlFirmada.includes('?') ? '&' : '?';
    return `${urlFirmada}${sep}${clave}=${encodeURIComponent(valor)}`;
}

export function generarCandidatosSubtitulos(baseUrl, videoId, codigoIdioma = 'es', esAuto = false, necesitaTraducir = false) {
    const candidatos = [];

    if (baseUrl) {
        const urlLimpia = baseUrl.replace(/\\u0026/g, '&');
        const potParams = (videoId ? _potParamsByVideoId.get(videoId) : null) || _potLatestParams;

        const aplicarPot = urlBase => {
            if (!potParams || Object.keys(potParams).length === 0) return null;
            let u = urlBase;
            for (const [k, v] of Object.entries(potParams)) {
                u = agregarParametroSinRomperFirma(u, k, v);
            }
            return u;
        };

        const baseList = [];
        if (!necesitaTraducir) {
            baseList.push(urlLimpia);
            for (const fmt of ['json3', 'srv1', 'srv3', 'vtt']) {
                baseList.push(agregarParametroSinRomperFirma(urlLimpia, 'fmt', fmt));
            }
        } else {
            const urlTraducida = agregarParametroSinRomperFirma(urlLimpia, 'tlang', 'es');
            baseList.push(urlTraducida);
            for (const fmt of ['json3', 'srv1', 'srv3', 'vtt']) {
                baseList.push(agregarParametroSinRomperFirma(urlTraducida, 'fmt', fmt));
            }
            baseList.push(urlLimpia);
            baseList.push(agregarParametroSinRomperFirma(urlLimpia, 'fmt', 'json3'));
        }

        for (const b of baseList) {
            const conPot = aplicarPot(b);
            if (conPot) candidatos.push(conPot);
            candidatos.push(b);
        }
    }

    return Array.from(new Set(candidatos));
}

export function parsearPayloadSubtitulo(textoRaw) {
    const limpio = String(textoRaw || '').trim();
    if (!limpio || limpio.length < 10) return null;
    if (limpio.includes('<!DOCTYPE') || limpio.includes('<html') || limpio.includes('</html>')) {
        return null;
    }

    try {
        if (limpio.startsWith('{')) {
            const cues = parseJson3Subtitles(limpio);
            if (cues && cues.length > 0) return cues;
        }
        if (limpio.includes('WEBVTT') || limpio.includes('-->')) {
            const cues = parseSubtitleVTT(limpio);
            if (cues && cues.length > 0) return cues;
        }
        if (
            limpio.includes('<transcript') ||
            limpio.includes('<text') ||
            limpio.includes('<timedtext') ||
            limpio.includes('<p ') ||
            limpio.includes('<tt')
        ) {
            const cues = parseYouTubeSubtitles(limpio);
            if (cues && cues.length > 0) return cues;
        }
    } catch {}

    return null;
}

export function parsearRespuestaGetPanel(data) {
    return parsearRespuestaGetTranscript(data);
}

export function parsearRespuestaGetTranscript(data) {
    const cues = [];

    const recorrer = (nodo, startSecPadre = null) => {
        if (!nodo || typeof nodo !== 'object') return;
        if (Array.isArray(nodo)) {
            for (const el of nodo) recorrer(el, startSecPadre);
            return;
        }

        if (nodo.transcriptSegmentRenderer) {
            const seg = nodo.transcriptSegmentRenderer;
            const startMs = parseFloat(seg.startMs || '0');
            const endMs = parseFloat(seg.endMs || String(startMs + 2500));
            const txt =
                seg.snippet?.runs?.map(r => r.text).join('') ||
                seg.snippet?.elementsAttributedString?.content ||
                seg.snippet?.simpleText ||
                '';
            if (txt.trim()) {
                cues.push({
                    text: txt.trim(),
                    start: startMs / 1000,
                    dur: Math.max(0.5, (endMs - startMs) / 1000)
                });
            }
            return;
        }

        if (nodo.transcriptSegmentViewModel) {
            const vm = nodo.transcriptSegmentViewModel;
            const txt =
                vm.simpleText ||
                vm.text?.content ||
                vm.snippet?.content ||
                vm.subtitle?.content ||
                (Array.isArray(vm.snippet?.runs) ? vm.snippet.runs.map(r => r?.text || '').join('') : '') ||
                '';
            let startSec = typeof startSecPadre === 'number' && !Number.isNaN(startSecPadre)
                ? startSecPadre
                : 0;
            if (vm.startTimeMs !== undefined) {
                startSec = parseFloat(vm.startTimeMs) / 1000;
            } else if (startSecPadre === null || startSecPadre === undefined) {
                const tsRaw = typeof vm.timestamp === 'string'
                    ? vm.timestamp
                    : (vm.timestamp?.content || vm.timestampText || '');
                if (tsRaw) startSec = parseClockTimeToSeconds(tsRaw);
            }
            if (txt.trim()) {
                cues.push({
                    text: txt.trim(),
                    start: startSec,
                    dur: 2.5
                });
            }
            return;
        }

        if (nodo.macroMarkersPanelItemViewModel && nodo.macroMarkersPanelItemViewModel.item) {
            const m = nodo.macroMarkersPanelItemViewModel;
            const startRaw = m.onTap?.innertubeCommand?.watchEndpoint?.startTimeSeconds;
            const startHeredado = startRaw !== undefined && startRaw !== null && !Number.isNaN(Number(startRaw))
                ? Number(startRaw)
                : startSecPadre;
            recorrer(m.item, startHeredado);
            return;
        }

        for (const v of Object.values(nodo)) {
            if (v && typeof v === 'object') recorrer(v, startSecPadre);
        }
    };

    recorrer(data);

    if (cues.length > 0) {
        return decodeSubtitles(toSubtitles(cues)).filter(s => s.text.length > 0);
    }
    return [];
}

export function convertirDomCuesASubtitulos(domCues) {
    if (!Array.isArray(domCues) || !domCues.length) return [];
    const cues = domCues.map(c => ({
        text: c.bTxt,
        start: parseClockTimeToSeconds(c.tTxt),
        dur: 2.5
    }));
    return decodeSubtitles(toSubtitles(cues)).filter(s => s.text.length > 0);
}
