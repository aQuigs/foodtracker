#!/usr/bin/env node
// Capture screenshots of every page (log, foods, catalog, the source picker, a brand fold, and trends at
// two ranges) across viewports from desktop down to a phone, at the default text size and at enlarged text.
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
    name: 'trends',
    seeded: true,
    setup: async (page) => {
      await page.click('[data-testid="view-toggle-trends"]');
      await page.click(`[data-testid="trend-hit"][data-start="${isoDaysAgo(2)}"]`);
      await page.waitForTimeout(150);
    },
  },
  {
    name: 'trends-quarter',
    seeded: true,
    setup: async (page) => {
      await page.click('[data-testid="view-toggle-trends"]');
      await page.click('[data-testid="trend-range-group"] [data-value="quarter"]');
      await page.waitForTimeout(150);
    },
  },
];

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString('sv-SE');
}

// Six weeks of varied meals with every fifth day skipped, so pages flagged
// `seeded` show stacks and gaps rather than the empty state.
function seededState() {
  const at = '2026-01-01T00:00:00.000Z';
  const foods = [
    { id: 'shot-oats',    name: 'Oats',           nutritionFacts: { calories: 379, protein: 13.2, carbs: 67.7, fat: 6.5 }, servingSize: 100, servingUnit: 'g' },
    { id: 'shot-chicken', name: 'Chicken breast', nutritionFacts: { calories: 165, protein: 31,   carbs: 0,    fat: 3.6 }, servingSize: 100, servingUnit: 'g' },
    { id: 'shot-rice',    name: 'White rice',     nutritionFacts: { calories: 130, protein: 2.7,  carbs: 28,   fat: 0.3 }, servingSize: 100, servingUnit: 'g' },
    { id: 'shot-oil',     name: 'Olive oil',      nutritionFacts: { calories: 884, protein: 0,    carbs: 0,    fat: 100 }, servingSize: 100, servingUnit: 'g' },
    { id: 'shot-yogurt',  name: 'Greek yogurt',   nutritionFacts: { calories: 59,  protein: 10,   carbs: 3.6,  fat: 0.4 }, servingSize: 100, servingUnit: 'g' },
  ].map((f) => ({ ...f, createdAt: at, deletedAt: null }));

  const meals = [];
  const entries = [];
  for (let back = 0; back < 45; back++) {
    if (back % 5 === 3) continue;
    const date = isoDaysAgo(back);
    const mealId = `shot-meal-${date}`;
    meals.push({ id: mealId, date, position: 0 });
    foods.forEach((food, i) => {
      const amount = food.id === 'shot-oil' ? 8 + ((back * 7 + i) % 12) : 90 + ((back * 37 + i * 53) % 160);
      entries.push({ id: `shot-${date}-${i}`, date, foodId: food.id, amount, unit: 'g', mealId, loggedAt: `${date}T12:00:00.000Z` });
    });
  }

  return { version: 2, enabledSources: ['usda', 'usda-full'], foods, meals, entries };
}

// A fresh load at the viewport's text size, which does not survive navigation.
async function open(page, vp) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  if (vp.fontSize && vp.fontSize !== '16px') {
    await page.evaluate((s) => { document.documentElement.style.fontSize = s; }, vp.fontSize);
    await page.waitForTimeout(200);
  }
}

const VIEWPORTS = [
  { name: 'desktop',      width: 1280, height: 900,  fontSize: '16px' },
  { name: 'desktop-zoom', width: 1280, height: 2400, fontSize: '48px' },
  { name: 'mid',          width: 700,  height: 900,  fontSize: '16px' },
  { name: 'narrow',       width: 480,  height: 900,  fontSize: '16px' },
  { name: 'phone',        width: 375,  height: 800,  fontSize: '16px' },
  { name: 'phone-zoom',   width: 375,  height: 1600, fontSize: '32px' },
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
  await open(page, vp);

  let seeded = false;
  for (const p of PAGES) {
    if ((p.seeded ?? false) !== seeded) {
      seeded = p.seeded ?? false;
      await page.evaluate((state) => {
        if (state === null) {
          localStorage.removeItem('foodtracker');
        } else {
          localStorage.setItem('foodtracker', JSON.stringify(state));
        }
      }, seeded ? seededState() : null);
      await open(page, vp);
    }

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
