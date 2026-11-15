// Puente DOM entre el mundo MAIN y background.js (peticiones HTTP, abort, notificaciones e inicio).

(() => {
    'use strict';

    const esIframe = typeof window !== 'undefined' && window.top !== window.self;
    const esIframeTrabajador = esIframe && location.search.includes('maximus_worker=1');

    if (esIframe && !esIframeTrabajador) {
        return;
    }

    if (document.documentElement) {
        document.documentElement.dataset.maximusBridge = '1';
    }

    window.addEventListener('maximus-bridge-http', e => {
        const detalle = e.detail;
        if (!detalle?.requestId || !detalle?.url) return;

        const eventoRespuesta = `maximus-bridge-res-${detalle.requestId}`;

        try {
            chrome.runtime.sendMessage(
                {
                    action: 'MAXIMUS_HTTP_REQUEST',
                    requestId: detalle.requestId,
                    url: detalle.url,
                    method: detalle.method,
                    headers: detalle.headers,
                    body: detalle.body,
                    bodyBase64: detalle.bodyBase64,
                    responseType: detalle.responseType,
                    anonymous: detalle.anonymous,
                    timeout: detalle.timeout
                },
                respuesta => {
                    const payload = chrome.runtime.lastError
                        ? { error: chrome.runtime.lastError.message }
                        : (respuesta || { error: 'Sin respuesta del background' });

                    window.dispatchEvent(new CustomEvent(eventoRespuesta, { detail: payload }));
                }
            );
        } catch (err) {
            window.dispatchEvent(
                new CustomEvent(eventoRespuesta, {
                    detail: { error: err?.message || 'Error al enviar petición' }
                })
            );
        }
    });

    window.addEventListener('maximus-bridge-abort', e => {
        const requestId = e.detail?.requestId;
        if (!requestId) return;
        try {
            chrome.runtime.sendMessage({ action: 'MAXIMUS_ABORT', requestId });
        } catch {
            // La pestaña pudo cerrarse antes de abortar.
        }
    });

    window.addEventListener('maximus-bridge-stt', e => {
        const detalle = e.detail;
        if (!detalle?.requestId || !detalle?.op) return;
        const eventoRes = `maximus-bridge-stt-res-${detalle.requestId}`;
        const respondStt = payload => {
            window.dispatchEvent(new CustomEvent(eventoRes, { detail: payload }));
        };

        if (detalle.op === 'ping') {
            try {
                chrome.runtime.sendMessage({ action: 'MAXIMUS_STT_PING' }, respuesta => {
                    const payload = chrome.runtime.lastError
                        ? { ok: false, error: chrome.runtime.lastError.message }
                        : (respuesta || { ok: false, error: 'Sin respuesta STT del background' });
                    respondStt(payload);
                });
            } catch (err) {
                respondStt({ ok: false, error: err?.message || 'Error puente STT' });
            }
            return;
        }

        const enviarDirectoAOffscreen = async () => {
            await new Promise(resolve => {
                chrome.runtime.sendMessage({ action: 'MAXIMUS_STT_ENSURE' }, () => resolve());
            });
            for (let i = 0; i < 20; i++) {
                const intento = await new Promise(resolve => {
                    chrome.runtime.sendMessage(
                        {
                            target: 'chan2txt-offscreen',
                            action: 'OFFSCREEN_TRANSCRIBE_PCM16',
                            pcm16B64: detalle.pcm16B64 || '',
                            language: detalle.language || 'es',
                            modelId: detalle.modelId || ''
                        },
                        res => {
                            if (chrome.runtime.lastError) {
                                resolve({ __retry: chrome.runtime.lastError.message });
                            } else {
                                resolve(res || { ok: false, error: 'Sin respuesta offscreen' });
                            }
                        }
                    );
                });
                if (!intento?.__retry) return intento;
                if (!/Receiving end does not exist|message port closed/i.test(intento.__retry)) {
                    throw new Error(intento.__retry);
                }
                await new Promise(r => setTimeout(r, 150));
            }
            // Fallback por Service Worker si el canal directo no enganchó
            return new Promise(resolve => {
                chrome.runtime.sendMessage(
                    {
                        action: 'MAXIMUS_STT_TRANSCRIBE',
                        pcm16B64: detalle.pcm16B64 || '',
                        language: detalle.language || 'es',
                        modelId: detalle.modelId || ''
                    },
                    res => {
                        resolve(
                            chrome.runtime.lastError
                                ? { ok: false, error: chrome.runtime.lastError.message }
                                : (res || { ok: false, error: 'Sin respuesta STT del background' })
                        );
                    }
                );
            });
        };

        enviarDirectoAOffscreen()
            .then(respondStt)
            .catch(err => respondStt({ ok: false, error: err?.message || 'Error puente STT' }));
    });

    window.addEventListener('maximus-bridge-notify', e => {
        const detalle = e.detail;
        if (!detalle) return;
        try {
            chrome.runtime.sendMessage({
                action: 'MAXIMUS_NOTIFY',
                notifId: detalle.notifId,
                title: detalle.title,
                message: detalle.message,
                url: detalle.url
            });
        } catch {
            // Ignorar si no hay Service Worker activo.
        }
    });

    chrome.runtime.onMessage.addListener(mensaje => {
        if (mensaje?.action === 'MAXIMUS_NOTIFY_CLICKED' && mensaje.notifId) {
            window.dispatchEvent(
                new CustomEvent('maximus-bridge-notify-clicked', {
                    detail: { notifId: mensaje.notifId }
                })
            );
        }
    });

    try {
        chrome.runtime.sendMessage({ action: 'MAXIMUS_INIT_TAB' }, () => {
            void chrome.runtime.lastError;
        });
    } catch {
        // Ignorar si el contexto de la extensión acaba de recargarse.
    }
})();
