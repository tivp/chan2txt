// Configuración general, clientes Innertube y estado compartido entre módulos.

// Logo de Transformer vectorizado en Base64 a partir de Transfomer Logo.svg.
export const LOGO_BASE64 =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjIyMCAxOTAgNTUyIDU0MiI+PHBvbHlnb24gcG9pbnRzPSIzNzAuNyw1MDYuOSAzNzAuMyw1MDYuNyAzMzEuNSw0NzguNyAzMzEuMyw0NTMuNyAyNzguMyw0MTUuMSAyOTMsNjA3LjIgMzcwLjcsNjczIi8+PHBvbHlnb24gcG9pbnRzPSI1NDYsNDc5IDU0Niw2MDcuNiA0NDYuMSw2MDcuNiA0NDYuMSw0NzguNCAzOTAuNyw1MDcuMSAzOTAuNyw2ODkuOSA0MTUuNiw3MTEgNDQ1LjksNjM4LjkgNTQ1LjMsNjM4LjkgNTc1LjgsNzExIDYwMC44LDY4NyA2MDAuOCw1MDcuNCIvPjxwb2x5Z29uIHBvaW50cz0iNDMxLjUsNzIxLjcgNTU5LjUsNzIxLjcgNTMzLjksNjU3IDQ1Ny41LDY1NyIvPjxwb2x5Z29uIHBvaW50cz0iNjIwLjYsNjczLjcgNjIwLjYsNTA2LjIgNjU5LjksNDc4LjQgNjU5LjksNDU0LjQgNzEyLjUsNDE2LjEgNjk4LjEsNjA3LjIiLz48cG9seWdvbiBwb2ludHM9IjQ2Mi42LDU4OC45IDQ2Mi42LDQ2MC42IDQ0Ny43LDM2NS45IDQ5NS44LDQwMC4zIDU0Mi42LDM2NS45IDUyOS4xLDQ2MS40IDUyOS4xLDU4OC45Ii8+PHBhdGggZD0iTTQyNy45LDM1NC4xbC0xMDEtNjYuM2wtMTEuNS01Mi43bC04My43LTYuM2wzNC42LDE1Nmw4MC40LDU4LjdsOTguMiwxNS41TDQyNy45LDM1NC4xeiBNMjc2LjMsMjgzLjdsMTE3LjgsNzguNWwyLjUsMTYuNmwtMTE2LjItNzcuM0wyNzYuMywyODMuN3ogTTI4OS4xLDM0N2wtNC4xLTE3LjhsMTE3LjgsNzguNWwyLjUsMTYuNkwyODkuMSwzNDd6Ii8+PHBhdGggZD0iTTU0Ni42LDQ1OS4xbDk4LjItMTUuNWw4MC40LTU4LjdsMzQuNi0xNTZsLTgzLjcsNi4zbC0xMS41LDUyLjdsLTEwMSw2Ni4zTDU0Ni42LDQ1OS4xeiBNNzExLDMwMS41bC0xMTYuMiw3Ny4zbDIuNS0xNi42bDExNy44LTc4LjVMNzExLDMwMS41eiBNNTg2LjEsNDI0LjJsMi41LTE2LjZsMTE3LjgtNzguNWwtNC4xLDE3LjhMNTg2LjEsNDI0LjJ6Ii8+PHBhdGggZD0iTTQ5NS4yLDIwMS4zYy05NiwwLTE1OS4xLDMzLjQtMTU5LjEsMzMuNGw4LjYsNDMuM2wxNTAuNSw5OS40bDE1MS4zLTk5LjFsOC42LTQyLjhDNjU1LjEsMjM1LjQsNTkxLjIsMjAxLjMsNDk1LjIsMjAxLjN6IE00OTYsMzE3LjFsLTg2LjktNTcuOWgxNzIuN0w0OTYsMzE3LjF6Ii8+PC9zdmc+';

