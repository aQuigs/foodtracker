/// <reference types="vite/client" />
import './styles.css';
import { createApp } from './app.js';
import { LocalStorageRepository } from './persistence/localStorage.js';
import { IndexedDbFoodSourceRepository } from './persistence/indexedDbFoodSource.js';
import { HttpFoodSourceProvider } from './persistence/httpFoodSourceProvider.js';
import { FOOD_SOURCES, catalogVersions } from './domain/foodSources.js';

const container = document.getElementById('app');
if (!(container instanceof HTMLElement)) {
  throw new Error('#app container missing');
}

const dataBase = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data`;

// Only a production build emits sw.js; in dev a worker would shadow Vite's
// module server and hot reloads. Registration can be refused (site data
// blocked, a preview whose directory was removed); the app runs the same
// without a worker.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
}

const iconLink = document.querySelector('link[rel="icon"][type="image/svg+xml"]');

createApp({
  container,
  favicon: iconLink instanceof HTMLLinkElement ? iconLink : undefined,
  repo: new LocalStorageRepository(),
  catalog: {
    repository: new IndexedDbFoodSourceRepository(),
    providers: Object.values(FOOD_SOURCES).map((name) => new HttpFoodSourceProvider({ name, baseUrl: dataBase })),
    versions: catalogVersions(),
  },
});
