// Puente DOM hacia background.js y cargador de módulos locales si no hay bundle remoto registrado.

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
                title: detalle.title,
                message: detalle.message,
                url: detalle.url
            });
        } catch {
            // Ignorar si no hay Service Worker activo.
        }
    });

    const cargarModulosLocales = async () => {
        if (document.documentElement?.dataset?.maximusYtIniciado === '1') {
            return;
        }
        try {
            const urlModulo = chrome.runtime.getURL('modules/main.js');
            await import(urlModulo);
        } catch (err) {
            console.error('[Canal de YouTube a TXT] Falló la carga de módulos:', err);
        }
    };

    const consultarInicio = () =>
        new Promise(resolve => {
            try {
                chrome.runtime.sendMessage({ action: 'MAXIMUS_INIT_TAB' }, respuesta => {
                    if (chrome.runtime.lastError) {
                        resolve({ inyectadoRemoto: false });
                        return;
                    }
                    resolve(respuesta || { inyectadoRemoto: false });
                });
            } catch {
                resolve({ inyectadoRemoto: false });
            }
        });

    (async () => {
        const info = await consultarInicio();

        if (info.inyectadoRemoto) {
            await new Promise(r => setTimeout(r, 300));
            if (document.documentElement?.dataset?.maximusYtIniciado !== '1') {
                await cargarModulosLocales();
            }
            return;
        }

        await cargarModulosLocales();
    })();
})();
