import { obtenerRaizCanalDom } from './channel.js';

// ==================================================
// CSS (ESTÉTICA MAXIMUS ORDEN + AZUL PARA VIDEOS SIN SUBTÍTULOS)
// ==================================================

export function css() {
    let style = document.getElementById('maximus-yt-css');
    if (!style) {
        style = document.createElement('style');
        style.id = 'maximus-yt-css';
        (document.head || document.documentElement).append(style);
    }

    style.textContent = `
        .maximus-panel {
            position: relative !important;
            z-index: 9 !important;
            display: grid !important;
            grid-template-columns: max-content minmax(220px, 1fr);
            align-items: center;
            gap: 6px 8px;
            box-sizing: border-box !important;
            margin: 12px 0 4px 0 !important;
            padding: 8px 10px !important;
            width: 100% !important;
            max-width: 780px !important;
            border: 1px solid rgba(113, 131, 153, 0.45) !important;
            border-radius: 6px !important;
            background: rgba(248, 250, 252, 0.96) !important;
            color: #26394b !important;
            font: 12px Arial, sans-serif !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08) !important;
        }

        html[dark] .maximus-panel {
            background: rgba(24, 28, 34, 0.95) !important;
            border-color: #3d4f63 !important;
            color: #e2e8f0 !important;
        }

        .maximus-controles-izq {
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            flex-wrap: wrap !important;
        }

        .maximus-boton,
        .maximus-barra {
            height: 32px !important;
            min-height: 32px !important;
            max-height: 32px !important;
            box-sizing: border-box !important;
            margin: 0 !important;
        }

        .maximus-boton {
            padding: 0 12px !important;
            background: #fff !important;
            border: 1px solid #718399 !important;
            border-radius: 4px !important;
            color: #26394b !important;
            white-space: nowrap !important;
            cursor: pointer !important;
            font: 600 12px Arial, sans-serif !important;
            transition: background-color .15s, border-color .15s, color .15s;
        }

        html[dark] .maximus-boton {
            background: #222b35 !important;
            border-color: #64788f !important;
            color: #f1f5f9 !important;
        }

        .maximus-boton:hover:not(:disabled) {
            background: #f1f5f9 !important;
        }

        html[dark] .maximus-boton:hover:not(:disabled) {
            background: #2d3846 !important;
        }

        .maximus-boton.listo {
            background: #e8f8ee !important;
            border-color: #29aa59 !important;
            color: #166534 !important;
        }

        html[dark] .maximus-boton.listo {
            background: #143823 !important;
            border-color: #29aa59 !important;
            color: #86efac !important;
        }

        .maximus-boton.detener {
            background: #fee2e2 !important;
            border-color: #dc2626 !important;
            color: #991b1b !important;
            cursor: pointer !important;
        }

        html[dark] .maximus-boton.detener {
            background: #451a1a !important;
            border-color: #ef4444 !important;
            color: #fca5a5 !important;
        }

        .maximus-boton.captcha {
            background: #fef3c7 !important;
            border-color: #f59e0b !important;
            color: #92400e !important;
            font-weight: 700 !important;
            cursor: pointer !important;
            animation: maximus-parpadeo 1.2s infinite ease-in-out !important;
        }

        html[dark] .maximus-boton.captcha {
            background: #451a03 !important;
            border-color: #f59e0b !important;
            color: #fde68a !important;
        }

        .maximus-panel.alerta-captcha {
            border-color: #f59e0b !important;
            box-shadow: 0 0 14px rgba(245, 158, 11, 0.55) !important;
            animation: maximus-latido 1.6s infinite ease-in-out !important;
        }

        @keyframes maximus-latido {
            0%, 100% {
                border-color: #f59e0b;
                box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
            }
            50% {
                border-color: #ef4444;
                box-shadow: 0 0 18px rgba(239, 68, 68, 0.65);
            }
        }

        @keyframes maximus-parpadeo {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.75; }
        }

        .maximus-boton:disabled {
            opacity: .55 !important;
            cursor: not-allowed !important;
        }

        .maximus-btn-video {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 6px !important;
            cursor: pointer !important;
            font: 600 12px Arial, sans-serif !important;
            white-space: nowrap !important;
            color: #0f0f0f !important;
            background-color: rgba(0, 0, 0, 0.05) !important;
            border: 1px solid rgba(0, 0, 0, 0.1) !important;
            border-radius: 18px !important;
            padding: 0 14px !important;
            height: 36px !important;
            margin-inline-end: 8px !important;
            transition: background-color .15s, transform .1s !important;
        }

        html[dark] .maximus-btn-video,
        html[darker-dark-theme] .maximus-btn-video,
        [dark] .maximus-btn-video,
        ytd-app[dark] .maximus-btn-video {
            color: #f1f1f1 !important;
            background-color: rgba(255, 255, 255, 0.1) !important;
            border-color: rgba(255, 255, 255, 0.15) !important;
        }

        .maximus-btn-video:hover:not(:disabled) {
            background-color: rgba(0, 0, 0, 0.1) !important;
        }

        html[dark] .maximus-btn-video:hover:not(:disabled),
        [dark] .maximus-btn-video:hover:not(:disabled) {
            background-color: rgba(255, 255, 255, 0.2) !important;
        }

        .maximus-btn-video:disabled {
            opacity: .6 !important;
            cursor: not-allowed !important;
        }

        .maximus-btn-video.copiado {
            background-color: #10b981 !important;
            color: #ffffff !important;
            border-color: #059669 !important;
        }

        .maximus-btn-video.sin-subtitulos {
            background-color: #2563eb !important;
            color: #ffffff !important;
            border-color: #1d4ed8 !important;
        }

        .maximus-modos {
            display: inline-flex !important;
            align-items: center !important;
            border: 1px solid #94a3b8 !important;
            border-radius: 4px !important;
            overflow: hidden !important;
            height: 32px !important;
            box-sizing: border-box !important;
        }

        html[dark] .maximus-modos {
            border-color: #4b5d73 !important;
        }

        .maximus-modo-btn {
            height: 100% !important;
            padding: 0 8px !important;
            border: 0 !important;
            border-right: 1px solid #cbd5e1 !important;
            background: #f1f5f9 !important;
            color: #475569 !important;
            cursor: pointer !important;
            font: 600 11px Arial, sans-serif !important;
            white-space: nowrap !important;
        }

        .maximus-modo-btn:last-of-type {
            border-right: 0 !important;
        }

        html[dark] .maximus-modo-btn {
            background: #182029 !important;
            color: #94a3b8 !important;
            border-right-color: #334155 !important;
        }

        .maximus-modo-btn.activo {
            background: #26394b !important;
            color: #fff !important;
        }

        html[dark] .maximus-modo-btn.activo {
            background: #38bdf8 !important;
            color: #0f172a !important;
        }

        .maximus-input-ultimos {
            width: 48px !important;
            height: 100% !important;
            border: 0 !important;
            border-left: 1px solid #cbd5e1 !important;
            padding: 0 4px !important;
            text-align: center !important;
            font: 600 11px Arial, sans-serif !important;
            background: #fff !important;
            color: #1e293b !important;
            outline: none !important;
        }

        html[dark] .maximus-input-ultimos {
            background: #0f172a !important;
            color: #f8fafc !important;
            border-left-color: #334155 !important;
        }

        .maximus-barra {
            display: flex !important;
            gap: 0 !important;
            padding: 0 !important;
            min-width: 0 !important;
            position: relative !important;
            overflow: hidden !important;
            border: 1px solid #afbfcc !important;
            border-radius: 4px !important;
            background: #e8edf2 !important;
        }

        html[dark] .maximus-barra {
            background: #26313d !important;
            border-color: #4c6075 !important;
        }

        .maximus-pieza {
            flex: 1 1 0 !important;
            min-width: 0 !important;
            height: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            background: #dbe3eb;
            transition: background-color .15s;
        }

        html[dark] .maximus-pieza {
            background: #2f3d4c;
        }

        .maximus-pieza.ok { background: #4dc86e !important; }
        .maximus-pieza.error { background: #ea5151 !important; }
        .maximus-pieza.sin-subtitulos { background: #3b82f6 !important; }
        .maximus-pieza.omitido { background: #3b82f6 !important; }
        .maximus-pieza.procesando { background: #f0c34f !important; }

        .maximus-pct {
            position: absolute !important;
            inset: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            pointer-events: none !important;
            color: #1e293b !important;
            font: bold 11px Arial, sans-serif !important;
            text-shadow: 0 0 4px rgba(255, 255, 255, 0.95), 0 1px 2px #fff !important;
        }

        html[dark] .maximus-pct,
        html[darker-dark-theme] .maximus-pct,
        html[darker-dark-theme-deprecate] .maximus-pct,
        [dark] .maximus-pct,
        [darker-dark-theme] .maximus-pct,
        ytd-app[dark] .maximus-pct {
            color: #ffffff !important;
            text-shadow: none !important;
        }

        .maximus-pie {
            grid-column: 1 / -1 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 10px !important;
            min-width: 0 !important;
        }

        .maximus-estado {
            color: #52708b !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            font: 11px Arial, sans-serif !important;
            flex: 1 1 auto !important;
        }

        html[dark] .maximus-estado {
            color: #9fb3c8 !important;
        }

        .maximus-log {
            padding: 0 !important;
            border: 0 !important;
            background: transparent !important;
            color: #26618f !important;
            cursor: pointer !important;
            text-decoration: underline !important;
            font: 600 11px Arial, sans-serif !important;
            white-space: nowrap !important;
        }

        html[dark] .maximus-log {
            color: #60a5fa !important;
        }

        .maximus-fila-ok {
            background: rgba(41, 170, 89, 0.14) !important;
            box-shadow: inset 4px 0 #29aa59 !important;
            border-radius: 8px !important;
        }

        .maximus-fila-error {
            background: rgba(211, 63, 69, 0.16) !important;
            box-shadow: inset 4px 0 #d33f45 !important;
            border-radius: 8px !important;
        }

        .maximus-fila-sin-subtitulos,
        .maximus-fila-omitido {
            background: rgba(59, 130, 246, 0.18) !important;
            box-shadow: inset 4px 0 #3b82f6 !important;
            border-radius: 8px !important;
        }

        @media (max-width: 720px) {
            .maximus-panel {
                grid-template-columns: 1fr !important;
            }
        }
    `;
}

