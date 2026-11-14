// Empaquetado ZIP sin compresión (STORE + CRC32) y mapa ASCII de archivos.

import { canon, clonarBytes } from './utils.js';

export function generarMapaArbol(raizNombre, listaArchivos) {
    const raiz = { hijos: new Map(), archivos: [] };

    for (const item of listaArchivos) {
        const partes = String(item.ruta)
            .replace(/\\/g, '/')
            .split('/')
            .filter(Boolean);

        if (partes[0] && canon(partes[0]) === canon(raizNombre)) {
            partes.shift();
        }

        let actual = raiz;
        for (let i = 0; i < partes.length - 1; i++) {
            const dir = partes[i];
            if (!actual.hijos.has(dir)) {
                actual.hijos.set(dir, { nombre: dir, hijos: new Map(), archivos: [] });
            }
            actual = actual.hijos.get(dir);
        }

        const archivo = partes.at(-1) || 'Archivo.txt';
        actual.archivos.push({
            nombre: archivo,
            comentario: item.comentario || ''
        });
    }

    const lineas = [`${raizNombre}/`];

    const recorrer = (nodo, prefijo) => {
        const carpetas = [...nodo.hijos.values()];
        const archivos = nodo.archivos;
        const entradas = [
            ...carpetas.map(c => ({ tipo: 'dir', datos: c })),
            ...archivos.map(a => ({ tipo: 'file', datos: a }))
        ];

        entradas.forEach((entrada, idx) => {
            const esUltimo = idx === entradas.length - 1;
            const conector = esUltimo ? '└── ' : '├── ';
            const subPrefijo = prefijo + (esUltimo ? '    ' : '│   ');

            if (entrada.tipo === 'dir') {
                lineas.push(`${prefijo}${conector}${entrada.datos.nombre}/`);
                recorrer(entrada.datos, subPrefijo);
            } else {
                const izq = `${prefijo}${conector}${entrada.datos.nombre}`;
                if (entrada.datos.comentario) {
                    const relleno = ' '.repeat(Math.max(2, 64 - izq.length));
                    lineas.push(`${izq}${relleno}# ${entrada.datos.comentario}`);
                } else {
                    lineas.push(izq);
                }
            }
        });
    };

    recorrer(raiz, '');
    return lineas.join('\r\n');
}

const CRC_TABLA = (() => {
    const tabla = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        tabla[i] = c >>> 0;
    }
    return tabla;
})();

export function calcularCrc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.byteLength; i++) {
        crc = CRC_TABLA[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function crearZipNativo() {
    const archivos = new Map();

    return {
        tiene(ruta) {
            return archivos.has(ruta.toLowerCase());
        },
        agregar(ruta, contenido) {
            const limpia = String(ruta)
                .replace(/\\/g, '/')
                .replace(/\/+/g, '/')
                .replace(/^\/|\/$/g, '');

            const bytes =
                typeof contenido === 'string'
                    ? new TextEncoder().encode(contenido)
                    : clonarBytes(contenido);

            archivos.set(limpia.toLowerCase(), {
                ruta: limpia,
                bytes
            });
        },
        limpiarMemoria() {
            archivos.clear();
        },
        generarBlob() {
            const encoder = new TextEncoder();
            const ahora = new Date();
            const anio = Math.max(1980, ahora.getFullYear());
            const fechaDos = ((anio - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();
            const horaDos = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);

            const partesLocales = [];
            const partesCentrales = [];
            let offsetLocal = 0;
            let tamanoCentral = 0;
            let total = 0;

            for (const item of archivos.values()) {
                const nombreBytes = encoder.encode(item.ruta);
                const datos = item.bytes;
                const tamano = datos.byteLength >>> 0;
                const crc = calcularCrc32(datos);

                const localBuf = new ArrayBuffer(30);
                const localView = new DataView(localBuf);
                localView.setUint32(0, 0x04034b50, true);
                localView.setUint16(4, 20, true);
                localView.setUint16(6, 0x0800, true);
                localView.setUint16(8, 0, true);
                localView.setUint16(10, horaDos, true);
                localView.setUint16(12, fechaDos, true);
                localView.setUint32(14, crc, true);
                localView.setUint32(18, tamano, true);
                localView.setUint32(22, tamano, true);
                localView.setUint16(26, nombreBytes.byteLength, true);
                localView.setUint16(28, 0, true);

                partesLocales.push(new Uint8Array(localBuf), nombreBytes, datos);

                const centralBuf = new ArrayBuffer(46);
                const centralView = new DataView(centralBuf);
                centralView.setUint32(0, 0x02014b50, true);
                centralView.setUint16(4, 20, true);
                centralView.setUint16(6, 20, true);
                centralView.setUint16(8, 0x0800, true);
                centralView.setUint16(10, 0, true);
                centralView.setUint16(12, horaDos, true);
                centralView.setUint16(14, fechaDos, true);
                centralView.setUint32(16, crc, true);
                centralView.setUint32(20, tamano, true);
                centralView.setUint32(24, tamano, true);
                centralView.setUint16(28, nombreBytes.byteLength, true);
                centralView.setUint16(30, 0, true);
                centralView.setUint16(32, 0, true);
                centralView.setUint16(34, 0, true);
                centralView.setUint16(36, 0, true);
                centralView.setUint32(38, 0, true);
                centralView.setUint32(42, offsetLocal, true);

                partesCentrales.push(new Uint8Array(centralBuf), nombreBytes);

                offsetLocal += 30 + nombreBytes.byteLength + tamano;
                tamanoCentral += 46 + nombreBytes.byteLength;
                total++;
            }

            const eocdBuf = new ArrayBuffer(22);
            const eocdView = new DataView(eocdBuf);
            eocdView.setUint32(0, 0x06054b50, true);
            eocdView.setUint16(4, 0, true);
            eocdView.setUint16(6, 0, true);
            eocdView.setUint16(8, total, true);
            eocdView.setUint16(10, total, true);
            eocdView.setUint32(12, tamanoCentral, true);
            eocdView.setUint32(16, offsetLocal, true);
            eocdView.setUint16(20, 0, true);

            const blob = new Blob(
                [...partesLocales, ...partesCentrales, new Uint8Array(eocdBuf)],
                { type: 'application/zip' }
            );

            partesLocales.length = 0;
            partesCentrales.length = 0;
            archivos.clear();

            return blob;
        }
    };
}

export function rutaLibre(zip, baseRuta, nombreArchivo) {
    const construir = n => (baseRuta ? `${baseRuta}/${n}` : n);
    const candidato = construir(nombreArchivo);

    if (!zip.tiene(candidato)) return candidato;

    const i = nombreArchivo.lastIndexOf('.');
    const base = i > 0 ? nombreArchivo.slice(0, i) : nombreArchivo;
    const ext = i > 0 ? nombreArchivo.slice(i) : '';

    let k = 2;
    while (zip.tiene(construir(`${base} (${k})${ext}`))) {
        k++;
    }

    return construir(`${base} (${k})${ext}`);
}

export function guardarZip(pc) {
    if (!pc?.zipBlob) return;

    if (!pc.zipUrl) {
        pc.zipUrl = URL.createObjectURL(pc.zipBlob);
    }

    const a = document.createElement('a');
    a.href = pc.zipUrl;
    a.download = pc.zipNombre;
    a.rel = 'noopener';
    a.style.display = 'none';
    a.addEventListener('click', e => e.stopPropagation());

    (document.body || document.documentElement).appendChild(a);
    a.click();

    setTimeout(() => a.remove(), 10000);
}
