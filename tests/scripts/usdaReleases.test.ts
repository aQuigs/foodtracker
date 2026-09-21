import { expect } from '@esm-bundle/chai';
import { latestReleases, parseReleases, releaseZipName, releaseZipUrl } from '../../scripts/usdaReleases.js';

function link(stem: string, date: string): string {
  return `<a href="/fdc-datasets/FoodData_Central_${stem}_food_json_${date}.zip">JSON</a>`;
}

const PAGE = [
  link('branded', '2025-12-18'),
  link('branded', '2026-04-30'),
  link('branded', '2024-10-31'),
  link('foundation', '2025-04-24'),
  link('foundation', '2025-12-18'),
  link('sr_legacy', '2018-04'),
  link('survey', '2026-10-31'),
  '<a href="/fdc-datasets/FoodData_Central_branded_food_csv_2027-01-01.zip">CSV</a>',
].join('\n');

describe('releaseZipName() / releaseZipUrl()', () => {
  it('names each kind\'s zip the way USDA does', () => {
    expect(releaseZipName('branded', '2026-04-30')).to.equal('FoodData_Central_branded_food_json_2026-04-30.zip');
    expect(releaseZipName('foundation', '2026-04-30')).to.equal('FoodData_Central_foundation_food_json_2026-04-30.zip');
    expect(releaseZipName('srLegacy', '2018-04')).to.equal('FoodData_Central_sr_legacy_food_json_2018-04.zip');
  });

  it('points at the zip under USDA\'s datasets directory', () => {
    expect(releaseZipUrl('srLegacy', '2018-04'))
      .to.equal('https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip');
  });
});

describe('latestReleases()', () => {
  it('picks the newest JSON release per kind, ignoring other formats and datasets', () => {
    expect(latestReleases(PAGE)).to.deep.equal({ branded: '2026-04-30', foundation: '2025-12-18', srLegacy: '2018-04' });
  });

  it('throws naming the kind when the page lists none of its releases', () => {
    const noFoundation = [link('branded', '2026-04-30'), link('sr_legacy', '2018-04')].join('');
    expect(() => latestReleases(noFoundation)).to.throw(/foundation/);
  });
});

describe('parseReleases()', () => {
  it('accepts one date per kind', () => {
    const pins = { branded: '2026-04-30', foundation: '2026-04-30', srLegacy: '2018-04' };
    expect(parseReleases(pins)).to.deep.equal(pins);
  });

  it('throws naming a kind that is missing or not a date', () => {
    expect(() => parseReleases({ branded: '2026-04-30', foundation: '2026-04-30' })).to.throw(/srLegacy/);
    expect(() => parseReleases({ branded: 'latest', foundation: '2026-04-30', srLegacy: '2018-04' })).to.throw(/branded/);
    expect(() => parseReleases(null)).to.throw();
  });
});