// ==================================================
// BARRA TIPO TORRENT / SEEDER
// ==================================================

export function progreso(pc, n, total, mensaje) {
    if (!pc?.pct || !pc?.estado) return;
    const pctNum = total ? Math.round((n / total) * 100) : 0;
    pc.pct.textContent = total ? `${pctNum}% (${n}/${total})` : '0%';
    pc.estado.textContent = mensaje;
    pc.estado.title = mensaje;
}

export function crearPiezas(pc, items) {
    if (!pc?.barra) return;
    pc.barra.querySelectorAll('.maximus-pieza').forEach(x => x.remove());

    const maxSegmentos = Math.min(items.length, 300);
    pc.totalItemsBarra = items.length;
    pc.piezas = [];

    for (let s = 0; s < maxSegmentos; s++) {
        const x = document.createElement('span');
        x.className = 'maximus-pieza';
        pc.barra.insertBefore(x, pc.pct);
        pc.piezas.push(x);
    }
}

export function pieza(pc, i, estado, nombre, detalle = '') {
    if (!pc?.piezas?.length) return;
    const total = pc.totalItemsBarra || pc.piezas.length;
    const idxVisual = Math.min(
        pc.piezas.length - 1,
        Math.floor((i / Math.max(1, total)) * pc.piezas.length)
    );
    const nodo = pc.piezas[idxVisual];
    if (!nodo) return;
    nodo.className = `maximus-pieza ${estado}`;
    nodo.title = `${i + 1}. ${nombre}: ${detalle || estado}`;
}

