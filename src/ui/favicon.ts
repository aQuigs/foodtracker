import { NUTRIENTS } from '../domain/types.js';
import type { MacroShare, NutritionFacts } from '../domain/types.js';
import { DONUT_VIEWBOX, donutSlices } from './donut.js';

export type Favicon = { render(shares: MacroShare[]): void };

type ColorOf = (key: keyof NutritionFacts) => string;

// A data URL is its own document and cannot see the page's custom properties,
// so a `var(--x)` reference is resolved against the live stylesheet. Empty
// until that stylesheet has loaded.
function themeColor(reference: string): string {
  const name = /^var\((--[\w-]+)\)$/.exec(reference)?.[1];
  if (!name) {
    return reference;
  }

  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function sliceColor(key: keyof NutritionFacts): string {
  return themeColor(NUTRIENTS[key].sliceColor);
}

// Repaints the tab icon as a donut of the given shares. With nothing to draw,
// or before the stylesheet has supplied the colours, the link shows the static
// icon it started with. Colours are kept once resolved: reading computed style
// forces a layout pass, and the palette does not change at runtime.
export function createFavicon(link: HTMLLinkElement, colorOf: ColorOf = sliceColor): Favicon {
  const fallback = link.href;
  const colors = new Map<keyof NutritionFacts, string>();

  function color(key: keyof NutritionFacts): string {
    const resolved = colors.get(key) ?? colorOf(key);
    if (resolved) {
      colors.set(key, resolved);
    }

    return resolved;
  }

  return {
    render(shares) {
      const paths = donutSlices(shares)
        .filter((s) => s.d !== '')
        .map((s) => ({ d: s.d, fill: color(s.key) }));
      const drawable = paths.length > 0 && paths.every((p) => p.fill !== '');
      const href = drawable
        ? `data:image/svg+xml,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${DONUT_VIEWBOX}">${paths.map((p) => `<path fill="${p.fill}" d="${p.d}"/>`).join('')}</svg>`,
        )}`
        : fallback;

      if (link.href !== href) {
        link.href = href;
      }
    },
  };
}
