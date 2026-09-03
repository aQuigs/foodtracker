/// <reference types="vite/client" />
import './styles.css';
import { createApp } from './app.js';
import { LocalStorageRepository } from './persistence/localStorage.js';
import { IndexedDbFoodSourceRepository } from './persistence/indexedDbFoodSource.js';
import { HttpFoodSourceProvider } from './persistence/httpFoodSourceProvider.js';
import { CATALOG_VERSIONS, FOOD_SOURCES } from './domain/foodSources.js';

const container = document.getElementById('app');
if (!(container instanceof HTMLElement)) {
  throw new Error('#app container missing');
}

const dataBase = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data`;

createApp({
  container,
  repo: new LocalStorageRepository(),
  catalog: new IndexedDbFoodSourceRepository(),
  catalogProviders: Object.values(FOOD_SOURCES).map((name) => new HttpFoodSourceProvider({ name, baseUrl: dataBase })),
  catalogVersions: CATALOG_VERSIONS,
});
