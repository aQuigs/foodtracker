import './styles.css';
import { createApp } from './app.js';
import { LocalStorageRepository } from './persistence/localStorage.js';

const container = document.getElementById('app');
if (!(container instanceof HTMLElement)) {
  throw new Error('#app container missing');
}

container.replaceChildren();
createApp({ container, repo: new LocalStorageRepository() });
