// Peticiones HTTP (fetch, puente de extensión y GM_xmlhttpRequest), autenticación SAPISIDHASH y pausa ante reCAPTCHA.

import { CFG, estado, verificarCancelacion } from './config.js';
import { obtenerSnapshotPagina } from './utils.js';
import { limpiarTodosLosIframesTrabajadores } from './worker-iframe.js';

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
    const snap = obtenerSnapshotPagina();
    const ytcfg = snap?.ytcfg || {};
    const ctx = ytcfg.fullContext || null;

    return {
        apiKey: ytcfg.apiKey || '',
        clientVersion: ytcfg.clientVersion || ctx?.client?.clientVersion || '2.20260401.01.00',
        clientName: ytcfg.clientName || 1,
        visitorData: ytcfg.visitorData || ctx?.client?.visitorData || '',
        sessionIndex: String(ytcfg.sessionIndex ?? '0'),
        delegatedSessionId: ytcfg.delegatedSessionId || '',
        sts: ytcfg.sts || null,
        hl: ctx?.client?.hl || 'es',
        gl: ctx?.client?.gl || 'ES',
        fullContext: ctx
    };
}

export async function construirHeadersInnerTube(incluirAuth = true) {
    const cfg = obtenerConfigYtcfg();
    const headers = {
        'Content-Type': 'application/json',
        'X-Youtube-Client-Name': String(cfg.clientName || 1),
        'X-Youtube-Client-Version': String(cfg.clientVersion || '2.20260401.01.00'),
        'X-Origin': 'https://www.youtube.com',
        Origin: 'https://www.youtube.com',
        'X-Goog-AuthUser': cfg.sessionIndex || '0'
    };
    if (cfg.visitorData) headers['X-Goog-Visitor-Id'] = cfg.visitorData;
    if (cfg.delegatedSessionId) headers['X-Goog-PageId'] = cfg.delegatedSessionId;

    if (incluirAuth) {
        const auth = await calcularSapisidHash('https://www.youtube.com');
        if (auth) headers.Authorization = auth;
    }

    return { headers, cfg };
}

export function emitirPitidoAlerta() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext || estado.win?.AudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
        osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.3);

        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
        setTimeout(() => {
            try {
                ctx.close();
            } catch {
                // El contexto pudo cerrarse antes del temporizador.
            }
        }, 800);
    } catch {
        // Ignorar si el navegador bloquea WebAudio sin gesto previo.
    }
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
                    try {
                        window.focus();
                    } catch {
                        // Sin acceso al foco.
                    }
                    if (urlAbrir) {
                        try {
                            window.open(urlAbrir, '_blank');
                        } catch {
                            // Popups bloqueados.
                        }
                    }
                }
            });
            return;
        }

        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage({
                action: 'MAXIMUS_NOTIFY',
                title: titulo,
                message: cuerpo,
                url: urlAbrir
            });
            return;
        }

        if (document.documentElement?.dataset?.maximusBridge === '1') {
            window.dispatchEvent(
                new CustomEvent('maximus-bridge-notify', {
                    detail: { title: titulo, message: cuerpo, url: urlAbrir }
                })
            );
            return;
        }

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const n = new Notification(titulo, { body: cuerpo });
            if (urlAbrir) {
                n.onclick = () => {
                    window.focus();
                    window.open(urlAbrir, '_blank');
                };
            }
        }
    } catch {
        // No detener el flujo si fallan las notificaciones del sistema.
    }
}

export function esRespuestaCaptcha(status, textoResp, finalUrl) {
    if (status === 429) return true;
    const url = String(finalUrl || '').toLowerCase();
    if (url.includes('/sorry/index') || url.includes('google.com/sorry')) return true;

    if (status === 403 || status === 503) {
        const muestra = String(textoResp || '').slice(0, 4000);
        if (
            muestra.includes('id="captcha-form"') ||
            muestra.includes('g-recaptcha') ||
            muestra.includes('recaptcha/api.js') ||
            /demuestra que no eres un robot|unusual traffic|tr[aá]fico inusual/i.test(muestra)
        ) {
            return true;
        }
    }
    return false;
}

export function activarPausaPorCaptcha(url) {
    if (estado.enPausaPorCaptcha) return;
    estado.enPausaPorCaptcha = true;
    estado.urlCaptchaActivo = url || 'https://www.youtube.com/';

    emitirPitidoAlerta();
    enviarNotificacion(
        '⚠️ YouTube a TXT: ¡Saltó el reCAPTCHA!',
        '¡Saltó el reCAPTCHA! Ábrelo, resuélvelo manualmente y pulsa Continuar en el panel.',
        estado.urlCaptchaActivo
    );

    if (estado.panelCanal) {
        estado.panelCanal.panel.classList.add('alerta-captcha');
        if (estado.panelCanal.btnCaptcha) {
            estado.panelCanal.btnCaptcha.hidden = false;
            estado.panelCanal.btnCaptcha.textContent = '⚡ Resolver Captcha y Continuar';
            estado.panelCanal.btnCaptcha.title = 'Haz clic para abrir el captcha en una pestaña y reanudar';
        }
        estado.panelCanal.estado.textContent =
            '⚠️ Saltó el reCAPTCHA: resuélvelo manualmente y luego pulsa "Ya lo resolví, ¡Continuar!".';
    }
}

