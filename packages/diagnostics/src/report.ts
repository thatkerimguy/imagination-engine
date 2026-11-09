import {
  getStorageStatus,
  isIndexedDbSupported,
  isOpfsSupported,
  type StorageStatus,
} from '@ie/core';
import { measureRefreshRate } from './refresh.ts';

// Minimal WebGPU shapes, so we don't depend on @webgpu/types for one probe.
interface GpuAdapterInfoLike {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
}
interface GpuAdapterLike {
  info?: GpuAdapterInfoLike;
  features: { size: number; has(name: string): boolean };
  limits: Record<string, number | undefined>;
  isFallbackAdapter?: boolean;
}
interface GpuLike {
  requestAdapter(options?: {
    powerPreference?: 'low-power' | 'high-performance';
  }): Promise<GpuAdapterLike | null>;
}

export interface WebGpuReport {
  readonly available: boolean;
  readonly vendor?: string;
  readonly architecture?: string;
  readonly description?: string;
  readonly fallbackAdapter?: boolean;
  readonly featureCount?: number;
  readonly maxTextureDimension2D?: number;
  readonly maxBufferSize?: number;
  readonly error?: string;
}

export interface WebGl2Report {
  readonly available: boolean;
  readonly renderer?: string;
  readonly vendor?: string;
  readonly version?: string;
  readonly maxTextureSize?: number;
  readonly maxSamples?: number;
  readonly error?: string;
}

export interface AudioReport {
  readonly available: boolean;
  readonly sampleRate?: number;
  readonly baseLatencyMs?: number;
  readonly outputLatencyMs?: number;
}

export interface DeviceReport {
  readonly collectedAt: string;
  readonly userAgent: string;
  readonly display: {
    readonly viewport: string;
    readonly screen: string;
    readonly devicePixelRatio: number;
    readonly refreshHz?: number;
    readonly wideGamut: boolean;
  };
  readonly cpuCores?: number;
  readonly memoryGb?: number;
  readonly webgpu: WebGpuReport;
  readonly webgl2: WebGl2Report;
  readonly audio: AudioReport;
  readonly storage: StorageStatus;
  readonly features: Readonly<Record<string, boolean>>;
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export async function probeWebGpu(): Promise<WebGpuReport> {
  const gpu = (navigator as unknown as { gpu?: GpuLike }).gpu;
  if (!gpu) return { available: false };
  try {
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter)
      return { available: false, error: 'No adapter (WebGPU disabled or blocklisted).' };
    const info = adapter.info ?? {};
    return {
      available: true,
      ...(info.vendor ? { vendor: info.vendor } : {}),
      ...(info.architecture ? { architecture: info.architecture } : {}),
      ...(info.description ? { description: info.description } : {}),
      ...(adapter.isFallbackAdapter !== undefined
        ? { fallbackAdapter: adapter.isFallbackAdapter }
        : {}),
      featureCount: adapter.features.size,
      ...(adapter.limits.maxTextureDimension2D !== undefined
        ? { maxTextureDimension2D: adapter.limits.maxTextureDimension2D }
        : {}),
      ...(adapter.limits.maxBufferSize !== undefined
        ? { maxBufferSize: adapter.limits.maxBufferSize }
        : {}),
    };
  } catch (error) {
    return { available: false, error: message(error) };
  }
}

export function probeWebGl2(): WebGl2Report {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return { available: false };
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const report: WebGl2Report = {
      available: true,
      renderer: String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER)),
      vendor: String(gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR)),
      version: String(gl.getParameter(gl.VERSION)),
      maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
      maxSamples: Number(gl.getParameter(gl.MAX_SAMPLES)),
    };
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return report;
  } catch (error) {
    return { available: false, error: message(error) };
  }
}

/** Opens a short-lived AudioContext. Call after a user gesture so Chrome doesn't warn. */
export async function probeAudio(): Promise<AudioReport> {
  if (typeof AudioContext === 'undefined') return { available: false };
  const ctx = new AudioContext({ latencyHint: 'interactive' });
  try {
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
    return {
      available: true,
      sampleRate: ctx.sampleRate,
      baseLatencyMs: Math.round(ctx.baseLatency * 1000 * 10) / 10,
      ...(ctx.outputLatency
        ? { outputLatencyMs: Math.round(ctx.outputLatency * 1000 * 10) / 10 }
        : {}),
    };
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

function detectFeatures(): Record<string, boolean> {
  const nav = navigator as Navigator & { wakeLock?: unknown };
  return {
    secureContext: window.isSecureContext,
    serviceWorker: 'serviceWorker' in navigator,
    indexedDb: isIndexedDbSupported(),
    opfs: isOpfsSupported(),
    wakeLock: nav.wakeLock !== undefined,
    vibration: typeof navigator.vibrate === 'function',
    deviceOrientation: 'DeviceOrientationEvent' in window,
    gamepad: typeof navigator.getGamepads === 'function',
    fullscreen: typeof document.documentElement.requestFullscreen === 'function',
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    touch: navigator.maxTouchPoints > 0,
    standalone: matchMedia('(display-mode: standalone)').matches,
  };
}

export interface ReportOptions {
  readonly measureRefresh?: boolean;
  /** Skip the audio probe when there has been no user gesture yet (Chrome would warn). */
  readonly probeAudio?: boolean;
}

export async function collectDeviceReport(options: ReportOptions = {}): Promise<DeviceReport> {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const audioProbe =
    options.probeAudio === false
      ? Promise.resolve<AudioReport>({ available: typeof AudioContext !== 'undefined' })
      : probeAudio().catch((): AudioReport => ({ available: false }));
  const [webgpu, audio, storage, refreshHz] = await Promise.all([
    probeWebGpu(),
    audioProbe,
    getStorageStatus(),
    options.measureRefresh === false ? Promise.resolve(undefined) : measureRefreshRate(),
  ]);
  return {
    collectedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    display: {
      viewport: `${window.innerWidth} × ${window.innerHeight}`,
      screen: `${screen.width} × ${screen.height}`,
      devicePixelRatio: Math.round(window.devicePixelRatio * 100) / 100,
      ...(refreshHz !== undefined ? { refreshHz } : {}),
      wideGamut: matchMedia('(color-gamut: p3)').matches,
    },
    ...(navigator.hardwareConcurrency ? { cpuCores: navigator.hardwareConcurrency } : {}),
    ...(nav.deviceMemory ? { memoryGb: nav.deviceMemory } : {}),
    webgpu,
    webgl2: probeWebGl2(),
    audio,
    storage,
    features: detectFeatures(),
  };
}
