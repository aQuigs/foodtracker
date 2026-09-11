import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import type { Plugin, ResolvedConfig } from 'vite';
import { shellManifest } from './shellManifest.js';
import type { ShellFile } from './shellManifest.js';
import type { ShellManifest } from '../src/sw/routing.js';

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
      assertBootable(shell, config);

      const result = await build({
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

      assertClassicScript(result);
      config.logger.info(`sw.js: ${shell.paths.length} shell files, hash ${shell.hash}`);
    },
  };
}

function bytesOf(source: string | Uint8Array): Uint8Array {
  return typeof source === 'string' ? ENCODER.encode(source) : source;
}

// A hook that ran before Vite emitted the document or the bundle would leave
// them out and every test would still pass; refuse to emit a worker that
// cannot boot the app. A path listed twice would make the install's addAll
// reject as one batch.
function assertBootable(shell: ShellManifest, config: ResolvedConfig): void {
  const missing: string[] = [];

  if (!shell.paths.includes(`${config.base}index.html`)) {
    missing.push('index.html');
  }

  if (!shell.paths.some((path) => path.startsWith(`${config.base}${config.build.assetsDir}/`) && path.endsWith('.js'))) {
    missing.push('the app bundle');
  }

  if (missing.length > 0) {
    throw new Error(`service worker shell is missing ${missing.join(' and ')}`);
  }

  if (new Set(shell.paths).size !== shell.paths.length) {
    throw new Error('service worker shell lists a path twice: a public/ file shares its name with a build output');
  }
}

// The worker registers as a classic script, which rejects a top-level
// import or export with a syntax error the page never sees.
function assertClassicScript(result: Awaited<ReturnType<typeof build>>): void {
  const outputs = Array.isArray(result) ? result : 'output' in result ? [result] : [];

  for (const { output } of outputs) {
    for (const chunk of output) {
      if (chunk.type === 'chunk' && (chunk.imports.length > 0 || chunk.dynamicImports.length > 0 || chunk.exports.length > 0)) {
        throw new Error(`${chunk.fileName} must be a single classic script but has imports or exports`);
      }
    }
  }
}
