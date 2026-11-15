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
    const raw = String(vttText || '').replace(/\r/g, '');
    const parsedCues = [];

    for (const block of raw.split(/\n\n+/)) {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        if (!lines.length) continue;
        if (
            lines[0].startsWith('WEBVTT') ||
            lines[0].startsWith('NOTE') ||
            lines[0].startsWith('STYLE') ||
            lines[0].startsWith('REGION')
        ) {
            continue;
        }
        const timeIndex = lines.findIndex(l => l.includes('-->'));
        if (timeIndex < 0) continue;
        const parts = lines[timeIndex].split('-->');
        if (parts.length < 2) continue;

        const start = parseClockTimeToSeconds(parts[0].trim());
        const end = parseClockTimeToSeconds(parts[1].trim().split(/\s+/)[0]);
        const dur = Math.max(0, end - start);
        const textLines = lines
            .slice(timeIndex + 1)
            .map(l => decodeHtmlEntities(l.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim())
            .filter(Boolean);

        if (textLines.length) {
            parsedCues.push({ start, end: start + dur, dur, textLines });
        }
    }

    // YouTube ASR en WebVTT usa rolling de 2 líneas, etiquetas <c>/<hh:mm:ss.ms> y cues de transición <=50ms
    const pareceRollingYt = /<c(?:\.[^>]+)?>|<\d{2}:\d{2}:\d{2}\.\d{3}>/.test(raw)
        || /^Kind:\s*captions/im.test(raw)
        || parsedCues.some(c => c.dur > 0 && c.dur <= 0.05);

    const cues = [];
    if (!pareceRollingYt) {
        for (const c of parsedCues) {
            const text = c.textLines.join(' ').replace(/\s+/g, ' ').trim();
            if (!text) continue;
            const prev = cues[cues.length - 1];
            if (prev && prev.text === text && Math.abs(c.start - prev.start) < 0.2) continue;
            cues.push({ start: c.start, dur: c.dur, text });
        }
        return toSubtitles(cues);
    }

    let prevLine = '';
    let prevEnd = 0;
    for (const c of parsedCues) {
        const isTinyFlush = c.dur <= 0.05;
        const picked = [];
        for (const line of c.textLines) {
            if (!line) continue;
            const esArrastre = line === prevLine && (c.textLines.length > 1 || isTinyFlush || Math.abs(c.start - prevEnd) < 0.25);
            if (esArrastre) continue;
            const lastOut = cues[cues.length - 1];
            if (lastOut && lastOut.text === line && Math.abs(c.start - lastOut.start) < 1.5) continue;
            if (isTinyFlush && lastOut && lastOut.text.endsWith(line)) continue;
            picked.push(line);
        }
        const lastLine = c.textLines[c.textLines.length - 1];
        if (lastLine) prevLine = lastLine;
        prevEnd = c.end;

        const text = picked.join(' ').replace(/\s+/g, ' ').trim();
        if (text) cues.push({ start: c.start, dur: c.dur, text });
    }
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

const REGEX_SCRIPT_LATINO = /^(?:es|en|pt|fr|it|de|ca|gl|nl|sv|no|da|ro|pl|cs|hu|fi|id|ms|tr)(?:-|$)/i;

export function esIdiomaScriptLatino(code) {
    return REGEX_SCRIPT_LATINO.test(String(code || ''));
}

export function elegirPistaSubtitulo(captionTracks) {
    if (!Array.isArray(captionTracks) || !captionTracks.length) return null;

    const esEspanol = code => /^es(?:-|$)/i.test(String(code || ''));
    const esIngles = code => /^en(?:-|$)/i.test(String(code || ''));

    const esManual = captionTracks.find(t => esEspanol(t.languageCode) && t.kind !== 'asr');
    if (esManual) return { ...esManual, necesitaTraducir: false };

    const esAuto = captionTracks.find(t => esEspanol(t.languageCode) && t.kind === 'asr');
    if (esAuto) return { ...esAuto, necesitaTraducir: false };

    const enManual = captionTracks.find(t => esIngles(t.languageCode) && t.kind !== 'asr');
    if (enManual) return { ...enManual, necesitaTraducir: true };

    const latinManual = captionTracks.find(t => esIdiomaScriptLatino(t.languageCode) && t.kind !== 'asr');
    if (latinManual) return { ...latinManual, necesitaTraducir: true };

    const origManual = captionTracks.find(t => t.kind !== 'asr');
    if (origManual) return { ...origManual, necesitaTraducir: true };

    // En pistas automáticas sin español, priorizar inglés/latino antes que ASR no latino (p. ej. árabe)
    const enAuto = captionTracks.find(t => esIngles(t.languageCode));
    if (enAuto) return { ...enAuto, necesitaTraducir: true };

    const latinAuto = captionTracks.find(t => esIdiomaScriptLatino(t.languageCode));
    if (latinAuto) return { ...latinAuto, necesitaTraducir: true };

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

// ==================================================
// CAPA 6: RESCATE DE AUDIO-A-TXT (WHISPER WEBGPU / APIS CORS)
// ==================================================

export const STT_CONFIG_KEY = 'chan2txt_stt_cfg_v1';

export const STT_DEFAULT_CFG = Object.freeze({
    motor: 'auto', // 'auto' | 'offscreen' | 'groq' | 'gemini' | 'hf_router' | 'local_http' | 'hf_space' | 'off'
    modeloLocal: 'onnx-community/whisper-small',
    groqKey: '',
    geminiKey: '',
    hfToken: '',
    localUrl: 'http://127.0.0.1:8000/v1/audio/transcriptions',
    localModel: 'whisper-1'
});

let _hfSpaceEnfriamientoHasta = 0;
let _offscreenProbeCache = { ts: 0, disponible: false, hasGpu: false, device: 'none' };

export function leerConfigStt() {
    const base = { ...STT_DEFAULT_CFG };
    try {
        const gWin = typeof globalThis !== 'undefined' ? globalThis : window;
        let raw = null;
        if (typeof gWin?.GM_getValue === 'function') {
            raw = gWin.GM_getValue(STT_CONFIG_KEY, null);
        }
        if (!raw && typeof localStorage !== 'undefined') {
            raw = localStorage.getItem(STT_CONFIG_KEY);
        }
        if (typeof raw === 'string' && raw.trim()) {
            Object.assign(base, JSON.parse(raw));
        } else if (raw && typeof raw === 'object') {
            Object.assign(base, raw);
        }
    } catch {}
    return base;
}

export function guardarConfigStt(patch) {
    const nueva = { ...leerConfigStt(), ...(patch || {}) };
    try {
        const gWin = typeof globalThis !== 'undefined' ? globalThis : window;
        const json = JSON.stringify(nueva);
        if (typeof gWin?.GM_setValue === 'function') {
            gWin.GM_setValue(STT_CONFIG_KEY, json);
        }
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STT_CONFIG_KEY, json);
        }
    } catch {}
    return nueva;
}

