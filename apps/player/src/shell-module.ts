import { defineAction, defineModule, type EngineModule } from '@ie/core';
import { LOCALES } from '@ie/i18n';
import { TEXT_SPEEDS } from '@ie/present';
import { THEME_PREFERENCES } from '@ie/ui-kit';
import { z } from 'zod';
import {
  CONTRASTS,
  FIGHT_ASSISTS,
  LETTERS,
  MOTIONS,
  SPACINGS,
  TEXT_SIZES,
  VOLUME_BUSES,
  type PlayerSettings,
} from './settings.ts';

export const PANELS = ['settings', 'diagnostics', 'history', 'saves', 'sheet', 'credits'] as const;
export type Panel = (typeof PANELS)[number];

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
          id: 'ui.textSpeed.set',
          description: 'How fast lines are typed in.',
          params: z.object({ speed: z.enum(TEXT_SPEEDS) }),
          run: ({ speed }) => update({ textSpeed: speed }),
        }),
      );
      actions.register(
        defineAction({
          id: 'ui.timers.set',
          description: 'Turn time limits on choices on or off.',
          params: z.object({ enabled: z.boolean() }),
          run: ({ enabled }) => update({ timers: enabled }),
        }),
      );
      actions.register(
        defineAction({
          id: 'ui.storyLook.set',
          description: "Use the story's own theme, or the reader's Paper or Night.",
          params: z.object({ enabled: z.boolean() }),
          run: ({ enabled }) => update({ storyLook: enabled }),
        }),
      );
      actions.register(
        defineAction({
          id: 'ui.fightAssist.set',
          description: 'Choose how much help rhythm fights give.',
          params: z.object({ assist: z.enum(FIGHT_ASSISTS) }),
          run: ({ assist }) => update({ fightAssist: assist }),
        }),
      );
      actions.register(
        defineAction({
          id: 'ui.haptics.set',
          description: 'Turn vibration in fights on or off.',
          params: z.object({ enabled: z.boolean() }),
          run: ({ enabled }) => update({ haptics: enabled }),
        }),
      );
      actions.register(
        defineAction({
          id: 'ui.access.set',
          description: 'Change motion, contrast, line spacing or letters.',
          params: z.object({
            motion: z.enum(MOTIONS).optional(),
            contrast: z.enum(CONTRASTS).optional(),
            spacing: z.enum(SPACINGS).optional(),
            letters: z.enum(LETTERS).optional(),
          }),
          run: (patch) =>
            update(Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))),
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
          id: 'ui.volume.set',
          description: 'Remember a volume (master, music, ambience, effects or voices).',
          params: z.object({ bus: z.enum(VOLUME_BUSES), volume: z.number().min(0).max(1) }),
          run: ({ bus, volume }) =>
            update({ volumes: { ...host.getSettings().volumes, [bus]: volume } }),
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
          params: z.object({ panel: z.enum(PANELS) }),
          run: ({ panel }) => host.openPanel(panel),
        }),
      );
    },
  });
}
