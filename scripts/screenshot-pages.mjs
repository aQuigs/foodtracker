#!/usr/bin/env node
// Capture screenshots of the main pages (log, foods, catalog, catalog with the source picker open, the recipe editor, a recipe card in the log, a logged recipe group) at desktop and narrow viewports.
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
  {
    name: 'catalog',
    setup: async (page) => {
      await page.click('[data-testid="view-toggle-catalog"]');
      await page.fill('[data-testid="catalog-search-input"]', 'chicken');
      await page.waitForSelector('[data-testid="catalog-result-row"]', { timeout: 5000 }).catch(() => {});
      await page.click('[data-testid="catalog-fold-toggle"]', { timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(150);
    },
  },
  {
    name: 'sources',
    setup: async (page) => {
      await page.click('[data-testid="view-toggle-catalog"]');
      await page.click('[data-testid="source-picker-toggle"]');
      await page.fill('[data-testid="source-filter-input"]', 'co');
      await page.waitForTimeout(150);
    },
  },
  {
    name: 'brand',
    setup: async (page) => {
      await page.click('[data-testid="view-toggle-catalog"]');
      await page.click('[data-testid="source-picker-toggle"]');
      await page.click('[data-source="costco"]');
      await page.waitForSelector('[data-testid="hydration-banner"]', { state: 'detached', timeout: 5000 }).catch(() => {});
      await page.fill('[data-testid="catalog-search-input"]', 'costco almonds');
      const toggle = await page.waitForSelector(
        '[data-testid="catalog-fold-toggle"][data-source="costco"]', { timeout: 5000 },
      ).catch(() => null);
      // A query with no curated hits opens every fold by default, so the
      // toggle may already be expanded — only click it closed-to-open.
      if (toggle && (await toggle.getAttribute('aria-expanded')) !== 'true') {
        await toggle.click();
      }
      await page.waitForTimeout(150);
    },
  },
  {
    name: 'recipes',
    setup: async (page) => {
      await addFood(page, 'Egg', 78, 1, 'count');
      await addFood(page, 'Ham', 46, 28, 'g');
      await page.click('[data-testid="view-toggle-recipes"]');
      await page.fill('[data-testid="recipe-form-name"]', 'Omelette');
      await addRecipeItem(page, 'egg', '3');
      await addRecipeItem(page, 'ham', '56');
    },
  },
  {
    name: 'log-recipe',
    setup: async (page) => {
      await page.click('[data-testid="recipe-form-submit"]');
      await page.click('[data-testid="view-toggle-log"]');
      await page.fill('[data-testid="search-input"]', 'omel');
      await page.click('[data-testid="recipe-option"]');
      await page.locator('[data-testid="recipe-draft-amount"]').first().fill('2');
      await page.fill('[data-testid="servings-input"]', '2');
    },
  },
  {
    name: 'log-group',
    setup: async (page) => {
      await page.click('[data-testid="log-button"]');
      await page.waitForTimeout(100);
    },
  },
];

async function addFood(page, name, calories, servingSize, unit) {
  await page.click('[data-testid="view-toggle-foods"]');
  await page.fill('[data-testid="food-form-name"]', name);
  await page.fill('[data-testid="food-form-calories"]', String(calories));
  await page.fill('[data-testid="food-form-servingSize"]', String(servingSize));
  await page.click(`[data-testid="food-form-servingUnit"] [data-unit="${unit}"]`);
  await page.click('[data-testid="food-form-submit"]');
}

async function addRecipeItem(page, query, amount) {
  await page.fill('[data-testid="recipe-food-search"]', query);
  await page.click('[data-testid="recipe-food-option"]');
  await page.locator('[data-testid="recipe-form-amount"]').last().fill(amount);
}

const VIEWPORTS = [
  { name: 'desktop',      width: 1280, height: 900,  fontSize: '16px' },
  { name: 'desktop-zoom', width: 1280, height: 2400, fontSize: '48px' },
  { name: 'mid',          width: 700,  height: 900,  fontSize: '16px' },
  { name: 'narrow',       width: 480,  height: 900,  fontSize: '16px' },
  { name: 'phone',        width: 375,  height: 800,  fontSize: '16px' },
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

const PORT = process.env.SCREENSHOT_PORT ?? '5173';
const BASE = `http://localhost:${PORT}/foodtracker/`;

const existingServer = await fetch(BASE).then(() => true).catch(() => false);
let server = null;
if (!existingServer) {
  server = spawn('npx', ['vite', '--port', PORT], { cwd: REPO_ROOT, stdio: 'ignore' });
  await waitForServer(BASE);
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
  await page.goto(BASE, { waitUntil: 'networkidle' });
  if (vp.fontSize && vp.fontSize !== '16px') {
    await page.evaluate((s) => { document.documentElement.style.fontSize = s; }, vp.fontSize);
    await page.waitForTimeout(200);
  }

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