export function esperarResolucionCaptcha() {
    if (!estado.enPausaPorCaptcha) return Promise.resolve();
    return new Promise(resolve => {
        estado.resolverCaptchaFn = resolve;
    });
}

export function reanudarDespuesDeCaptcha() {
    if (!estado.enPausaPorCaptcha) return;
    estado.enPausaPorCaptcha = false;
    estado.urlCaptchaActivo = '';

    if (estado.panelCanal) {
        estado.panelCanal.panel.classList.remove('alerta-captcha');
        if (estado.panelCanal.btnCaptcha) {
            estado.panelCanal.btnCaptcha.hidden = true;
            delete estado.panelCanal.btnCaptcha.dataset.abierto;
        }
        estado.panelCanal.estado.textContent = 'Captcha resuelto. Reanudando descargas...';
    }

    if (typeof estado.resolverCaptchaFn === 'function') {
        const fn = estado.resolverCaptchaFn;
        estado.resolverCaptchaFn = null;
        fn();
    }
}

export function cancelarDescargaActiva() {
    if (!estado.ocupado) return;
    estado.cancelado = true;
    if (estado.enPausaPorCaptcha) {
        reanudarDespuesDeCaptcha();
    }
    limpiarTodosLosIframesTrabajadores();
    for (const abortar of estado.abortadoresActivos) {
        try {
            abortar();
        } catch {
            // La petición ya pudo haber cerrado.
        }
    }
    estado.abortadoresActivos.clear();
    if (estado.panelCanal?.estado) {
        estado.panelCanal.estado.textContent = 'Deteniendo descarga...';
    }
}

function obtenerGmTransporte() {
    if (typeof GM_xmlhttpRequest === 'function') return GM_xmlhttpRequest;
    if (typeof GM !== 'undefined' && typeof GM.xmlHttpRequest === 'function') return GM.xmlHttpRequest;
    if (typeof window !== 'undefined' && typeof window.GM_xmlhttpRequest === 'function') return window.GM_xmlhttpRequest;
    if (typeof unsafeWindow !== 'undefined' && typeof unsafeWindow.GM_xmlhttpRequest === 'function') {
        return unsafeWindow.GM_xmlhttpRequest;
    }
    return null;
}

