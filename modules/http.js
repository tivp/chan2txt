import { win, CFG, abortadoresActivos } from './config.js';
import { panelCanal, cancelado, verificarCancelacion } from './main.js';

export let enPausaPorCaptcha = false;
const resolversCaptcha = new Set();
export let urlCaptchaActivo = '';
let timerAutoVerificacionCaptcha = null;
let ultimaNotificacionCaptchaMs = 0;

// ==================================================
// AUTENTICACIÓN SAPISIDHASH Y HEADERS NATIVOS INNERTUBE DE YOUTUBE
// ==================================================

export function leerCookie(nombre) {
    const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + nombre + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
}

export async function calcularSapisidHash(origin = 'https://www.youtube.com') {
    try {
        const sapisid = leerCookie('SAPISID') || leerCookie('__Secure-3PAPISID');
        if (!sapisid || !crypto?.subtle) return null;
        const ts = Math.floor(Date.now() / 1000);
        const msg = new TextEncoder().encode(`${ts} ${sapisid} ${origin}`);
        const hashBuf = await crypto.subtle.digest('SHA-1', msg);
        const hashHex = Array.from(new Uint8Array(hashBuf))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        return `SAPISIDHASH ${ts}_${hashHex} SAPISID1PHASH ${ts}_${hashHex} SAPISID3PHASH ${ts}_${hashHex}`;
    } catch {
        return null;
    }
}

export function obtenerConfigYtcfg() {
    const get = k => {
        try {
            return win.ytcfg?.get?.(k) ?? win.ytcfg?.data_?.[k];
        } catch {
            return undefined;
        }
    };
    const ctx = get('INNERTUBE_CONTEXT');
    return {
        apiKey: get('INNERTUBE_API_KEY') || '',
        clientVersion: get('INNERTUBE_CLIENT_VERSION') || ctx?.client?.clientVersion || '2.20260401.01.00',
        clientName: get('INNERTUBE_CONTEXT_CLIENT_NAME') || 1,
        visitorData: get('VISITOR_DATA') || ctx?.client?.visitorData || '',
        sessionIndex: String(get('SESSION_INDEX') ?? '0'),
        delegatedSessionId: get('DELEGATED_SESSION_ID') || '',
        sts: get('STS') || null,
        hl: ctx?.client?.hl || 'es',
        gl: ctx?.client?.gl || 'ES',
        fullContext: ctx || null
    };
}

export async function construirHeadersInnerTube(incluirAuth = true) {
    const cfg = obtenerConfigYtcfg();
    const headers = {
        'Content-Type': 'application/json',
        'X-Youtube-Client-Name': String(cfg.clientName || 1),
        'X-Youtube-Client-Version': String(cfg.clientVersion || '2.20260401.01.00'),
        'X-Origin': 'https://www.youtube.com',
        'Origin': 'https://www.youtube.com',
        'X-Goog-AuthUser': cfg.sessionIndex || '0'
    };
    if (cfg.visitorData) headers['X-Goog-Visitor-Id'] = cfg.visitorData;
    if (cfg.delegatedSessionId) headers['X-Goog-PageId'] = cfg.delegatedSessionId;

    if (incluirAuth) {
        const auth = await calcularSapisidHash('https://www.youtube.com');
        if (auth) headers['Authorization'] = auth;
    }

    return { headers, cfg };
}

// ==================================================
// NOTIFICACIONES Y ALERTA SONORA ANTE CAPTCHA
// ==================================================

export function emitirPitidoAlerta() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext || unsafeWindow.AudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
        osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3);

        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
        setTimeout(() => {
            try { ctx.close(); } catch {}
        }, 800);
    } catch {}
}

export function enviarNotificacion(titulo, cuerpo, urlAbrir) {
    try {
        if (typeof GM_notification === 'function') {
            GM_notification({
                title: titulo,
                text: cuerpo,
                image: 'https://www.youtube.com/s/desktop/f7129524/img/favicon.ico',
                highlight: true,
                timeout: 25000,
                onclick: () => {
                    try { window.focus(); } catch {}
                    if (urlAbrir) {
                        try { window.open(urlAbrir, '_blank'); } catch {}
                    }
                }
            });
        }
    } catch {}
}

// ==================================================
// DETECCIÓN Y GESTIÓN DE RECAPTCHA / BOT DETECTION
// ==================================================

