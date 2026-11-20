import type { ModuleRenderer, RendererContext } from '@kn/core/renderer';
import type { AmbientBedProps } from './schema.ts';
import { fileBed, proceduralBeds } from './procedural.ts';

// The bed lives on the reader's audio bus, not in this renderer: it must keep playing after the
// block scrolls away, until another ambient-bed block crossfades or fades it out.
export default function createRenderer(): ModuleRenderer<AmbientBedProps> {
  let ctx: RendererContext<AmbientBedProps> | null = null;

  const apply = (props: AmbientBedProps): void => {
    if (!ctx) return;
    const { audio } = ctx;
    if (props.action === 'stop') {
      audio.stopAmbient(props.fadeSeconds);
      return;
    }
    const opts = { volume: props.volume, fadeSeconds: props.fadeSeconds };
    if (props.preset === 'custom') {
      audio.setAmbient(`file:${props.asset}`, fileBed(ctx.resolveAsset(props.asset)), opts);
    } else {
      audio.setAmbient(props.preset, proceduralBeds[props.preset], opts);
    }
  };

  return {
    mount(c) {
      ctx = c;
    },
    reducedMotionFallback(c) {
      // Sound is not motion: reduced tier keeps the ambience.
      ctx = c;
    },
    async trigger() {
      if (ctx) apply(ctx.props);
    },
    update(props) {
      apply(props);
    },
    dispose() {
      ctx = null;
    },
  };
}
