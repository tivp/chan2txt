// Provee GM_xmlhttpRequest, GM_setClipboard, GM_notification, GM_getValue y GM_setValue en el mundo MAIN.

(() => {
    'use strict';

    const esIframe = typeof window !== 'undefined' && window.top !== window.self;
    const esIframeTrabajador = esIframe && location.search.includes('maximus_worker=1');

    if (esIframe && !esIframeTrabajador) {
        return;
    }

    if (window.__chan2txtGmPolyfillReady) {
        return;
    }
    window.__chan2txtGmPolyfillReady = true;

    let reqSeq = 0;
    const memStore = new Map();
    const callbacksNotif = new Map();

    window.addEventListener('maximus-bridge-notify-clicked', e => {
        const notifId = e.detail?.notifId;
        if (!notifId) return;
        const fn = callbacksNotif.get(notifId);
        callbacksNotif.delete(notifId);
        if (typeof fn === 'function') {
            try {
                fn();
            } catch {
                // Ignorar errores dentro del callback onclick de la notificación.
            }
        }
    });

    if (typeof window.GM_xmlhttpRequest !== 'function') {
        window.GM_xmlhttpRequest = function (detalles) {
            const opts = detalles || {};
            const requestId = `gm_${++reqSeq}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const eventName = `maximus-bridge-res-${requestId}`;
            let terminado = false;
            let timer = null;

            const limpiar = () => {
                clearTimeout(timer);
                window.removeEventListener(eventName, onResp);
            };

            const onResp = ev => {
                if (terminado) return;
                terminado = true;
                limpiar();

                const payload = ev.detail || {};
                if (payload.error) {
                    if (/tiempo agotado/i.test(payload.error) && typeof opts.ontimeout === 'function') {
                        opts.ontimeout();
                    } else if (typeof opts.onerror === 'function') {
                        opts.onerror(payload);
                    }
                    return;
                }

                if (typeof opts.onload === 'function') {
                    opts.onload({
                        status: payload.status ?? 0,
                        responseText: payload.text ?? '',
                        finalUrl: payload.finalUrl || opts.url
                    });
                }
            };

            window.addEventListener(eventName, onResp);

            const timeoutMs = Number(opts.timeout) || 16000;
            timer = setTimeout(() => {
                if (terminado) return;
                terminado = true;
                limpiar();
                window.dispatchEvent(new CustomEvent('maximus-bridge-abort', { detail: { requestId } }));
                if (typeof opts.ontimeout === 'function') {
                    opts.ontimeout();
                }
            }, timeoutMs + 500);

            window.dispatchEvent(
                new CustomEvent('maximus-bridge-http', {
                    detail: {
                        requestId,
                        url: opts.url,
                        method: opts.method || 'GET',
                        headers: opts.headers ? { ...opts.headers } : {},
                        body: opts.data,
                        anonymous: Boolean(opts.anonymous),
                        timeout: timeoutMs
                    }
                })
            );

            return {
                abort() {
                    if (terminado) return;
                    terminado = true;
                    limpiar();
                    window.dispatchEvent(new CustomEvent('maximus-bridge-abort', { detail: { requestId } }));
                    if (typeof opts.onabort === 'function') {
                        opts.onabort();
                    }
                }
            };
        };
    }

    if (typeof window.GM_setClipboard !== 'function') {
        window.GM_setClipboard = function (texto) {
            const val = String(texto ?? '');
            const copiarFallback = () => {
                try {
                    const ta = document.createElement('textarea');
                    ta.value = val;
                    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
                    (document.body || document.documentElement).appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    ta.remove();
                } catch {
                    // Ignorar si el navegador bloquea el copiado sin gesto activo.
                }
            };

            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                navigator.clipboard.writeText(val).catch(copiarFallback);
            } else {
                copiarFallback();
            }
        };
    }

    if (typeof window.GM_notification !== 'function') {
        window.GM_notification = function (detallesOtexto, tituloOpcional) {
            const obj =
                detallesOtexto && typeof detallesOtexto === 'object'
                    ? detallesOtexto
                    : {
                          text: String(detallesOtexto ?? ''),
                          title: tituloOpcional || 'Canal de YouTube a TXT'
                      };

            const notifId = `notif_${++reqSeq}_${Date.now()}`;
            if (typeof obj.onclick === 'function') {
                callbacksNotif.set(notifId, obj.onclick);
            }

            window.dispatchEvent(
                new CustomEvent('maximus-bridge-notify', {
                    detail: {
                        notifId,
                        title: obj.title || 'Canal de YouTube a TXT',
                        message: obj.text || '',
                        url: obj.url || ''
                    }
                })
            );
        };
    }

    if (typeof window.GM_getValue !== 'function') {
        window.GM_getValue = function (clave, defecto) {
            try {
                const raw = localStorage.getItem(`chan2txt_gm_${clave}`);
                if (raw !== null) return JSON.parse(raw);
            } catch {
                // Respaldo en memoria si localStorage no está disponible.
            }
            return memStore.has(clave) ? memStore.get(clave) : defecto;
        };
    }

    if (typeof window.GM_setValue !== 'function') {
        window.GM_setValue = function (clave, valor) {
            memStore.set(clave, valor);
            try {
                localStorage.setItem(`chan2txt_gm_${clave}`, JSON.stringify(valor));
            } catch {
                // Ignorar error de cuota o almacenamiento privado.
            }
        };
    }
})();