export function esRespuestaCaptcha(status, textoResp, finalUrl) {
    const url = String(finalUrl || '').toLowerCase();
    // /api/timedtext devuelve 429 "We're sorry" sin reCAPTCHA resoluble; cambiar de protocolo en vez de pausar
    if (url.includes('/api/timedtext')) return false;

    const muestra = String(textoResp || '').slice(0, 8000);
    const tieneCaptchaInteractivo =
        muestra.includes('id="captcha-form"') ||
        muestra.includes('g-recaptcha') ||
        muestra.includes('recaptcha/api.js') ||
        /demuestra que no eres un robot|i'm not a robot/i.test(muestra);

    if (tieneCaptchaInteractivo) return true;

    return false;
}

export function activarPausaPorCaptcha(url) {
    const destino = String(url || 'https://www.youtube.com/');
    if (destino.toLowerCase().includes('/api/timedtext')) return;
    if (enPausaPorCaptcha) return;

    enPausaPorCaptcha = true;
    urlCaptchaActivo = destino;

    const ahora = Date.now();
    if (ahora - ultimaNotificacionCaptchaMs >= 45000) {
        ultimaNotificacionCaptchaMs = ahora;
        emitirPitidoAlerta();
        enviarNotificacion(
            '⚠️ YouTube a TXT: ¡Saltó el reCAPTCHA!',
            '¡A yapo saltó el reCAPTCHA! Tomás, mira esto es tuyo: resuélvelo que te espero para continuar.',
            urlCaptchaActivo
        );
    }

    if (panelCanal) {
        panelCanal.panel.classList.add('alerta-captcha');
        if (panelCanal.btnCaptcha) {
            panelCanal.btnCaptcha.hidden = false;
            panelCanal.btnCaptcha.textContent = '⚡ Resolver Captcha y Continuar';
            panelCanal.btnCaptcha.title = 'Haz clic para abrir el captcha y reanudar';
        }
        panelCanal.estado.textContent =
            '⚠️ ¡A yapo saltó el reCAPTCHA! Tomás, mira esto es tuyo: resuélvelo que te espero para continuar...';
    }

    clearInterval(timerAutoVerificacionCaptcha);
    const urlProbe = urlCaptchaActivo.includes('/youtubei/')
        ? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        : urlCaptchaActivo;
    timerAutoVerificacionCaptcha = setInterval(async () => {
        if (!enPausaPorCaptcha || cancelado) {
            clearInterval(timerAutoVerificacionCaptcha);
            return;
        }
        try {
            const test = await peticionHttpBaja(urlProbe, { timeout: 8000 });
            const finalProbeUrl = String(test.finalUrl || '').toLowerCase();
            if (
                test.status === 200 &&
                !finalProbeUrl.includes('/sorry') &&
                !esRespuestaCaptcha(test.status, test.text, test.finalUrl)
            ) {
                clearInterval(timerAutoVerificacionCaptcha);
                reanudarDespuesDeCaptcha();
            }
        } catch {}
    }, 8000);
}

export function esperarResolucionCaptcha() {
    if (!enPausaPorCaptcha || cancelado) return Promise.resolve();
    return new Promise(resolve => {
        resolversCaptcha.add(resolve);
    });
}

export function reanudarDespuesDeCaptcha() {
    clearInterval(timerAutoVerificacionCaptcha);
    if (!enPausaPorCaptcha) return;
    enPausaPorCaptcha = false;
    urlCaptchaActivo = '';

    if (panelCanal) {
        panelCanal.panel.classList.remove('alerta-captcha');
        if (panelCanal.btnCaptcha) {
            panelCanal.btnCaptcha.hidden = true;
            delete panelCanal.btnCaptcha.dataset.abierto;
        }
        panelCanal.estado.textContent = 'Captcha resuelto. Reanudando descargas...';
    }

    const pendientes = Array.from(resolversCaptcha);
    resolversCaptcha.clear();
    for (const fn of pendientes) {
        try { fn(); } catch {}
    }
}

// ==================================================
// PETICIONES HTTP CON TRANSPORTE GM ROBUSTO Y CANCELACIÓN
// ==================================================

export function obtenerGmTransporte() {
    if (typeof GM_xmlhttpRequest === 'function') return GM_xmlhttpRequest;
    if (typeof GM !== 'undefined' && typeof GM.xmlHttpRequest === 'function') return GM.xmlHttpRequest;
    if (typeof window !== 'undefined' && typeof window.GM_xmlhttpRequest === 'function') return window.GM_xmlhttpRequest;
    if (typeof unsafeWindow !== 'undefined' && typeof unsafeWindow.GM_xmlhttpRequest === 'function') return unsafeWindow.GM_xmlhttpRequest;
    return null;
}

