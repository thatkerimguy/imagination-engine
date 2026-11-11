import type * as Ort from 'onnxruntime-web/webgpu';

/**
 * onnxruntime-web, loaded on demand so none of it reaches the Player. Its WebGPU build ships a
 * 27 MiB .wasm, over the 25 MiB a file may be on Cloudflare; a build made with
 * VITE_ORT_WASM_CDN=1 (the hosted Studio, ADR 0030) fetches the runtime from jsDelivr instead,
 * pinned to the exact version bundled here.
 */
export async function loadOrt(): Promise<typeof Ort> {
  const ort = await import('onnxruntime-web/webgpu');
  if (import.meta.env.VITE_ORT_WASM_CDN === '1')
    ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;
  return ort;
}
