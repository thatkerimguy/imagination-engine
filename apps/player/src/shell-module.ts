import { defineAction, defineModule, type EngineModule } from '@ie/core';
import { LOCALES } from '@ie/i18n';
import { THEME_PREFERENCES } from '@ie/ui-kit';
import { z } from 'zod';
import { TEXT_SIZES, type PlayerSettings } from './settings.ts';

export type Panel = 'settings' | 'diagnostics';

declare module '@ie/core' {
  interface EngineEvents {
    'settings.changed': PlayerSettings;
  }
}

export interface ShellHost {
  getSettings(): PlayerSettings;
  applySettings(next: PlayerSettings): void;
  openPanel(panel: Panel): void;
  setMenuOpen(open: boolean): void;
}

const themeSchema = z.enum(THEME_PREFERENCES as [string, ...string[]]);

/**
 * The reader shell's actions. Everything the UI does goes through the action bus, the same way
 * story blocks and rules will later.
 */
export function createShellModule(host: ShellHost): EngineModule {
  return defineModule({
    id: 'player.shell',
    install({ actions, events }) {
      const update = (patch: Partial<PlayerSettings>) => {
        const next = { ...host.getSettings(), ...patch };
        host.applySettings(next);
        events.emit('settings.changed', next);
      };

      actions.register(
        defineAction({
          id: 'ui.locale.set',
          description: 'Switch the reading language.',
          params: z.object({ locale: z.enum(LOCALES) }),
          run: ({ locale }) => update({ locale }),
        }),
      );
      actions.register(
        defineAction({
          id: 'ui.theme.set',
          description: 'Switch between System, Paper and Night.',
          params: z.object({ theme: themeSchema }),
          run: ({ theme }) => update({ theme: theme as PlayerSettings['theme'] }),
        }),
      );
      actions.register(
        defineAction({
          id: 'ui.textSize.set',
          params: z.object({ size: z.enum(TEXT_SIZES) }),
          run: ({ size }) => update({ textSize: size }),
        }),
      );
      actions.register(
        defineAction({
          id: 'ui.hud.set',
          description: 'Show or hide the performance overlay.',
          params: z.object({ visible: z.boolean() }),
          run: ({ visible }) => update({ hud: visible }),
        }),
      );
      actions.register(
        defineAction({
          id: 'ui.menu.set',
          params: z.object({ open: z.boolean() }),
          run: ({ open }) => host.setMenuOpen(open),
        }),
      );
      actions.register(
        defineAction({
          id: 'ui.panel.open',
          params: z.object({ panel: z.enum(['settings', 'diagnostics']) }),
          run: ({ panel }) => host.openPanel(panel),
        }),
      );
    },
  });
}
