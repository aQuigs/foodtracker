#!/usr/bin/env node
// Renders public/favicon.svg into the raster icons index.html and the manifest
// point at. Run via `npm run icons` after changing the SVG, then commit the PNGs.

import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = resolve(ROOT, 'public');

// Home-screen icons are full-bleed squares — iOS rounds the corners and Android
// crops maskable icons to the launcher's shape — so the glyph is shrunk into the
// central safe zone. The favicon fallback stays transparent like the SVG.
const ICONS = [
  { file: 'favicon-32.png',       size: 32,  padded: false },
  { file: 'apple-touch-icon.png', size: 180, padded: true },
  { file: 'icon-192.png',         size: 192, padded: true },
  { file: 'icon-512.png',         size: 512, padded: true },
];
const SAFE_ZONE = 0.64;

const css = await readFile(resolve(ROOT, 'src/styles.css'), 'utf8');
const background = /(?<![\w-])--bg:\s*(#[0-9a-f]+)/i.exec(css)?.[1];
if (!background) {
  throw new Error('src/styles.css defines no --bg');
}

const svg = await readFile(resolve(PUBLIC, 'favicon.svg'), 'utf8');
const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, padded } of ICONS) {
  const glyph = padded ? Math.round(size * SAFE_ZONE) : size;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;` +
    `background:${padded ? background : 'transparent'}">` +
    `<img src="${src}" width="${glyph}" height="${glyph}"></body>`,
  );
  await page.screenshot({ path: resolve(PUBLIC, file), omitBackground: !padded });
  console.log(`wrote public/${file}`);
}
await browser.close();
