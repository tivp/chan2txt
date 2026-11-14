// Service Worker: proxy HTTP para peticiones Innertube, notificaciones y sincronización de módulos desde GitHub.

const REPO_API_COMMIT = 'https://api.github.com/repos/tivp/chan2txt/commits/main';
const REPO_RAW_BASE = 'https://raw.githubusercontent.com/tivp/chan2txt/main';
const CACHE_KEY = 'chan2txt_github_cache';
const USER_SCRIPT_ID = 'chan2txt-github-bundle';
const MATCHES_YOUTUBE = ['https://www.youtube.com/*', 'https://m.youtube.com/*'];

const ORDEN_MODULOS = [
    'config.js',
    'utils.js',
    'zip.js',
    'interceptor.js',
    'worker-iframe.js',
    'http.js',
    'subtitles.js',
    'extractor.js',
    'channel.js',
    'ui.js',
    'main.js'
];

const controladoresActivos = new Map();
const urlsNotificaciones = new Map();

function tieneSoporteUserScripts() {
    return typeof chrome.userScripts !== 'undefined' && typeof chrome.userScripts.register === 'function';
}

// Empaqueta los 11 módulos ES6 en una sola IIFE para registrarla con chrome.userScripts.
function compilarBundleDesdeModulos(mapaModulos) {
    const bloques = ORDEN_MODULOS.map(nombre => {
        let codigo = String(mapaModulos[nombre] || '');
        codigo = codigo.replace(/^import\s+[\s\S]*?\bfrom\s+['"][^'"]+['"];?[ \t]*(?:\r?\n|$)/gm, '');
        codigo = codigo.replace(/^export\s+(async\s+function|function|const|let)/gm, '$1');
        return `// --- ${nombre} ---\n${codigo.trim()}`;
    });

    return `(() => {\n'use strict';\n\n${bloques.join('\n\n')}\n})();\n`;
}

async function sincronizarUserScriptRegistrado(codigoCompilado) {
    if (!tieneSoporteUserScripts() || !codigoCompilado) {
        return false;
    }

    try {
        if (typeof chrome.userScripts.configureWorld === 'function') {
            try {
                await chrome.userScripts.configureWorld({ messaging: true });
            } catch {
                // Si no permite configurar messaging en el mundo aislado, se usa el puente DOM de content.js.
            }
        }

        try {
            await chrome.userScripts.unregister({ ids: [USER_SCRIPT_ID] });
        } catch {
            // No había versión previa registrada.
        }

        await chrome.userScripts.register([
            {
                id: USER_SCRIPT_ID,
                matches: MATCHES_YOUTUBE,
                allFrames: true,
                js: [{ code: codigoCompilado }],
                runAt: 'document_start',
                world: 'USER_SCRIPT'
            }
        ]);

        return true;
    } catch {
        return false;
    }
}

async function asegurarUserScriptDesdeCache() {
    if (!tieneSoporteUserScripts()) return { activo: false, registradoAhora: false, cache: null };

    const datos = await chrome.storage.local.get(CACHE_KEY);
    const cache = datos[CACHE_KEY] || null;
    if (!cache?.codigoCompilado) {
        return { activo: false, registradoAhora: false, cache: null };
    }

    try {
        const existentes = await chrome.userScripts.getScripts({ ids: [USER_SCRIPT_ID] });
        if (existentes && existentes.length > 0) {
            return { activo: true, registradoAhora: false, cache };
        }
    } catch {
        // Reintentar registro abajo.
    }

    const ok = await sincronizarUserScriptRegistrado(cache.codigoCompilado);
    return { activo: ok, registradoAhora: ok, cache };
}

async function ejecutarCodigoEnPestana(tabId, codigoCompilado) {
    if (!tabId || !codigoCompilado) return false;

    if (tieneSoporteUserScripts() && typeof chrome.userScripts.execute === 'function') {
        try {
            await chrome.userScripts.execute({
                target: { tabId },
                js: [{ code: codigoCompilado }],
                world: 'USER_SCRIPT'
            });
            return true;
        } catch {
            // Probar respaldo en mundo MAIN si la pestaña lo permite.
        }
    }

    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            args: [codigoCompilado],
            func: codigo => {
                const s = document.createElement('script');
                s.textContent = codigo;
                (document.head || document.documentElement).appendChild(s);
                s.remove();
            }
        });
        return true;
    } catch {
        return false;
    }
}