function peticionViaBackground(url, opciones, timeout) {
    const method = (opciones.method || 'GET').toUpperCase();
    const headers = {
        Accept: '*/*',
        'Accept-Language': 'es-419,es;q=0.9',
        ...(opciones.headers || {})
    };
    const body = opciones.body || opciones.data || undefined;
    const anonymous = Boolean(opciones.anonymous);

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        return new Promise((resolve, reject) => {
            if (estado.cancelado) {
                const err = new Error('Descarga detenida por el usuario');
                err.esCancelacion = true;
                return reject(err);
            }

            let finalizado = false;
            const requestId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

            const abortar = () => {
                if (finalizado) return;
                finalizado = true;
                clearTimeout(timer);
                estado.abortadoresActivos.delete(abortar);
                try {
                    chrome.runtime.sendMessage({ action: 'MAXIMUS_ABORT', requestId });
                } catch {
                    // Ignorar si el worker no está activo.
                }
                const err = new Error('Descarga detenida por el usuario');
                err.esCancelacion = true;
                reject(err);
            };

            estado.abortadoresActivos.add(abortar);

            const timer = setTimeout(() => {
                if (finalizado) return;
                finalizado = true;
                estado.abortadoresActivos.delete(abortar);
                try {
                    chrome.runtime.sendMessage({ action: 'MAXIMUS_ABORT', requestId });
                } catch {
                    // Ignorar.
                }
                reject(new Error('Tiempo agotado'));
            }, timeout);

            chrome.runtime.sendMessage(
                {
                    action: 'MAXIMUS_HTTP_REQUEST',
                    requestId,
                    url,
                    method,
                    headers,
                    body,
                    anonymous,
                    timeout
                },
                respuesta => {
                    if (finalizado) return;
                    finalizado = true;
                    clearTimeout(timer);
                    estado.abortadoresActivos.delete(abortar);

                    if (chrome.runtime.lastError) {
                        return reject(new Error(chrome.runtime.lastError.message || 'Error en background'));
                    }
                    if (!respuesta || respuesta.error) {
                        return reject(new Error(respuesta?.error || 'Error de red en background'));
                    }
                    resolve({
                        status: respuesta.status,
                        text: respuesta.text || '',
                        finalUrl: respuesta.finalUrl || url
                    });
                }
            );
        });
    }

    if (document.documentElement?.dataset?.maximusBridge === '1') {
        return new Promise((resolve, reject) => {
            if (estado.cancelado) {
                const err = new Error('Descarga detenida por el usuario');
                err.esCancelacion = true;
                return reject(err);
            }

            let finalizado = false;
            const requestId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const eventoRespuesta = `maximus-bridge-res-${requestId}`;

            const limpiar = () => {
                clearTimeout(timer);
                estado.abortadoresActivos.delete(abortar);
                window.removeEventListener(eventoRespuesta, onRespuesta);
            };

            const abortar = () => {
                if (finalizado) return;
                finalizado = true;
                limpiar();
                window.dispatchEvent(new CustomEvent('maximus-bridge-abort', { detail: { requestId } }));
                const err = new Error('Descarga detenida por el usuario');
                err.esCancelacion = true;
                reject(err);
            };

            const onRespuesta = e => {
                if (finalizado) return;
                finalizado = true;
                limpiar();
                const respuesta = e.detail;
                if (!respuesta || respuesta.error) {
                    return reject(new Error(respuesta?.error || 'Error de red en puente DOM'));
                }
                resolve({
                    status: respuesta.status,
                    text: respuesta.text || '',
                    finalUrl: respuesta.finalUrl || url
                });
            };

            estado.abortadoresActivos.add(abortar);
            window.addEventListener(eventoRespuesta, onRespuesta, { once: true });

            const timer = setTimeout(() => {
                if (finalizado) return;
                finalizado = true;
                limpiar();
                window.dispatchEvent(new CustomEvent('maximus-bridge-abort', { detail: { requestId } }));
                reject(new Error('Tiempo agotado'));
            }, timeout);

            window.dispatchEvent(
                new CustomEvent('maximus-bridge-http', {
                    detail: {
                        requestId,
                        url,
                        method,
                        headers,
                        body,
                        anonymous,
                        timeout
                    }
                })
            );
        });
    }

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
    const timeout = opciones.timeout || CFG.TIMEOUT;
    const gm = obtenerGmTransporte();

    if (gm && !opciones.preferirFetch) {
        return new Promise((resolve, reject) => {
            if (estado.cancelado) {
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
                estado.abortadoresActivos.delete(abortar);
                try {
                    req?.abort?.();
                } catch {
                    // Ignorar.
                }
                const err = new Error('Descarga detenida por el usuario');
                err.esCancelacion = true;
                reject(err);
            };

            estado.abortadoresActivos.add(abortar);

            const timer = setTimeout(() => {
                if (finalizado) return;
                finalizado = true;
                estado.abortadoresActivos.delete(abortar);
                try {
                    req?.abort?.();
                } catch {
                    // Ignorar.
                }
                reject(new Error('Tiempo agotado'));
            }, timeout);

            const fin = (fn, val) => {
                if (finalizado) return;
                finalizado = true;
                clearTimeout(timer);
                estado.abortadoresActivos.delete(abortar);
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
                    timeout,
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

    // En extensión MV3 usamos background.js cuando se piden llamadas sin cookies o fuera de preferirFetch.
    if (!opciones.preferirFetch && !gm) {
        const bgPromise = peticionViaBackground(url, opciones, timeout);
        if (bgPromise) return bgPromise;
    }

    return new Promise((resolve, reject) => {
        const fetchFn = (estado.win && estado.win.fetch) || (typeof fetch === 'function' ? fetch : null);
        if (!fetchFn) {
            return reject(new Error('No hay transporte HTTP disponible'));
        }

        const ctrl = new AbortController();
        const abortar = () => ctrl.abort();
        estado.abortadoresActivos.add(abortar);
        const timer = setTimeout(() => ctrl.abort(), timeout);

        fetchFn
            .call(estado.win || window, url, {
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
                if (estado.cancelado || ctrl.signal.aborted) {
                    const err = new Error('Descarga detenida por el usuario');
                    err.esCancelacion = true;
                    return reject(err);
                }
                reject(e);
            })
            .finally(() => {
                clearTimeout(timer);
                estado.abortadoresActivos.delete(abortar);
            });
    });
}

export async function peticionHttp(url, opciones = {}) {
    verificarCancelacion();

    if (estado.enPausaPorCaptcha) {
        await esperarResolucionCaptcha();
        verificarCancelacion();
    }

    let resp = await peticionHttpBaja(url, opciones);

    if (resp.status === 429) {
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
