import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import type { Plugin, ResolvedConfig } from 'vite';
import { shellManifest } from './shellManifest.js';
import type { ShellFile } from './shellManifest.js';

const ENCODER = new TextEncoder();

// Emits sw.js beside index.html: src/sw/sw.ts bundled on its own, with the
// list and content hash of every shell file baked in as __SHELL__. The list
// is read once the app bundle is written: index.html only joins the bundle
// in Vite's own last generate step, after any plugin's.
export function serviceWorker(): Plugin {
  let config: ResolvedConfig;

  return {
    name: 'foodtracker:service-worker',
    apply: 'build',

    configResolved(resolved) {
      config = resolved;
    },

    async writeBundle(_options, bundle) {
      const files: ShellFile[] = Object.values(bundle).map((output) => ({
        path: output.fileName,
        bytes: bytesOf(output.type === 'chunk' ? output.code : output.source),
      }));

      // Top-level public files are the icons and the web manifest. data/ is a
      // directory, so the catalog stays out; dotfiles are OS litter.
      if (config.publicDir) {
        for (const entry of readdirSync(config.publicDir, { withFileTypes: true })) {
          if (entry.isFile() && !entry.name.startsWith('.')) {
            files.push({ path: entry.name, bytes: readFileSync(join(config.publicDir, entry.name)) });
          }
        }
      }

      const shell = await shellManifest(config.base, files);

      await build({
        configFile: false,
        root: config.root,
        base: config.base,
        publicDir: false,
        logLevel: 'warn',
        define: { __SHELL__: JSON.stringify(shell) },
        build: {
          outDir: config.build.outDir,
          emptyOutDir: false,
          sourcemap: config.build.sourcemap,
          lib: { entry: resolve(config.root, 'src/sw/sw.ts'), formats: ['es'], fileName: () => 'sw.js' },
        },
      });
    },
  };
}

function bytesOf(source: string | Uint8Array): Uint8Array {
  return typeof source === 'string' ? ENCODER.encode(source) : source;
}
