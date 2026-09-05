import { expect } from '@esm-bundle/chai';
import { catalogVersions, datasetDir } from '../../src/domain/foodSources.js';
import { isFoodSourceManifest, isSourcedFood } from '../../src/domain/validate.js';
import { sha256Hex } from '../_helpers.js';

// The build script runs locally, not in CI, so this is the only check that the
// committed manifest still describes the committed foods.json. A drift here
// would fail hydration for every fresh user.
describe('committed datasets under public/data/', () => {
  for (const [source, version] of Object.entries(catalogVersions())) {
    const dir = `/public/data/${datasetDir(source, version)}`;

    it(`${dir}: manifest matches foods.json and every item is a valid ${source} food`, async () => {
      const manifestRes = await fetch(`${dir}/manifest.json`);
      expect(manifestRes.ok, `${dir}/manifest.json is served`).to.equal(true);

      const manifest: unknown = await manifestRes.json();
      if (!isFoodSourceManifest(manifest)) {
        throw new Error(`${dir}/manifest.json is not a valid manifest`);
      }

      expect(manifest.source).to.equal(source);
      expect(manifest.version).to.equal(version);

      const foodsRes = await fetch(`${dir}/foods.json`);
      expect(foodsRes.ok, `${dir}/foods.json is served`).to.equal(true);

      const body = await foodsRes.arrayBuffer();
      expect(await sha256Hex(body)).to.equal(manifest.sha256);

      const items: unknown = JSON.parse(new TextDecoder().decode(body));
      if (!Array.isArray(items)) {
        throw new Error(`${dir}/foods.json is not an array`);
      }

      expect(items.length).to.equal(manifest.itemCount);

      const invalid = items.filter((it: unknown) => !isSourcedFood(it) || it.source !== source);
      expect(invalid.length, 'items failing validation').to.equal(0);
    });
  }
});
