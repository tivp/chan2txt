import { pipeline, env } from './lib/transformers.min.js';

const ORT_WASM_URL =
    'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/ort-wasm-simd-threaded.jsep.wasm';
const WASM_CACHE_NAME = 'chan2txt-ort-wasm-v1';

let wasmBlobUrlPromise = null;
let pipelineState = { modelId: '', device: '', promise: null };
let gpuQueue = Promise.resolve();

function enqueueGpu(fn) {
    const next = gpuQueue.then(fn, fn);
    gpuQueue = next.catch(() => {});
    return next;
}

async function getOrtWasmBlobUrl() {
    if (wasmBlobUrlPromise) return wasmBlobUrlPromise;
    wasmBlobUrlPromise = (async () => {
        let buf = null;
        try {
            const cache = await caches.open(WASM_CACHE_NAME);
            let cached = await cache.match(ORT_WASM_URL);
            if (!cached) {
                const fetched = await fetch(ORT_WASM_URL);
                if (!fetched.ok) {
                    throw new Error(`No se pudo descargar runtime ORT WASM (HTTP ${fetched.status})`);
                }
                await cache.put(ORT_WASM_URL, fetched.clone());
                cached = fetched;
            }
            buf = await cached.arrayBuffer();
        } catch {
            const direct = await fetch(ORT_WASM_URL);
            if (!direct.ok) {
                throw new Error(`No se pudo descargar runtime ORT WASM (HTTP ${direct.status})`);
            }
            buf = await direct.arrayBuffer();
        }
        return URL.createObjectURL(new Blob([buf], { type: 'application/wasm' }));
    })().catch(err => {
        wasmBlobUrlPromise = null;
        throw err;
    });
    return wasmBlobUrlPromise;
}

async function detectBestDevice() {
    if (!navigator.gpu) return 'wasm';
    try {
        const adapter = await navigator.gpu.requestAdapter();
        return adapter ? 'webgpu' : 'wasm';
    } catch {
        return 'wasm';
    }
}

async function getTranscriber(requestedModelId) {
    const device = await detectBestDevice();
    const modelId =
        requestedModelId ||
        (device === 'webgpu' ? 'onnx-community/whisper-small' : 'onnx-community/whisper-tiny');

    if (
        pipelineState.promise &&
        pipelineState.modelId === modelId &&
        pipelineState.device === device
    ) {
        return pipelineState.promise;
    }

    // Liberar sesión anterior si cambió el modelo
    if (pipelineState.promise) {
        try {
            const prev = await pipelineState.promise;
            if (typeof prev?.dispose === 'function') {
                await prev.dispose();
            }
        } catch {}
    }

    const promise = (async () => {
        const wasmBlobUrl = await getOrtWasmBlobUrl();
        env.allowLocalModels = false;
        env.backends.onnx.wasm.numThreads = 1;
        env.backends.onnx.wasm.wasmPaths = {
            mjs: chrome.runtime.getURL('lib/ort-wasm-simd-threaded.jsep.mjs'),
            wasm: wasmBlobUrl
        };

        const dtype =
            device === 'webgpu'
                ? { encoder_model: 'q4', decoder_model_merged: 'q4' }
                : 'q8';

        const transcriber = await pipeline('automatic-speech-recognition', modelId, {
            device,
            dtype
        });
        return transcriber;
    })().catch(err => {
        if (pipelineState.promise === promise) {
            pipelineState = { modelId: '', device: '', promise: null };
        }
        throw err;
    });

    pipelineState = { modelId, device, promise };
    return promise;
}

function base64ToFloat32Pcm16(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
    }
    const view = new DataView(bytes.buffer);
    const n = bytes.byteLength >> 1;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        out[i] = view.getInt16(i * 2, true) / 32768.0;
    }
    return out;
}

function mapLanguageName(code) {
    const base = String(code || 'es').toLowerCase().split('-')[0];
    const map = {
        es: 'spanish',
        en: 'english',
        pt: 'portuguese',
        fr: 'french',
        it: 'italian',
        de: 'german'
    };
    return map[base] || 'spanish';
}

chrome.runtime.onMessage.addListener((mensaje, sender, enviarRespuesta) => {
    if (!mensaje || mensaje.target !== 'chan2txt-offscreen') return false;

    if (mensaje.action === 'OFFSCREEN_PING') {
        detectBestDevice()
            .then(device => {
                enviarRespuesta({
                    ok: true,
                    device,
                    hasGpu: device === 'webgpu',
                    loadedModelId: pipelineState.modelId || null
                });
            })
            .catch(err => enviarRespuesta({ ok: false, error: err?.message || String(err) }));
        return true;
    }

    if (mensaje.action === 'OFFSCREEN_TRANSCRIBE_PCM16') {
        enqueueGpu(async () => {
            const transcriber = await getTranscriber(mensaje.modelId);
            const pcm = base64ToFloat32Pcm16(mensaje.pcm16B64 || '');
            if (!pcm.length) {
                return { ok: true, text: '', chunks: [], device: pipelineState.device, modelId: pipelineState.modelId };
            }
            const out = await transcriber(pcm, {
                language: mapLanguageName(mensaje.language),
                task: 'transcribe',
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: true,
                no_repeat_ngram_size: 5,
                repetition_penalty: 1.1
            });
            return {
                ok: true,
                text: out?.text || '',
                chunks: Array.isArray(out?.chunks) ? out.chunks : [],
                device: pipelineState.device,
                modelId: pipelineState.modelId
            };
        })
            .then(res => enviarRespuesta(res))
            .catch(err => {
                enviarRespuesta({
                    ok: false,
                    error: err?.message || String(err)
                });
            });
        return true;
    }

    return false;
});
