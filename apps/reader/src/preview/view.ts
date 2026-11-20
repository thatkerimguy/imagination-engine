// `?preview=1`: the writer's embedded live preview. Waits for a draft over postMessage (from a
// React Native WebView or a parent <iframe> host), validates it, and mounts the real reading view.
import { h } from '../dom.ts';
import { mountChapter } from '../views/reading.ts';
import type { Cleanup, ViewContext } from '../views/shared.ts';
import { parsePreviewLoad, type HostMessage } from './protocol.ts';

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

  addEventListener('message', (event: MessageEvent<unknown>) => {
    const parsed = parsePreviewLoad(event.data);
    if (!parsed) return;
    cleanup?.();
    cleanup = null;
    v.main.removeAttribute('style');
    scrollTo(0, 0);
    if (!parsed.ok) {
      console.warn('[reader] preview draft rejected', parsed.errors);
      v.main.replaceChildren(
        h('p', { class: 'kn-empty' }, 'This draft cannot be previewed yet:'),
        h('pre', { class: 'kn-preview-errors' }, parsed.errors.slice(0, 6).join('\n')),
      );
      postToHost({ type: 'kn-preview-error', errors: parsed.errors });
      return;
    }
    const { novel, season, chapter, startBlockId, tier } = parsed.load;
    v.setBar(chapter.title, null);
    cleanup = mountChapter(
      v,
      { novel, season, chapter },
      {
        startBlockId,
        tier,
        footerLink: h('span', { class: 'kn-card-sub' }, 'End of draft preview'),
        preview: { curtain: !audioUnlocked, onAudioUnlocked: () => (audioUnlocked = true) },
      },
    );
    postToHost({ type: 'kn-preview-rendered', chapterId: chapter.id });
  });

  postToHost({ type: 'kn-preview-ready' });
}
