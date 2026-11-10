import { Kernel, defineAction, defineModule } from '@ie/core';
import { LOCALES } from '@ie/i18n';
import { z } from 'zod';
import { useProject } from './project/store.ts';
import { useStudio } from './store.ts';
import { VIEW_IDS } from './views.ts';

/**
 * The Studio's kernel. Commands in the palette, menus and (later) editors run through its action
 * bus, so every Studio operation is validated, logged, and scriptable.
 */
export const kernel = new Kernel();

kernel.use(
  defineModule({
    id: 'studio.shell',
    install({ actions }) {
      const store = useStudio.getState;
      actions.register(
        defineAction({
          id: 'studio.view.open',
          description: 'Open a workspace.',
          params: z.object({ view: z.enum(VIEW_IDS) }),
          run: ({ view }) => store().setView(view),
        }),
      );
      actions.register(
        defineAction({
          id: 'ui.locale.set',
          params: z.object({ locale: z.enum(LOCALES) }),
          run: ({ locale }) => store().setLocale(locale),
        }),
      );
      actions.register(
        defineAction({
          id: 'ui.theme.set',
          params: z.object({ theme: z.enum(['system', 'paper', 'night']) }),
          run: ({ theme }) => store().setTheme(theme),
        }),
      );
      actions.register(
        defineAction({
          id: 'project.undo',
          description: 'Undo the last change to the novel.',
          params: z.object({}),
          run: () => useProject.getState().undo(),
        }),
      );
      actions.register(
        defineAction({
          id: 'project.redo',
          description: 'Redo the change that was undone.',
          params: z.object({}),
          run: () => useProject.getState().redo(),
        }),
      );
      actions.register(
        defineAction({
          id: 'ui.hud.set',
          params: z.object({ visible: z.boolean() }),
          run: ({ visible }) => store().setHud(visible),
        }),
      );
    },
  }),
);

/** Fire-and-forget helper for UI event handlers. */
export function runAction(id: string, params: unknown = {}): void {
  kernel.actions.run(id, params, { source: 'studio.ui' }).catch((error: unknown) => {
    console.error(error);
  });
}
