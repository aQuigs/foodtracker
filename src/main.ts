/// <reference types="vite/client" />
import './styles.css';
import { createApp } from './app.js';
import { LocalStorageRepository } from './persistence/localStorage.js';
import { IndexedDbFoodSourceRepository } from './persistence/indexedDbFoodSource.js';
import { HttpFoodSourceProvider } from './persistence/httpFoodSourceProvider.js';

const container = document.getElementById('app');
if (!(container instanceof HTMLElement)) {
  throw new Error('#app container missing');
}

const dataBase = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data`;

createApp({
  container,
  repo: new LocalStorageRepository(),
  catalog: new IndexedDbFoodSourceRepository(),
  catalogProviders: [
    new HttpFoodSourceProvider({
      name: 'usda',
      baseUrl: dataBase,
      tagPrefix: 'usda-v',
    }),
  ],
  catalogVersions: { usda: '2' },
});
