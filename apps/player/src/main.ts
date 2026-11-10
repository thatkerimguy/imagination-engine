import '@ie/ui-kit/fonts.css';
import '@ie/ui-kit/tokens.css';
import '@ie/ui-kit/primitives.css';
import '@ie/diagnostics/diagnostics.css';
import '@ie/present/present.css';
import '@ie/stage/stage.css';
import '@ie/rhythm/fight.css';
import './styles.css';
import { requestPersistentStorage } from '@ie/core';
import { startPlayer } from './app.ts';
import { registerServiceWorker } from './pwa.ts';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element.');

void startPlayer(root);
registerServiceWorker();
void requestPersistentStorage();
