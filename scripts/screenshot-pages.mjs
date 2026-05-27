#!/usr/bin/env node
// Capture screenshots of the two main pages (log + foods) at desktop and narrow viewports.
// Run via `npm run screenshots`. Outputs to ./screenshots/ in the repo root.
// After running, READ each .png and analyze for weird UX: overflow, mis-aligned controls,
// missing labels, hover/active state collisions, layout collapses at the narrow viewport, etc.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const OUT = resolve(REPO_ROOT, 'screenshots');

const PAGES = [
  { name: 'log', setup: async (page) => { await page.click('[data-testid="view-toggle-log"]', { trial: false }).catch(() => {}); } },
  { name: 'foods', setup: async (page) => { await page.click('[data-testid="view-toggle-foods"]'); } },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'narrow',  width: 480,  height: 900 },
];

async function waitForServer(url, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server never came up at ${url}`);
}

const existingServer = await fetch('http://localhost:5173/foodtracker/').then(() => true).catch(() => false);
let server = null;
if (!existingServer) {
  server = spawn('npx', ['vite', '--port', '5173'], { cwd: REPO_ROOT, stdio: 'ignore' });
  await waitForServer('http://localhost:5173/foodtracker/');
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

const errors = [];
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  page.on('pageerror', (e) => errors.push(`[${vp.name}] pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[${vp.name}] console.error: ${msg.text()}`);
  });
  await page.goto('http://localhost:5173/foodtracker/', { waitUntil: 'networkidle' });

  for (const p of PAGES) {
    await p.setup(page);
    const file = resolve(OUT, `${p.name}-${vp.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`wrote ${file}`);
  }
  await page.close();
}

await browser.close();
if (server) server.kill();

if (errors.length) {
  console.error('\n!! page or console errors:');
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
