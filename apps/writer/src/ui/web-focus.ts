// Web only: text inputs draw their own Folio focus cue (accent ring on fields, left rail on prose),
// so the browser's default focus outline (a box around the active paragraph) is removed for them.
// Buttons keep the browser's keyboard focus ring.
import { Platform } from 'react-native';

export function installWebFocusReset(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('folio-focus-reset')) return;
  const el = document.createElement('style');
  el.id = 'folio-focus-reset';
  el.textContent = 'input:focus,textarea:focus{outline:none}';
  document.head.appendChild(el);
}