// ==================================================
// MONTAJE DE LA CAJITA DEBAJO DEL BOTÓN DE SUSCRIBIRSE
// ==================================================

export function buscarAnclaDebajoSuscribirse() {
    const raiz = obtenerRaizCanalDom();

    const accionesHeader = raiz.querySelector(
        'yt-page-header-view-model yt-flexible-actions-view-model, ' +
        'yt-page-header-view-model .ytPageHeaderViewModelFlexibleActions, ' +
        'yt-page-header-view-model .ytFlexibleActionsViewModelHost, ' +
        'yt-page-header-renderer yt-flexible-actions-view-model, ' +
        '#page-header yt-flexible-actions-view-model, ' +
        '#page-header .ytPageHeaderViewModelFlexibleActions, ' +
        '#page-header .ytFlexibleActionsViewModelHost'
    );
    if (accionesHeader?.parentElement) {
        return { contenedor: accionesHeader.parentElement, referenciaDespuesDe: accionesHeader };
    }

    const infoHeader = raiz.querySelector(
        '.ytPageHeaderViewModelHeadlineInfo, ' +
        '.yt-page-header-view-model__page-header-headline-info, ' +
        '.page-header-view-model-wiz__page-header-headline-info, ' +
        'yt-page-header-view-model .ytPageHeaderViewModelContent, ' +
        'yt-page-header-view-model, ' +
        '#page-header'
    );
    if (infoHeader) {
        return { contenedor: infoHeader, referenciaDespuesDe: null };
    }

    const clasico = raiz.querySelector('#inner-header-container, #channel-header-container');
    if (clasico) {
        return { contenedor: clasico, referenciaDespuesDe: null };
    }

    return null;
}

export function insertarPanelEnAncla(panel, ancla) {
    if (ancla.referenciaDespuesDe && ancla.referenciaDespuesDe.parentElement) {
        ancla.referenciaDespuesDe.insertAdjacentElement('afterend', panel);
    } else if (ancla.contenedor) {
        ancla.contenedor.appendChild(panel);
    }
}
