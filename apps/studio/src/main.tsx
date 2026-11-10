import '@ie/ui-kit/fonts.css';
import '@ie/ui-kit/tokens.css';
import '@ie/ui-kit/primitives.css';
import '@ie/diagnostics/diagnostics.css';
import '@ie/present/present.css';
import './styles.css';
import './styles/controls.css';
import './styles/write.css';
import './styles/blocks.css';
import './styles/views.css';
import { requestPersistentStorage } from '@ie/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { kernel } from './kernel.ts';
import { messages, UNTITLED } from './messages.ts';
import { startProjects } from './project/store.ts';
import { useStudio } from './store.ts';
import { registerServiceWorker } from './pwa.ts';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element.');

await kernel.start();
await startProjects(UNTITLED, messages[useStudio.getState().locale]['passage.first']);
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
registerServiceWorker();
void requestPersistentStorage();
