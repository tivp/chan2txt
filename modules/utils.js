export const dormir = ms => new Promise(resolve => setTimeout(resolve, ms));

export function crearElemento(tag, props = {}, hijos = []) {
    const nodo = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (v === undefined || v === null) continue;
        if (k === 'className') {
            nodo.className = v;
        } else if (k === 'textContent') {
            nodo.textContent = v;
        } else if (k === 'hidden') {
            nodo.hidden = Boolean(v);
        } else if (k === 'dataset' && typeof v === 'object') {
            for (const [dk, dv] of Object.entries(v)) {
                nodo.dataset[dk] = dv;
            }
        } else {
            nodo.setAttribute(k, String(v));
        }
    }
    for (const hijo of hijos) {
        if (hijo == null) continue;
        if (typeof hijo === 'string') {
            nodo.appendChild(document.createTextNode(hijo));
        } else {
            nodo.appendChild(hijo);
        }
    }
    return nodo;
}

// ==================================================
// UTILIDADES DE TEXTO, DESCARGA DE BLOBS Y NOMBRES DE ARCHIVO
// ==================================================

export const texto = value =>
    String(value ?? '')
        .replace(/[\u200b-\u200d\ufeff\u00a0]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

export const canon = value => texto(value).toLocaleLowerCase('es');

export const seguro = (value, defecto = 'Sin titulo') => {
    const nombre = texto(value)
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[. ]+$/g, '')
        .slice(0, 140);

    return nombre || defecto;
};

export const clonarBytes = src => {
    if (!src) return new Uint8Array(0);
    const vista = src instanceof Uint8Array ? src : new Uint8Array(src);
    const limpio = new Uint8Array(vista.byteLength);
    limpio.set(vista);
    return limpio;
};

export function descargarBlob(bytes, nombreArchivo, mimeType = 'text/plain;charset=utf-8') {
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    a.rel = 'noopener';
    a.style.display = 'none';
    a.addEventListener('click', e => e.stopPropagation());
    (document.body || document.documentElement).appendChild(a);
    a.click();
    setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
    }, 10000);
}

export function formatearTiempoRestante(segundosTotales) {
    if (!Number.isFinite(segundosTotales) || segundosTotales <= 0) return 'calculando...';
    const seg = Math.round(segundosTotales);
    const d = Math.floor(seg / 86400);
    const h = Math.floor((seg % 86400) / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = seg % 60;

    if (d > 0) return `${d} d ${h} h`;
    if (h > 0) return `${h} h ${m} m`;
    if (m > 0) return `${m} m ${s} s`;
    return `${s} s`;
}

export function calcularEta(procesados, total, tiempoInicioMs) {
    if (procesados < 2 || total <= procesados) return '';
    const segundosTranscurridos = (Date.now() - tiempoInicioMs) / 1000;
    if (segundosTranscurridos < 2) return '';
    const velocidad = procesados / segundosTranscurridos;
    if (velocidad <= 0) return '';
    const segundosRestantes = (total - procesados) / velocidad;
    return formatearTiempoRestante(segundosRestantes);
}

export function extraerJsonBalanceadoDesdeIndice(str, idxInicioLlave) {
    if (idxInicioLlave === -1 || idxInicioLlave >= str.length) return null;
    const inicio = str.indexOf('{', idxInicioLlave);
    if (inicio === -1) return null;

    let nivel = 0;
    let enString = false;
    let escape = false;

    for (let i = inicio; i < str.length; i++) {
        const ch = str[i];

        if (escape) {
            escape = false;
            continue;
        }
        if (ch === '\\' && enString) {
            escape = true;
            continue;
        }
        if (ch === '"') {
            enString = !enString;
            continue;
        }
        if (!enString) {
            if (ch === '{') nivel++;
            else if (ch === '}') {
                nivel--;
                if (nivel === 0) {
                    try {
                        return JSON.parse(str.slice(inicio, i + 1));
                    } catch {
                        return null;
                    }
                }
            }
        }
    }
    return null;
}

export function extraerJsonBalanceado(html, marcador) {
    const idx = html.indexOf(marcador);
    if (idx === -1) return null;
    return extraerJsonBalanceadoDesdeIndice(html, idx + marcador.length);
}

export function extraerYtInitialDataDeHtml(html) {
    return (
        extraerJsonBalanceado(html, 'var ytInitialData =') ||
        extraerJsonBalanceado(html, 'window["ytInitialData"] =') ||
        extraerJsonBalanceado(html, 'ytInitialData =')
    );
}
