export { average, formatBytes, formatMs, percentile, refreshRateFromIntervals } from './format.ts';
export { PerfHud } from './hud.ts';
export { diagnosticsMessages } from './messages.ts';
export { measureRefreshRate } from './refresh.ts';
export { renderReport, reportToText } from './render.ts';
export {
  collectDeviceReport,
  probeAudio,
  probeWebGl2,
  probeWebGpu,
  type AudioReport,
  type DeviceReport,
  type ReportOptions,
  type WebGl2Report,
  type WebGpuReport,
} from './report.ts';
