import { expect } from '@esm-bundle/chai';
import { createApp } from '../src/app.js';
import { MACRO_KEYS, NUTRIENTS } from '../src/domain/types.js';
import { fixedClock, makeContainer, seededRepo } from './_helpers.js';

// The test server serves the repo root, so what Vite serves from "/" lives
// under "/public" here.
const PUBLIC_DIR = '/public';

type Manifest = {
  name: string;
  theme_color: string;
  background_color: string;
  icons: { src: string; sizes: string }[];
};

async function fetchOk(path: string): Promise<Response> {
  const res = await fetch(path);
  expect(res.ok, `${path} responded ${res.status}`).to.equal(true);
  return res;
}

// Resolves href the way the browser would on the deployed site, then maps the
// result onto the test server.
function served(href: string, from = '/index.html'): string {
  return PUBLIC_DIR + new URL(href, location.origin + from).pathname;
}

function attr(doc: Document, selector: string, name: string): string {
  const value = doc.querySelector(selector)?.getAttribute(name) ?? '';
  expect(value, `${selector} [${name}]`).to.not.equal('');
  return value;
}

// Accepts either "--name" or "var(--name)".
function cssValue(css: string, reference: string): string {
  const name = reference.replace(/^var\((.*)\)$/, '$1');
  const value = new RegExp(`(?<![\\w-])${name}:\\s*(#[0-9a-f]+)`, 'i').exec(css)?.[1] ?? '';
  expect(value, `${name} in styles.css`).to.not.equal('');
  return value;
}

async function imageSize(path: string): Promise<string> {
  const img = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`${path} did not decode as an image`));
  });
  img.src = path;
  await loaded;

  return `${img.naturalWidth}x${img.naturalHeight}`;
}

describe('index.html head', () => {
  let doc: Document;
  let css: string;

  before(async () => {
    const html = await (await fetchOk('/index.html')).text();
    doc = new DOMParser().parseFromString(html, 'text/html');
    css = await (await fetchOk('/src/styles.css')).text();
  });

  it('titles the window with the same name the header shows', () => {
    const container = makeContainer();
    createApp({ container, repo: seededRepo(), clock: fixedClock() });
    const heading = container.querySelector('h1')?.textContent;
    container.remove();

    expect(doc.title).to.equal(heading);
  });

  it('describes the page and paints the browser chrome in the app background', () => {
    attr(doc, 'meta[name="description"]', 'content');
    expect(attr(doc, 'meta[name="color-scheme"]', 'content')).to.equal('dark');
    expect(attr(doc, 'meta[name="theme-color"]', 'content')).to.equal(cssValue(css, '--bg'));
  });

  it('links an SVG favicon, a raster fallback, and a touch icon that resolve at the sizes they declare', async () => {
    const links = ['link[rel="icon"][type="image/svg+xml"]', 'link[rel="icon"][type="image/png"]', 'link[rel="apple-touch-icon"]'];

    for (const selector of links) {
      const path = served(attr(doc, selector, 'href'));
      await fetchOk(path);

      const sizes = doc.querySelector(selector)?.getAttribute('sizes');
      if (sizes) {
        expect(await imageSize(path), selector).to.equal(sizes);
      }
    }
  });

  it('draws the favicon in the macro chart colours', async () => {
    const svg = await (await fetchOk(served(attr(doc, 'link[rel="icon"][type="image/svg+xml"]', 'href')))).text();
    const fills = [...svg.matchAll(/fill="(#[0-9a-f]+)"/gi)].map((m) => m[1]);

    expect(fills).to.have.members(MACRO_KEYS.map((k) => cssValue(css, NUTRIENTS[k].sliceColor)));
  });

  it('links a manifest that agrees with the head and whose icons are the size they claim', async () => {
    const href = attr(doc, 'link[rel="manifest"]', 'href');
    const manifest = (await (await fetchOk(served(href))).json()) as Manifest;
    const themeColor = attr(doc, 'meta[name="theme-color"]', 'content');

    expect(manifest.name).to.equal(doc.title);
    expect(manifest.theme_color).to.equal(themeColor);
    expect(manifest.background_color).to.equal(themeColor);
    expect(manifest.icons.length).to.be.at.least(1);

    for (const icon of manifest.icons) {
      expect(await imageSize(served(icon.src, href)), icon.src).to.equal(icon.sizes);
    }
  });
});
