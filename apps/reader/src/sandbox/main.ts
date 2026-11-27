// Gimmick Sandbox router:
//   ?blueprint=<id>&tier&dna&theme     one v2 blueprint with live controls, ×20 leak runs
//   ?sheet=batch1|dna&theme&tier&dna   contact sheets for batched visual QA
import '../styles.css';
import './sandbox.css';
import { applyPrefs } from '../prefs.ts';

applyPrefs();
const q = new URLSearchParams(location.search);
const theme = q.get('theme');
if (theme === 'light' || theme === 'dark') {
  document.documentElement.dataset.theme = theme === 'light' ? 'warm' : 'dark';
}
if (q.has('sheet')) void import('./sheet.ts');
else void import('./v2.ts');
