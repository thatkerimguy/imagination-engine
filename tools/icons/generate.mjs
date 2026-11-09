// Rasterizes tools/icons/{player,studio}.svg into each app's public/ folder.
// Run with `pnpm icons` after editing an SVG; the PNGs are committed so builds don't need sharp.
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

const apps = [
  { name: 'player', svg: join(here, 'player.svg') },
  { name: 'studio', svg: join(here, 'studio.svg') },
];

const outputs = [
  { file: 'pwa-64x64.png', size: 64 },
  { file: 'pwa-192x192.png', size: 192 },
  { file: 'pwa-512x512.png', size: 512 },
  // Full-bleed square: the artwork already sits inside the maskable safe zone.
  { file: 'maskable-icon-512x512.png', size: 512 },
  { file: 'apple-touch-icon-180x180.png', size: 180 },
];

for (const app of apps) {
  const out = join(root, 'apps', app.name, 'public');
  await mkdir(out, { recursive: true });
  for (const { file, size } of outputs) {
    await sharp(app.svg, { density: 384 }).resize(size, size).png().toFile(join(out, file));
  }
  await copyFile(app.svg, join(out, 'favicon.svg'));
  console.log(`icons → apps/${app.name}/public`);
}