export function peticionHttpBaja(url, opciones = {}) {
    verificarCancelacion();

    const method = (opciones.method || 'GET').toUpperCase();
    const headers = {
        Accept: '*/*',
        'Accept-Language': 'es-419,es;q=0.9',
        ...(opciones.headers || {})
    };
    const data = opciones.body || opciones.data || undefined;
    const anonymous = Boolean(opciones.anonymous);
    const gm = obtenerGmTransporte();

    if (gm && !opciones.preferirFetch) {
        return new Promise((resolve, reject) => {
            if (cancelado) {
                const err = new Error('Descarga detenida por el usuario');
                err.esCancelacion = true;
                return reject(err);
            }

            let finalizado = false;
            let req = null;

            const abortar = () => {
                if (finalizado) return;
                finalizado = true;
                clearTimeout(timer);
                abortadoresActivos.delete(abortar);
                try { req?.abort?.(); } catch {}
                const err = new Error('Descarga detenida por el usuario');
                err.esCancelacion = true;
                reject(err);
            };

            abortadoresActivos.add(abortar);

            const timer = setTimeout(() => {
                if (finalizado) return;
                finalizado = true;
                abortadoresActivos.delete(abortar);
                try { req?.abort?.(); } catch {}
                reject(new Error('Tiempo agotado'));
            }, opciones.timeout || CFG.TIMEOUT);

            const fin = (fn, val) => {
                if (finalizado) return;
                finalizado = true;
                clearTimeout(timer);
                abortadoresActivos.delete(abortar);
                fn(val);
            };

            try {
                req = gm({
                    method,
                    url,
                    headers: {
                        Referer: 'https://www.youtube.com/',
                        ...headers
                    },
                    data,
                    withCredentials: !anonymous,
                    anonymous,
                    timeout: opciones.timeout || CFG.TIMEOUT,
                    onload: r => {
                        fin(resolve, {
                            status: r.status,
                            text: r.responseText || '',
                            finalUrl: r.finalUrl || url
                        });
                    },
                    onerror: () => fin(reject, new Error('Error de red en GM_xmlhttpRequest')),
                    ontimeout: () => fin(reject, new Error('Tiempo agotado')),
                    onabort: () => {
                        const err = new Error('Descarga detenida por el usuario');
                        err.esCancelacion = true;
                        fin(reject, err);
                    }
                });
            } catch (e) {
                fin(reject, e);
            }
        });
    }

    return new Promise((resolve, reject) => {
        const fetchFn = (win && win.fetch) || (typeof fetch === 'function' ? fetch : null);
        if (!fetchFn) {
            return reject(new Error('No hay transporte HTTP disponible'));
        }

        let porTimeout = false;
        const ctrl = new AbortController();
        const abortar = () => ctrl.abort();
        abortadoresActivos.add(abortar);
        const timer = setTimeout(() => {
            porTimeout = true;
            ctrl.abort();
        }, opciones.timeout || CFG.TIMEOUT);

        fetchFn.call(win, url, {
            method,
            headers,
            body: data,
            credentials: anonymous ? 'omit' : 'include',
            cache: 'no-store',
            signal: ctrl.signal
        })
        .then(async res => {
            const text = await res.text();
            return {
                status: res.status,
                text,
                finalUrl: res.url || url
            };
        })
        .then(resolve)
        .catch(e => {
            if (cancelado || (ctrl.signal.aborted && !porTimeout)) {
                const err = new Error('Descarga detenida por el usuario');
                err.esCancelacion = true;
                return reject(err);
            }
            if (porTimeout) {
                return reject(new Error('Tiempo agotado'));
            }
            reject(e);
        })
        .finally(() => {
            clearTimeout(timer);
            abortadoresActivos.delete(abortar);
        });
    });
}

export async function peticionHttp(url, opciones = {}) {
    verificarCancelacion();

    if (enPausaPorCaptcha) {
        await esperarResolucionCaptcha();
        verificarCancelacion();
    }

    let resp = await peticionHttpBaja(url, opciones);

    if (resp.status === 429 && !String(url || '').includes('/api/timedtext')) {
        await new Promise(r => setTimeout(r, 2500 + Math.random() * 1500));
        verificarCancelacion();
        resp = await peticionHttpBaja(url, opciones);
    }

    if (esRespuestaCaptcha(resp.status, resp.text, resp.finalUrl)) {
        activarPausaPorCaptcha(resp.finalUrl || url);
        await esperarResolucionCaptcha();
        verificarCancelacion();
        return await peticionHttp(url, opciones);
    }

    if (resp.status < 200 || resp.status >= 300) {
        const err = new Error(`HTTP ${resp.status}`);
        err.status = resp.status;
        throw err;
    }

    return resp.text;
}

export const fetchTexto = peticionHttp;