function uint8ToBase64(u8) {
    const chunk = 0x8000;
    let bin = '';
    for (let i = 0; i < u8.length; i += chunk) {
        bin += String.fromCharCode(...u8.subarray(i, i + chunk));
    }
    return btoa(bin);
}

function base64ToUint8(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        out[i] = bin.charCodeAt(i);
    }
    return out;
}

function dormirStt(ms) {
    return new Promise(r => setTimeout(r, ms));
}

export function puenteOffscreenStt(op, payload = {}, timeoutMs = 95000) {
    return new Promise(resolve => {
        if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
            resolve({ ok: false, error: 'Sin entorno window' });
            return;
        }
        const requestId = `stt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const eventRes = `maximus-bridge-stt-res-${requestId}`;
        let terminado = false;
        let timer = null;

        const onRes = ev => {
            if (terminado) return;
            terminado = true;
            clearTimeout(timer);
            window.removeEventListener(eventRes, onRes);
            resolve(ev.detail || { ok: false, error: 'Respuesta vacía de bridge STT' });
        };

        window.addEventListener(eventRes, onRes);
        timer = setTimeout(() => {
            if (terminado) return;
            terminado = true;
            window.removeEventListener(eventRes, onRes);
            resolve({ ok: false, error: 'Sin respuesta de puente offscreen (recarga la extensión una vez)' });
        }, timeoutMs);

        window.dispatchEvent(
            new CustomEvent('maximus-bridge-stt', {
                detail: { requestId, op, ...payload }
            })
        );
    });
}

export async function detectarOffscreenStt(forzar = false) {
    const ahora = Date.now();
    if (!forzar && _offscreenProbeCache.ts > 0 && ahora - _offscreenProbeCache.ts < 30000) {
        return _offscreenProbeCache;
    }
    for (let i = 0; i < 12; i++) {
        if (document.documentElement?.dataset?.maximusBridge === '1') break;
        await dormirStt(100);
    }
    const res = await puenteOffscreenStt('ping', {}, 8000);
    _offscreenProbeCache = {
        ts: Date.now(),
        disponible: Boolean(res?.ok && res?.offscreenDisponible),
        hasGpu: Boolean(res?.hasGpu),
        device: res?.device || 'none',
        loadedModelId: res?.loadedModelId || null,
        error: res?.error || ''
    };
    return _offscreenProbeCache;
}

export async function decodificarAudioAPcm16(arrayBuffer) {
    if (!arrayBuffer || arrayBuffer.byteLength < 64) {
        throw new Error('Buffer de audio vacío o demasiado pequeño');
    }
    const gWin = typeof globalThis !== 'undefined' ? globalThis : window;
    const AudioCtx = gWin.AudioContext || gWin.webkitAudioContext;
    if (!AudioCtx) {
        throw new Error('AudioContext no disponible para decodificar audio');
    }
    const actx = new AudioCtx({ sampleRate: 16000 });
    try {
        const audioBuf = await actx.decodeAudioData(arrayBuffer.slice(0));
        const len = audioBuf.length;
        const chCount = Math.max(1, audioBuf.numberOfChannels || 1);
        const pcm16 = new Int16Array(len);

        if (chCount === 1) {
            const c0 = audioBuf.getChannelData(0);
            for (let i = 0; i < len; i++) {
                const s = c0[i] < -1 ? -1 : c0[i] > 1 ? 1 : c0[i];
                pcm16[i] = s < 0 ? s * 32768 : s * 32767;
            }
        } else {
            const canales = Array.from({ length: chCount }, (_, c) => audioBuf.getChannelData(c));
            for (let i = 0; i < len; i++) {
                let suma = 0;
                for (let c = 0; c < chCount; c++) suma += canales[c][i];
                const s = Math.max(-1, Math.min(1, suma / chCount));
                pcm16[i] = s < 0 ? s * 32768 : s * 32767;
            }
        }

        return {
            pcm16,
            sampleRate: 16000,
            duration: audioBuf.duration || len / 16000
        };
    } finally {
        try {
            await actx.close();
        } catch {}
    }
}

export function codificarWavDesdePcm16(int16Slice, sampleRate = 16000) {
    const dataLen = int16Slice.byteLength;
    const wav = new Uint8Array(44 + dataLen);
    const dv = new DataView(wav.buffer);
    const writeAscii = (off, str) => {
        for (let i = 0; i < str.length; i++) wav[off + i] = str.charCodeAt(i);
    };

    writeAscii(0, 'RIFF');
    dv.setUint32(4, 36 + dataLen, true);
    writeAscii(8, 'WAVE');
    writeAscii(12, 'fmt ');
    dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true); // PCM
    dv.setUint16(22, 1, true); // mono
    dv.setUint32(24, sampleRate, true);
    dv.setUint32(28, sampleRate * 2, true);
    dv.setUint16(32, 2, true);
    dv.setUint16(34, 16, true);
    writeAscii(36, 'data');
    dv.setUint32(40, dataLen, true);

    wav.set(new Uint8Array(int16Slice.buffer, int16Slice.byteOffset, dataLen), 44);
    return wav;
}

function construirMultipartWav(wavBytes, campoArchivo, nombreArchivo, camposExtra = {}) {
    const boundary = `----Chan2TxtBoundary${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const enc = new TextEncoder();
    const partes = [];

    for (const [k, v] of Object.entries(camposExtra)) {
        if (v === undefined || v === null || v === '') continue;
        partes.push(
            enc.encode(
                `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${String(v)}\r\n`
            )
        );
    }

    partes.push(
        enc.encode(
            `--${boundary}\r\nContent-Disposition: form-data; name="${campoArchivo}"; filename="${nombreArchivo}"\r\nContent-Type: audio/wav\r\n\r\n`
        )
    );
    partes.push(wavBytes);
    partes.push(enc.encode(`\r\n--${boundary}--\r\n`));

    const total = partes.reduce((a, b) => a + b.byteLength, 0);
    const body = new Uint8Array(total);
    let off = 0;
    for (const p of partes) {
        body.set(p, off);
        off += p.byteLength;
    }

    return {
        body,
        contentType: `multipart/form-data; boundary=${boundary}`
    };
}

async function peticionHttpStt({
    url,
    method = 'GET',
    headers = {},
    bodyBytes = null,
    bodyStr = '',
    responseType = 'text',
    timeout = 45000,
    preferirBackground = false
}) {
    const gWin = typeof globalThis !== 'undefined' ? globalThis : window;

    const intentarViaBackground = () =>
        new Promise((resolve, reject) => {
            if (typeof gWin?.GM_xmlhttpRequest !== 'function') {
                reject(new Error('GM_xmlhttpRequest no disponible'));
                return;
            }
            const esTmReal = Boolean(gWin?.GM_info);
            const req = {
                method,
                url,
                headers,
                anonymous: true,
                timeout,
                responseType: responseType === 'base64' && esTmReal ? 'arraybuffer' : responseType,
                onload: r => {
                    let b64 = r.responseBase64 || '';
                    if (!b64 && responseType === 'base64' && r.response instanceof ArrayBuffer) {
                        b64 = uint8ToBase64(new Uint8Array(r.response));
                    }
                    resolve({ status: r.status, text: r.responseText || '', base64: b64 });
                },
                onerror: e => reject(new Error(e?.error || 'Error de red extensión')),
                ontimeout: () => reject(new Error('Tiempo agotado'))
            };
            if (bodyBytes) {
                if (esTmReal) {
                    req.data = new Blob([bodyBytes], { type: headers['Content-Type'] || 'application/octet-stream' });
                } else {
                    req.bodyBase64 = uint8ToBase64(bodyBytes);
                }
            } else if (bodyStr) {
                req.data = bodyStr;
            }
            gWin.GM_xmlhttpRequest(req);
        });

    if (preferirBackground && typeof gWin?.GM_xmlhttpRequest === 'function') {
        return intentarViaBackground();
    }

    try {
        const ctrl = new AbortController();
        const reloj = setTimeout(() => ctrl.abort(), timeout);
        try {
            const resp = await fetch(url, {
                method,
                headers,
                body: method === 'GET' || method === 'HEAD' ? undefined : (bodyBytes || bodyStr || undefined),
                signal: ctrl.signal
            });
            if (responseType === 'base64') {
                const buf = new Uint8Array(await resp.arrayBuffer());
                return { status: resp.status, text: '', base64: uint8ToBase64(buf) };
            }
            return { status: resp.status, text: await resp.text(), base64: '' };
        } finally {
            clearTimeout(reloj);
        }
    } catch (errFetch) {
        if (typeof gWin?.GM_xmlhttpRequest === 'function') {
            return intentarViaBackground();
        }
        throw errFetch;
    }
}

export function seleccionarMejorFormatoAudioDirecto(adaptiveFormats) {
    if (!Array.isArray(adaptiveFormats) || !adaptiveFormats.length) return null;
    const audios = adaptiveFormats.filter(
        f => /^audio\/(?:mp4|webm)/i.test(String(f?.mimeType || '')) && f.url
    );
    if (!audios.length) return null;

    audios.sort((a, b) => {
        const score = f => {
            const dub = f.audioTrack?.isAutoDubbed ? 1 : 0;
            const orig = f.audioTrack?.audioIsDefault ? 0 : 1;
            const es = /^es(?:-|$)/i.test(f.audioTrack?.id || '') ? 0 : 1;
            return dub * 100 + orig * 20 + es * 10;
        };
        const d = score(a) - score(b);
        if (d !== 0) return d;
        return (Number(a.bitrate) || 9e9) - (Number(b.bitrate) || 9e9);
    });

    return audios[0];
}

export async function descargarAudioDirectoCorto(formatoAudio, expectedDurationSec = 0) {
    const totalLen = Number(formatoAudio?.contentLength || 0);
    if (!formatoAudio?.url || !totalLen || totalLen > 380000) {
        return null;
    }

    const ua = 'com.google.android.youtube/20.10.38 (Linux; U; Android 14; es_ES) gzip';
    const partes = [];
    let pos = 0;

    while (pos < totalLen) {
        const fin = Math.min(totalLen - 1, pos + 262143);
        const res = await peticionHttpStt({
            url: formatoAudio.url,
            method: 'GET',
            headers: {
                Range: `bytes=${pos}-${fin}`,
                'User-Agent': ua
            },
            responseType: 'base64',
            timeout: 12000,
            preferirBackground: true
        });
        if ((res.status !== 200 && res.status !== 206) || !res.base64) {
            return null;
        }
        const chunk = base64ToUint8(res.base64);
        if (!chunk.byteLength) return null;
        partes.push(chunk);
        pos += chunk.byteLength;
        if (res.status === 200) break;
    }

    const joinedLen = partes.reduce((a, b) => a + b.byteLength, 0);
    if (joinedLen < totalLen * 0.9) return null;

    const joined = new Uint8Array(joinedLen);
    let off = 0;
    for (const p of partes) {
        joined.set(p, off);
        off += p.byteLength;
    }

    const decoded = await decodificarAudioAPcm16(joined.buffer);
    if (expectedDurationSec > 4 && decoded.duration < expectedDurationSec - 2.5) {
        return null;
    }
    return decoded;
}

function normalizarCuesDeMotor(items, offsetSec, duracionSlice) {
    if (!Array.isArray(items) || !items.length) return [];
    const cues = [];
    for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const rawTxt = String(it?.text || '').replace(/\s+/g, ' ').trim();
        if (!rawTxt) continue;
        let start = Number(it?.start);
        if (!Number.isFinite(start) && Array.isArray(it?.timestamp)) {
            start = Number(it.timestamp[0]);
        }
        if (!Number.isFinite(start) || start < 0) {
            start = (i / Math.max(1, items.length)) * duracionSlice;
        }
        let end = Number(it?.end);
        if (!Number.isFinite(end) && Array.isArray(it?.timestamp)) {
            end = Number(it.timestamp[1]);
        }
        const dur = Number.isFinite(end) && end > start ? Math.max(0.4, end - start) : 2.5;
        cues.push({
            start: offsetSec + start,
            dur,
            text: rawTxt
        });
    }
    return cues;
}

function textoPlanoACues(textoPlano, offsetSec, duracionSlice) {
    const limpio = String(textoPlano || '').replace(/\s+/g, ' ').trim();
    if (!limpio) return [];
    const oraciones = limpio
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(Boolean);
    const lista = oraciones.length ? oraciones : [limpio];
    const totalChars = lista.reduce((a, s) => a + Math.max(1, s.length), 0);
    let cursor = 0;
    return lista.map(txt => {
        const span = Math.max(0.5, (Math.max(1, txt.length) / totalChars) * duracionSlice);
        const cue = { start: offsetSec + cursor, dur: span, text: txt };
        cursor += span;
        return cue;
    });
}

async function transcribirSliceOffscreen(pcmSlice, offsetSec, duracionSlice, cfg) {
    const u8 = new Uint8Array(pcmSlice.buffer, pcmSlice.byteOffset, pcmSlice.byteLength);
    const res = await puenteOffscreenStt(
        'transcribe',
        {
            pcm16B64: uint8ToBase64(u8),
            language: 'es',
            modelId: cfg.modeloLocal || ''
        },
        300000
    );
    if (!res?.ok) {
        throw new Error(res?.error || 'Fallo en Whisper WebGPU/WASM local');
    }
    if (Array.isArray(res.chunks) && res.chunks.length > 0) {
        return normalizarCuesDeMotor(res.chunks, offsetSec, duracionSlice);
    }
    return textoPlanoACues(res.text || '', offsetSec, duracionSlice);
}

async function transcribirSliceGroq(wavBytes, offsetSec, duracionSlice, cfg) {
    if (!cfg.groqKey) throw new Error('Falta Groq API key');
    const mp = construirMultipartWav(wavBytes, 'file', 'audio.wav', {
        model: 'whisper-large-v3-turbo',
        language: 'es',
        response_format: 'verbose_json'
    });

    for (let intento = 0; intento < 3; intento++) {
        const res = await peticionHttpStt({
            url: 'https://api.groq.com/openai/v1/audio/transcriptions',
            method: 'POST',
            headers: {
                Authorization: `Bearer ${cfg.groqKey.trim()}`,
                'Content-Type': mp.contentType
            },
            bodyBytes: mp.body,
            timeout: 90000
        });
        if (res.status === 200 && res.text) {
            const json = JSON.parse(res.text);
            if (Array.isArray(json?.segments) && json.segments.length > 0) {
                return normalizarCuesDeMotor(json.segments, offsetSec, duracionSlice);
            }
            return textoPlanoACues(json?.text || '', offsetSec, duracionSlice);
        }
        if (res.status === 429 && intento < 2) {
            await dormirStt(2500 * (intento + 1));
            continue;
        }
        throw new Error(`Groq HTTP ${res.status}: ${String(res.text || '').slice(0, 120)}`);
    }
    return [];
}

async function transcribirSliceGemini(wavBytes, offsetSec, duracionSlice, cfg) {
    if (!cfg.geminiKey) throw new Error('Falta Gemini API key');
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(cfg.geminiKey.trim())}`;
    const payload = JSON.stringify({
        contents: [
            {
                parts: [
                    {
                        text: 'Transcribe verbatim all spoken Spanish speech from this audio into JSON array items [{"start": seconds_number, "text": "..."}]. Do not summarize, omit words, or add commentary.'
                    },
                    {
                        inlineData: {
                            mimeType: 'audio/wav',
                            data: uint8ToBase64(wavBytes)
                        }
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json'
        }
    });

    const res = await peticionHttpStt({
        url: endpoint,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        bodyStr: payload,
        timeout: 90000
    });
    if (res.status !== 200 || !res.text) {
        throw new Error(`Gemini HTTP ${res.status}: ${String(res.text || '').slice(0, 120)}`);
    }
    const json = JSON.parse(res.text);
    const rawTxt = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    try {
        const parsed = JSON.parse(rawTxt);
        if (Array.isArray(parsed) && parsed.length > 0) {
            return normalizarCuesDeMotor(parsed, offsetSec, duracionSlice);
        }
    } catch {}
    return textoPlanoACues(rawTxt, offsetSec, duracionSlice);
}

async function transcribirSliceHfRouter(wavBytes, offsetSec, duracionSlice, cfg) {
    if (!cfg.hfToken) throw new Error('Falta HuggingFace token');
    const res = await peticionHttpStt({
        url: 'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo',
        method: 'POST',
        headers: {
            Authorization: `Bearer ${cfg.hfToken.trim()}`,
            'Content-Type': 'audio/wav'
        },
        bodyBytes: wavBytes,
        timeout: 90000
    });
    if (res.status !== 200 || !res.text) {
        throw new Error(`HF Router HTTP ${res.status}: ${String(res.text || '').slice(0, 120)}`);
    }
    const json = JSON.parse(res.text);
    if (Array.isArray(json?.chunks) && json.chunks.length > 0) {
        return normalizarCuesDeMotor(json.chunks, offsetSec, duracionSlice);
    }
    return textoPlanoACues(json?.text || '', offsetSec, duracionSlice);
}

async function transcribirSliceLocalHttp(wavBytes, offsetSec, duracionSlice, cfg) {
    const url = String(cfg.localUrl || '').trim() || STT_DEFAULT_CFG.localUrl;
    const esWhisperCpp = /\/inference$/i.test(url);
    const mp = construirMultipartWav(
        wavBytes,
        'file',
        'audio.wav',
        esWhisperCpp
            ? { response_format: 'verbose_json', language: 'es' }
            : { model: cfg.localModel || 'whisper-1', language: 'es', response_format: 'verbose_json' }
    );
    const res = await peticionHttpStt({
        url,
        method: 'POST',
        headers: { 'Content-Type': mp.contentType },
        bodyBytes: mp.body,
        timeout: 120000,
        preferirBackground: true
    });
    if (res.status !== 200 || !res.text) {
        throw new Error(`Servidor local HTTP ${res.status}`);
    }
    const json = JSON.parse(res.text);
    const segs = json?.segments || json?.transcription;
    if (Array.isArray(segs) && segs.length > 0) {
        return normalizarCuesDeMotor(segs, offsetSec, duracionSlice);
    }
    return textoPlanoACues(json?.text || '', offsetSec, duracionSlice);
}

async function transcribirSliceHfSpace(wavBytes, offsetSec, duracionSlice) {
    if (Date.now() < _hfSpaceEnfriamientoHasta) {
        throw new Error('HF Space ZeroGPU en enfriamiento por cuota');
    }
    const base = 'https://hf-audio-whisper-large-v3.hf.space';
    const mp = construirMultipartWav(wavBytes, 'files', 'audio.wav');
    const up = await peticionHttpStt({
        url: `${base}/gradio_api/upload`,
        method: 'POST',
        headers: { 'Content-Type': mp.contentType },
        bodyBytes: mp.body,
        timeout: 45000
    });
    if (up.status !== 200 || !up.text) {
        throw new Error(`HF Space upload HTTP ${up.status}`);
    }
    const uploaded = JSON.parse(up.text);
    const serverPath = Array.isArray(uploaded) ? uploaded[0] : '';
    if (!serverPath) throw new Error('HF Space upload vacío');

    const callRes = await peticionHttpStt({
        url: `${base}/gradio_api/call/transcribe`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        bodyStr: JSON.stringify({
            data: [{ path: serverPath, meta: { _type: 'gradio.FileData' } }, 'transcribe']
        }),
        timeout: 30000
    });
    if (callRes.status !== 200 || !callRes.text) {
        throw new Error(`HF Space call HTTP ${callRes.status}`);
    }
    const { event_id: eventId } = JSON.parse(callRes.text);
    if (!eventId) throw new Error('HF Space sin event_id');

    const sse = await peticionHttpStt({
        url: `${base}/gradio_api/call/transcribe/${eventId}`,
        method: 'GET',
        timeout: 65000
    });
    if (sse.status !== 200 || !sse.text) {
        throw new Error(`HF Space stream HTTP ${sse.status}`);
    }
    if (/event:\s*error/i.test(sse.text)) {
        _hfSpaceEnfriamientoHasta = Date.now() + 30 * 60 * 1000;
        throw new Error('Cuota ZeroGPU gratuita agotada temporalmente');
    }
    const m = sse.text.match(/event:\s*complete[\s\S]*?data:\s*(\[[\s\S]*?\])(?:\n|$)/);
    if (!m) throw new Error('HF Space sin respuesta complete');
    const dataArr = JSON.parse(m[1]);
    return textoPlanoACues(dataArr?.[0] || '', offsetSec, duracionSlice);
}

const REGISTRO_MOTORES_STT = {
    offscreen: { label: 'Audio WebGPU Local', maxSec: 90, overlapSec: 2, runPcm: transcribirSliceOffscreen },
    groq: { label: 'Audio Groq Turbo', maxSec: 580, overlapSec: 2, runWav: transcribirSliceGroq },
    gemini: { label: 'Audio Gemini Flash', maxSec: 360, overlapSec: 2, runWav: transcribirSliceGemini },
    hf_router: { label: 'Audio HF Router', maxSec: 240, overlapSec: 2, runWav: transcribirSliceHfRouter },
    local_http: { label: 'Audio Servidor Local', maxSec: 580, overlapSec: 2, runWav: transcribirSliceLocalHttp },
    hf_space: { label: 'Audio HF Gratis', maxSec: 210, overlapSec: 2, runWav: transcribirSliceHfSpace }
};

export async function resolverMotoresSttActivos(cfg = leerConfigStt()) {
    if (!cfg || cfg.motor === 'off') return [];
    if (cfg.motor && cfg.motor !== 'auto') {
        if (cfg.motor === 'offscreen') {
            const p = await detectarOffscreenStt();
            return p.disponible ? ['offscreen'] : [];
        }
        return REGISTRO_MOTORES_STT[cfg.motor] ? [cfg.motor] : [];
    }

    const orden = [];
    if (cfg.groqKey?.trim()) orden.push('groq');
    if (cfg.geminiKey?.trim()) orden.push('gemini');
    if (cfg.hfToken?.trim()) orden.push('hf_router');

    const offInfo = await detectarOffscreenStt();
    if (offInfo.disponible) {
        orden.push('offscreen');
    }

    if (Date.now() >= _hfSpaceEnfriamientoHasta) {
        orden.push('hf_space');
    }

    return Array.from(new Set(orden));
}

export async function diagnosticarMotoresStt() {
    const cfg = leerConfigStt();
    const offInfo = await detectarOffscreenStt(true);
    const activos = await resolverMotoresSttActivos(cfg);
    return {
        cfg,
        offInfo,
        activos,
        etiqueta:
            activos.length > 0
                ? `${REGISTRO_MOTORES_STT[activos[0]]?.label || activos[0]}${activos[0] === 'offscreen' && offInfo.device ? ` (${offInfo.device})` : ''}`
                : cfg.motor === 'off'
                  ? 'Desactivado'
                  : 'Sin motor activo (recarga extensión 1 vez para WebGPU o agrega API gratis)'
    };
}

export async function transcribirPcm16ConMotor(pcm16, durationSec, opts = {}) {
    const cfg = leerConfigStt();
    const motores = await resolverMotoresSttActivos(cfg);
    if (!motores.length) return null;

    const sr = 16000;
    const totalSamples = pcm16?.length || 0;
    if (!totalSamples) return null;

    let ultimoError = null;
    for (const motorId of motores) {
        const spec = REGISTRO_MOTORES_STT[motorId];
        if (!spec) continue;

        try {
            const pasoSamples = Math.max(sr, (spec.maxSec - spec.overlapSec) * sr);
            const maxSamples = spec.maxSec * sr;
            const cuesAcumuladas = [];

            for (let startIdx = 0; startIdx < totalSamples; startIdx += pasoSamples) {
                if (typeof opts.verificarCancelacion === 'function') {
                    opts.verificarCancelacion();
                }
                const endIdx = Math.min(totalSamples, startIdx + maxSamples);
                const slice = pcm16.subarray(startIdx, endIdx);
                const offsetSec = startIdx / sr;
                const sliceDur = slice.length / sr;

                const cuesSlice = spec.runPcm
                    ? await spec.runPcm(slice, offsetSec, sliceDur, cfg)
                    : await spec.runWav(codificarWavDesdePcm16(slice, sr), offsetSec, sliceDur, cfg);

                if (Array.isArray(cuesSlice)) {
                    for (const c of cuesSlice) {
                        const ult = cuesAcumuladas[cuesAcumuladas.length - 1];
                        if (
                            ult &&
                            Math.abs(c.start - ult.start) < 1.8 &&
                            (c.text === ult.text || ult.text.endsWith(c.text))
                        ) {
                            continue;
                        }
                        cuesAcumuladas.push(c);
                    }
                }
                if (endIdx >= totalSamples) break;
            }

            if (cuesAcumuladas.length > 0) {
                const subtitulos = decodeSubtitles(toSubtitles(cuesAcumuladas)).filter(
                    s => s.text.length > 0
                );
                if (subtitulos.length > 0) {
                    return {
                        subtitulos,
                        fuente: motorId,
                        etiqueta: spec.label,
                        idioma: 'es'
                    };
                }
            }
        } catch (e) {
            if (e?.esCancelacion) throw e;
            ultimoError = e;
        }
    }

    if (ultimoError) throw ultimoError;
    return null;
}