export const CFG = Object.freeze({
    CONCURRENCIA: 6,
    MAX_IFRAMES_SIMULTANEOS: 3,
    TIMEOUT: 16000,
    TIMEOUT_IFRAME: 16000,
    PAUSA: 60,
    BLOCK_SIZE: 200,
    CLEAN_SUBTITLES: true,
    EXPORT_TIME: true,
    EXPORT_HEADER: true,
    ULTIMOS_DEFECTO: 50,
    MAX_CACHE: 80
});

export const CATEGORIAS = Object.freeze([
    { clave: 'Videos', prefijo: 'UULF', carpeta: 'Videos' },
    { clave: 'Shorts', prefijo: 'UUSH', carpeta: 'Shorts' },
    { clave: 'En vivo', prefijo: 'UULV', carpeta: 'En vivo' }
]);

// Clientes alternativos de Innertube; varios devuelven pistas timedtext sin pedir token POT de navegador.
export const CLIENTES_INNERTUBE = Object.freeze([
    {
        nombre: 'ANDROID',
        id: '3',
        ua: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14; es_ES) gzip',
        context: {
            clientName: 'ANDROID',
            clientVersion: '20.10.38',
            androidSdkVersion: 34,
            osName: 'Android',
            osVersion: '14',
            hl: 'es',
            gl: 'ES'
        }
    },
    {
        nombre: 'IOS',
        id: '5',
        ua: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X; es_ES)',
        context: {
            clientName: 'IOS',
            clientVersion: '20.10.4',
            deviceMake: 'Apple',
            deviceModel: 'iPhone16,2',
            osName: 'iPhone',
            osVersion: '17.5.1.21F90',
            hl: 'es',
            gl: 'ES'
        }
    },
    {
        nombre: 'MWEB',
        id: '2',
        ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
        context: {
            clientName: 'MWEB',
            clientVersion: '2.20260401.01.00',
            hl: 'es',
            gl: 'ES'
        }
    },
    {
        nombre: 'WEB_EMBEDDED_PLAYER',
        id: '56',
        ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        context: {
            clientName: 'WEB_EMBEDDED_PLAYER',
            clientVersion: '1.20260401.01.00',
            hl: 'es',
            gl: 'ES'
        }
    }
]);

export const POT_CARRIED_PARAM_NAMES = Object.freeze([
    'pot', 'potc', 'c', 'cver', 'cplayer', 'cos', 'cosver',
    'cplatform', 'cbr', 'cbrver', 'xorb', 'xobt', 'xovt'
]);

const winRef = typeof unsafeWindow !== 'undefined' ? unsafeWindow : (typeof window !== 'undefined' ? window : null);
const enIframe = typeof window !== 'undefined' && window.top !== window.self;
const enIframeTrabajador = enIframe && location.search.includes('maximus_worker=1');

export const estado = {
    win: winRef,
    esIframe: enIframe,
    esIframeTrabajador: enIframeTrabajador,
    potParamsByVideoId: new Map(),
    subtitulosCachePorVideoId: new Map(),
    transcriptJsonPorVideoId: new Map(),
    potLatestParams: null,
    potHooksInstalled: false,
    estadoFilas: new Map(),
    abortadoresActivos: new Set(),
    callbacksWorkersIframe: new Map(),
    iframesActivosSet: new Set(),
    panelCanal: null,
    ocupado: false,
    cancelado: false,
    pendiente: false,
    seqDescubrimiento: 0,
    iframesEnCurso: 0,
    enPausaPorCaptcha: false,
    resolverCaptchaFn: null,
    urlCaptchaActivo: ''
};

// Inserta al final para mantener comportamiento LRU simple y acotar uso de memoria.
export function guardarEnMapaConLimite(mapa, clave, valor, maxItems = CFG.MAX_CACHE) {
    if (!clave) return;
    if (mapa.has(clave)) mapa.delete(clave);
    mapa.set(clave, valor);
    while (mapa.size > maxItems) {
        const primeraClave = mapa.keys().next().value;
        if (primeraClave === undefined) break;
        mapa.delete(primeraClave);
    }
}

export function verificarCancelacion() {
    if (estado.cancelado) {
        const err = new Error('Descarga detenida por el usuario');
        err.esCancelacion = true;
        throw err;
    }
}