async function actualizarScriptsDesdeGithub() {
    const resCommit = await fetch(`${REPO_API_COMMIT}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/vnd.github+json' }
    });

    if (!resCommit.ok) {
        throw new Error(`No se pudo consultar GitHub (HTTP ${resCommit.status})`);
    }

    const commitData = await resCommit.json();
    const sha = String(commitData.sha || '');
    const shaCorto = sha ? sha.slice(0, 7) : 'main';
    const mensajeCommit = String(commitData.commit?.message || 'Actualización').split('\n')[0].trim();
    const fechaCommit = commitData.commit?.author?.date || '';

    const entradas = await Promise.all(
        ORDEN_MODULOS.map(async nombre => {
            const url = `${REPO_RAW_BASE}/modules/${nombre}?t=${Date.now()}`;
            const resp = await fetch(url, { cache: 'no-store' });
            if (!resp.ok) {
                throw new Error(`Error al bajar modules/${nombre} (HTTP ${resp.status})`);
            }
            const texto = await resp.text();
            return [nombre, texto];
        })
    );

    const modulos = Object.fromEntries(entradas);
    const codigoCompilado = compilarBundleDesdeModulos(modulos);

    const cache = {
        sha,
        shaCorto,
        mensajeCommit,
        fechaCommit,
        actualizadoEn: new Date().toLocaleString('es-CL'),
        modulos,
        codigoCompilado
    };

    await chrome.storage.local.set({ [CACHE_KEY]: cache });

    const userScriptsActivo = await sincronizarUserScriptRegistrado(codigoCompilado);

    let pestanasActualizadas = 0;
    try {
        const pestanas = await chrome.tabs.query({ url: MATCHES_YOUTUBE });
        for (const tab of pestanas) {
            if (tab.id) {
                const ejecutado = await ejecutarCodigoEnPestana(tab.id, codigoCompilado);
                if (ejecutado) pestanasActualizadas++;
            }
        }
    } catch {
        // Ignorar si no hay pestañas de YouTube abiertas.
    }

    return {
        ok: true,
        cache: {
            sha: cache.sha,
            shaCorto: cache.shaCorto,
            mensajeCommit: cache.mensajeCommit,
            fechaCommit: cache.fechaCommit,
            actualizadoEn: cache.actualizadoEn,
            totalModulos: ORDEN_MODULOS.length
        },
        userScriptsActivo,
        pestanasActualizadas
    };
}

asegurarUserScriptDesdeCache().catch(() => {});

chrome.runtime.onInstalled.addListener(() => {
    asegurarUserScriptDesdeCache().catch(() => {});
});

if (chrome.notifications?.onClicked) {
    chrome.notifications.onClicked.addListener(notifId => {
        const url = urlsNotificaciones.get(notifId);
        urlsNotificaciones.delete(notifId);
        if (url) {
            chrome.tabs.create({ url }).catch(() => {});
        }
    });
}

chrome.runtime.onMessage.addListener((mensaje, sender, enviarRespuesta) => {
    if (!mensaje || typeof mensaje !== 'object') return false;

    if (mensaje.action === 'MAXIMUS_ABORT') {
        const ctrl = controladoresActivos.get(mensaje.requestId);
        if (ctrl) {
            controladoresActivos.delete(mensaje.requestId);
            try {
                ctrl.abort();
            } catch {
                // La petición ya estaba cerrada.
            }
        }
        enviarRespuesta({ ok: true });
        return false;
    }

    if (mensaje.action === 'MAXIMUS_NOTIFY') {
        try {
            const notifId = `c2t_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            if (mensaje.url) {
                urlsNotificaciones.set(notifId, mensaje.url);
            }
            chrome.notifications?.create(notifId, {
                type: 'basic',
                iconUrl: 'Transfomer Logo.png',
                title: String(mensaje.title || 'Canal de YouTube a TXT'),
                message: String(mensaje.message || '')
            });
        } catch {
            // Ignorar si el navegador restringe notificaciones.
        }
        return false;
    }

    if (mensaje.action === 'MAXIMUS_HTTP_REQUEST') {
        const {
            requestId,
            url,
            method = 'GET',
            headers = {},
            body,
            anonymous = false,
            timeout = 16000
        } = mensaje;
        const ctrl = new AbortController();
        if (requestId) controladoresActivos.set(requestId, ctrl);

        const reloj = setTimeout(() => ctrl.abort(), timeout);

        fetch(url, {
            method,
            headers,
            body: method === 'GET' || method === 'HEAD' ? undefined : body,
            credentials: anonymous ? 'omit' : 'include',
            cache: 'no-store',
            redirect: 'follow',
            signal: ctrl.signal
        })
            .then(async r => {
                const text = await r.text();
                enviarRespuesta({
                    status: r.status,
                    text,
                    finalUrl: r.url || url
                });
            })
            .catch(err => {
                enviarRespuesta({
                    error: err?.name === 'AbortError' ? 'Tiempo agotado o cancelado' : (err?.message || 'Error de red')
                });
            })
            .finally(() => {
                clearTimeout(reloj);
                if (requestId) controladoresActivos.delete(requestId);
            });

        return true;
    }

    if (mensaje.action === 'MAXIMUS_GET_STATUS') {
        chrome.storage.local
            .get(CACHE_KEY)
            .then(datos => {
                const c = datos[CACHE_KEY];
                enviarRespuesta({
                    ok: true,
                    cache: c
                        ? {
                              sha: c.sha,
                              shaCorto: c.shaCorto,
                              mensajeCommit: c.mensajeCommit,
                              fechaCommit: c.fechaCommit,
                              actualizadoEn: c.actualizadoEn,
                              totalModulos: Object.keys(c.modulos || {}).length
                          }
                        : null,
                    userScriptsActivo: tieneSoporteUserScripts(),
                    extensionId: chrome.runtime.id
                });
            })
            .catch(err => {
                enviarRespuesta({ ok: false, error: err?.message || 'Error al leer estado' });
            });
        return true;
    }

    if (mensaje.action === 'MAXIMUS_UPDATE_SCRIPTS') {
        actualizarScriptsDesdeGithub()
            .then(res => enviarRespuesta(res))
            .catch(err =>
                enviarRespuesta({ ok: false, error: err?.message || 'Error al actualizar desde GitHub' })
            );
        return true;
    }

    if (mensaje.action === 'MAXIMUS_INIT_TAB') {
        asegurarUserScriptDesdeCache()
            .then(async info => {
                if (info.activo && info.registradoAhora && sender.tab?.id && info.cache?.codigoCompilado) {
                    await ejecutarCodigoEnPestana(sender.tab.id, info.cache.codigoCompilado);
                }
                enviarRespuesta({ inyectadoRemoto: info.activo });
            })
            .catch(() => {
                enviarRespuesta({ inyectadoRemoto: false });
            });
        return true;
    }

    return false;
});
