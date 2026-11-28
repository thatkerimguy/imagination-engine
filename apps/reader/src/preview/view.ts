// `?preview=1`: the writer's embedded live preview. Waits for a draft over postMessage (from a
// React Native WebView or a parent <iframe> host), validates it, and mounts the real reading view.
import { h } from '../dom.ts';
import { mountChapter } from '../views/reading.ts';
import type { Cleanup, ViewContext } from '../views/shared.ts';
import { dispatchLifecycle } from '../runtime/lifecycle.ts';
import { dispatchTierChange } from '../runtime/tier-bus.ts';
import { deviceHints, resolveTier } from '../tier.ts';
import {
  parseHostControl,
  parsePreviewLoad,
  type HostMessage,
  type PreviewLoad,
} from './protocol.ts';

interface NativeBridge {
  postMessage(data: string): void;
}

type BridgeWindow = Window & {
  ReactNativeWebView?: NativeBridge;
  /** Android KnReaderWebView (WebViewAssetLoader transport, OVERHAUL-03). */
  KnHostBridge?: NativeBridge;
  __knReceive?: (json: string) => void;
};

function postToHost(msg: HostMessage): void {
  const w = window as BridgeWindow;
  const rn = w.KnHostBridge ?? w.ReactNativeWebView;
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
  let calm = false;

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
        reducedMotion: reducedMotion || calm,
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

  // KnReaderWebView delivers host messages by evaluateJavascript → the normal message path.
  (window as BridgeWindow).__knReceive = (json) =>
    window.dispatchEvent(new MessageEvent('message', { data: json }));
  addEventListener('message', (event: MessageEvent<unknown>) => {
    const control = parseHostControl(event.data);
    if (control?.type === 'lifecycle') return dispatchLifecycle(control.state === 'active');
    if (control?.type === 'record') return setRecordMode(control.on);
    if (control?.type === 'tier') {
      // Live: v2 engines downgrade / upgrade in place; the next remount keeps the choice.
      calm = control.calmMode;
      if (lastLoad) lastLoad = { ...lastLoad, tier: control.tier };
      const still = reducedMotion || calm;
      return dispatchTierChange(resolveTier(control.tier, deviceHints(still)), still);
    }
    if (control?.type === 'dna') {
      // Live: dna-apply re-resolves the root and broadcasts kn:dna-change to mounted engines.
      const raw = control.dna;
      if (lastLoad) lastLoad = { ...lastLoad, novel: { ...lastLoad.novel, visualDna: raw } };
      void import('../dna-apply.ts').then((d) => d.attachDna(v.main, d.bookDna(raw)));
      return;
    }
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

const RECORD_CSS =
  'html[data-record] .kn-bar{display:none}html[data-record]{scrollbar-width:none}' +
  'html[data-record]::-webkit-scrollbar{display:none}';

/** 9:16 Record Mode (writer `record=9x16`): no top bar, no scrollbar, just the chapter. */
function setRecordMode(on: boolean): void {
  const root = document.documentElement;
  if (!on) {
    delete root.dataset.record;
    return;
  }
  root.dataset.record = '9x16';
  if (!document.getElementById('kn-record-css')) {
    document.head.append(h('style', { id: 'kn-record-css' }, RECORD_CSS));
  }
}
