import { defineConfig } from 'vite';
import { serviceWorker } from './scripts/serviceWorkerPlugin.js';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/foodtracker/',
  build: { sourcemap: true },
  plugins: [serviceWorker()],
});
