import '@ie/ui-kit/fonts.css';
import '@ie/ui-kit/tokens.css';
import '@ie/ui-kit/primitives.css';
import '@ie/diagnostics/diagnostics.css';
import './styles.css';
import { requestPersistentStorage } from '@ie/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { kernel } from './kernel.ts';
import { registerServiceWorker } from './pwa.ts';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element.');

await kernel.start();
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
registerServiceWorker();
void requestPersistentStorage();
