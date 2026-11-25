// `?preview=1`: the writer's embedded live preview. Waits for a draft over postMessage (from a
// React Native WebView or a parent <iframe> host), validates it, and mounts the real reading view.
import { h } from '../dom.ts';
import { mountChapter } from '../views/reading.ts';
import type { Cleanup, ViewContext } from '../views/shared.ts';
import { dispatchLifecycle } from '../runtime/lifecycle.ts';
import {
  parseHostControl,
  parsePreviewLoad,
  type HostMessage,
  type PreviewLoad,
} from './protocol.ts';

interface NativeBridge {
  postMessage(data: string): void;
}

function postToHost(msg: HostMessage): void {
  const rn = (window as Window & { ReactNativeWebView?: NativeBridge }).ReactNativeWebView;
  if (rn) rn.postMessage(JSON.stringify(msg));
  else if (window.parent !== window) window.parent.postMessage(msg, '*');
}

export function startPreview(v: ViewContext): void {
  let cleanup: Cleanup | null = null;
  let audioUnlocked = false;
  v.setBar('Preview', null);
  document.documentElement.dataset.preview = '1';
  v.main.replaceChildren(h('p', { class: 'kn-empty' }, 'Waiting for the writer…'));

  let lastLoad: PreviewLoad | null = null;
  let lastBlockId: string | null = null;
  let reducedMotion = false;

  const mount = (load: PreviewLoad, startBlockId: string | null): void => {
    cleanup?.();
    cleanup = null;
    v.main.removeAttribute('style');
    scrollTo(0, 0);
    const { novel, season, chapter, tier } = load;
    v.setBar(chapter.title, null);
    cleanup = mountChapter(
      v,
      { novel, season, chapter },
      {
        startBlockId,
        tier,
        reducedMotion,
        footerLink: h('span', { class: 'kn-card-sub' }, 'End of draft preview'),
        preview: {
          curtain: !audioUnlocked,
          onAudioUnlocked: () => (audioUnlocked = true),
          onPosition(blockId) {
            lastBlockId = blockId;
            postToHost({ type: 'kn-preview-position', blockId });
          },
        },
      },
    );
    postToHost({ type: 'kn-preview-rendered', chapterId: chapter.id });
  };

  addEventListener('message', (event: MessageEvent<unknown>) => {
    const control = parseHostControl(event.data);
    if (control?.type === 'lifecycle') return dispatchLifecycle(control.state === 'active');
    if (control?.type === 'a11y') {
      const changed = control.reducedMotion !== reducedMotion;
      reducedMotion = control.reducedMotion;
      if (changed && lastLoad) mount(lastLoad, lastBlockId ?? lastLoad.startBlockId);
      return;
    }
    const parsed = parsePreviewLoad(event.data);
    if (!parsed) return;
    if (!parsed.ok) {
      cleanup?.();
      cleanup = null;
      lastLoad = null;
      v.main.removeAttribute('style');
      scrollTo(0, 0);
      console.warn('[reader] preview draft rejected', parsed.errors);
      v.main.replaceChildren(
        h('p', { class: 'kn-empty' }, 'This draft cannot be previewed yet:'),
        h('pre', { class: 'kn-preview-errors' }, parsed.errors.slice(0, 6).join('\n')),
      );
      postToHost({ type: 'kn-preview-error', errors: parsed.errors });
      return;
    }
    lastLoad = parsed.load;
    lastBlockId = null;
    mount(parsed.load, parsed.load.startBlockId);
  });

  postToHost({ type: 'kn-preview-ready' });
}
