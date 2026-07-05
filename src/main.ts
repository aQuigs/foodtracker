/// <reference types="vite/client" />
import './styles.css';
import { createApp } from './app.js';
import { LocalStorageRepository } from './persistence/localStorage.js';
import { IndexedDbFoodSourceRepository } from './persistence/indexedDbFoodSource.js';
import { HttpFoodSourceProvider } from './persistence/httpFoodSourceProvider.js';
import { FOOD_SOURCES } from './domain/foodSources.js';

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
      name: FOOD_SOURCES.USDA,
      baseUrl: dataBase,
      tagPrefix: `${FOOD_SOURCES.USDA}-v`,
    }),
    new HttpFoodSourceProvider({
      name: FOOD_SOURCES.USDA_FULL,
      baseUrl: dataBase,
      tagPrefix: `${FOOD_SOURCES.USDA_FULL}-v`,
    }),
  ],
  catalogVersions: { [FOOD_SOURCES.USDA]: '5', [FOOD_SOURCES.USDA_FULL]: '1' },
});
