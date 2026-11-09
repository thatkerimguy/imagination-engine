import { createTranslator, localeTag, type Locale } from '@ie/i18n';
import { formatBytes } from './format.ts';
import { diagnosticsMessages } from './messages.ts';
import type { DeviceReport } from './report.ts';

type Row = readonly [label: string, value: string];

function sectionsFor(report: DeviceReport, locale: Locale): [string, Row[]][] {
  const t = createTranslator(diagnosticsMessages, locale);
  const yesNo = (v: boolean) => (v ? t('yes') : t('no'));
  const { display, webgpu, webgl2, audio, storage } = report;

  const gpuRows: Row[] = [
    [t('webgpu'), yesNo(webgpu.available) + (webgpu.error ? ` (${webgpu.error})` : '')],
  ];
  if (webgpu.available) {
    const adapter = [webgpu.vendor, webgpu.architecture, webgpu.description]
      .filter(Boolean)
      .join(' · ');
    gpuRows.push([t('webgpuAdapter'), adapter || '—']);
  }
  gpuRows.push([t('webgl2'), yesNo(webgl2.available)]);
  if (webgl2.renderer) gpuRows.push([t('renderer'), webgl2.renderer]);
  if (webgl2.maxTextureSize) gpuRows.push([t('maxTexture'), `${webgl2.maxTextureSize}px`]);

  const audioRows: Row[] = audio.available
    ? [
        [t('sampleRate'), audio.sampleRate ? `${audio.sampleRate} Hz` : '—'],
        [t('baseLatency'), audio.baseLatencyMs !== undefined ? `${audio.baseLatencyMs} ms` : '—'],
        [
          t('outputLatency'),
          audio.outputLatencyMs !== undefined ? `${audio.outputLatencyMs} ms` : '—',
        ],
      ]
    : [[t('section.audio'), t('unavailable')]];

  return [
    [
      t('section.display'),
      [
        [t('viewport'), display.viewport],
        [t('screen'), display.screen],
        [t('pixelRatio'), String(display.devicePixelRatio)],
        [t('refresh'), display.refreshHz ? `${display.refreshHz} Hz` : '—'],
        [t('wideGamut'), yesNo(display.wideGamut)],
      ],
    ],
    [t('section.gpu'), gpuRows],
    [t('section.audio'), audioRows],
    [
      t('section.storage'),
      [
        [t('persisted'), yesNo(storage.persisted)],
        [t('usage'), formatBytes(storage.usage, localeTag(locale))],
        [t('quota'), formatBytes(storage.quota, localeTag(locale))],
      ],
    ],
    [
      t('section.device'),
      [
        [t('cores'), report.cpuCores ? String(report.cpuCores) : '—'],
        [t('memory'), report.memoryGb ? `${report.memoryGb} GB` : '—'],
        [t('userAgent'), report.userAgent],
      ],
    ],
    [
      t('section.features'),
      Object.entries(report.features).map(([name, on]): Row => [name, yesNo(on)]),
    ],
  ];
}

/** Renders the report as quiet definition lists. Framework-free so Player and Studio can share it. */
export function renderReport(report: DeviceReport, locale: Locale): HTMLElement {
  const root = document.createElement('div');
  root.className = 'ie-report';
  for (const [title, rows] of sectionsFor(report, locale)) {
    const section = document.createElement('section');
    const heading = document.createElement('h3');
    heading.className = 'ie-label';
    heading.textContent = title;
    const list = document.createElement('dl');
    for (const [label, value] of rows) {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      list.append(dt, dd);
    }
    section.append(heading, list);
    root.append(section);
  }
  return root;
}

/** Plain-text version for copying into a bug report or a chat. */
export function reportToText(report: DeviceReport, locale: Locale = 'en'): string {
  const lines = [`Device report · ${report.collectedAt}`];
  for (const [title, rows] of sectionsFor(report, locale)) {
    lines.push('', `## ${title}`);
    for (const [label, value] of rows) lines.push(`${label}: ${value}`);
  }
  return lines.join('\n');
}
