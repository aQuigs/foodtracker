import './styles.css';
import { createApp } from './app.js';
import { LocalStorageRepository } from './persistence/localStorage.js';

const container = document.getElementById('app');
if (!container) {
  throw new Error('#app container not found');
}

createApp({ container, repo: new LocalStorageRepository() });
