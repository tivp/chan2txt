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
