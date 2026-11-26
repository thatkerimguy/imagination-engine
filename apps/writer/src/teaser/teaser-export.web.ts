// Web teaser export: paint the card on an HTML canvas at 1080×1920 and download the PNG.
// DOM / canvas code lives only in this `.web.ts` file; the native bundle never sees it.
import { deliverBytes } from '../export/deliver';
import {
  getTeaserPreset,
  quoteLayout,
  TEASER_SIZE,
  type TeaserCard,
  type TeaserPreset,
} from './teaser-model.ts';
import { teaserFilename, type TeaserExportInput, type TeaserExportResult } from './teaser-types.ts';

export type { TeaserExportInput, TeaserExportResult } from './teaser-types.ts';

const { width: W, height: H } = TEASER_SIZE;
const PAD = 96;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const family = (p: TeaserPreset): string =>
  p.serif ? 'Georgia, "Times New Roman", serif' : 'system-ui, "Segoe UI", Roboto, sans-serif';

function paint(ctx: CanvasRenderingContext2D, card: TeaserCard): void {
  const p = getTeaserPreset(card.preset);
  ctx.fillStyle = p.background;
  ctx.fillRect(0, 0, W, H);
  if (p.glow) {
    ctx.strokeStyle = p.glow;
    ctx.lineWidth = 8;
    ctx.shadowColor = p.glow;
    ctx.shadowBlur = 48;
    ctx.strokeRect(36, 36, W - 72, H - 72);
    ctx.shadowBlur = 0;
  }
  const { fontSize, lineHeight } = quoteLayout(card.quote.length);
  ctx.textBaseline = 'top';
  ctx.font = `400 ${fontSize}px ${family(p)}`;
  const lines = wrap(ctx, card.quote, W - PAD * 2);
  const block = lines.length * lineHeight;
  const top = Math.round((H - block) / 2);
  ctx.fillStyle = card.accent;
  ctx.fillRect(PAD, top - 56, 120, 8);
  ctx.fillStyle = p.text;
  lines.forEach((l, i) => ctx.fillText(l, PAD, top + i * lineHeight));
  ctx.fillStyle = p.muted;
  ctx.font = `600 40px ${family(p)}`;
  ctx.fillText(card.bookTitle, PAD, H - 300, W - PAD * 2);
  ctx.font = `400 34px ${family(p)}`;
  ctx.fillText(card.chapterTitle, PAD, H - 240, W - PAD * 2);
  if (card.badge) {
    ctx.font = `600 30px ${family(p)}`;
    const w = ctx.measureText(card.badge).width + 48;
    ctx.fillStyle = card.accent;
    ctx.fillRect(PAD, 160, w, 64);
    ctx.fillStyle = p.background;
    ctx.fillText(card.badge, PAD + 24, 177);
  }
}

const loadImage = (src: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

async function drawCover(ctx: CanvasRenderingContext2D, card: TeaserCard): Promise<void> {
  if (!card.showCover || !card.coverUri) return;
  const img = await loadImage(card.coverUri);
  if (img) ctx.drawImage(img, W - PAD - 160, H - 320, 160, 240);
}

export async function exportTeaserPng(input: TeaserExportInput): Promise<TeaserExportResult> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, message: 'Canvas is not available in this browser.' };
    paint(ctx, input.card);
    await drawCover(ctx, input.card);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) return { ok: false, message: 'Could not create the image.' };
    const filename = teaserFilename(input.stem);
    const status = await deliverBytes(
      filename,
      new Uint8Array(await blob.arrayBuffer()),
      'image/png',
    );
    return { ok: true, status, filename };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Could not create the image.',
    };
  }
}
