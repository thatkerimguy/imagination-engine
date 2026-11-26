// Web (mobile browsers, Playwright touch emulation): a soft keyboard is up while a text field has
// focus on a touch device. Feeds only the metrics-ribbon auto-collapse; docks are unaffected.
import { useEffect, useState } from 'react';

const editable = (el: Element | null): boolean =>
  !!el &&
  (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || (el as HTMLElement).isContentEditable);

export function useWebIme(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!(navigator.maxTouchPoints > 0)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = (): void => setOpen(editable(document.activeElement));
    // Focus moving between two fields fires focusout first: re-check after it settles.
    const later = (): void => {
      clearTimeout(timer);
      timer = setTimeout(sync, 0);
    };
    document.addEventListener('focusin', sync);
    document.addEventListener('focusout', later);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('focusin', sync);
      document.removeEventListener('focusout', later);
    };
  }, []);
  return open;
}
