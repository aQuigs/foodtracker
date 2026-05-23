import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/foodtracker/',
  build: { sourcemap: true },
});
