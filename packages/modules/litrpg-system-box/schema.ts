import { defineModuleSchema } from '@kn/core';

export type SystemVariant = 'level-up' | 'quest' | 'skill' | 'warning';

export interface SystemBoxProps {
  header: string;
  variant: SystemVariant;
  title: string;
  lines: string[];
  sound: boolean;
}

export const schema = defineModuleSchema<SystemBoxProps>({
  meta: {
    id: 'litrpg-system-box',
    version: 1,
    name: 'System Box',
    genre: 'core',
    icon: '📟',
    layer: 'inline',
    description:
      'A holographic LitRPG system notification window: level-ups, quests, skills, warnings.',
  },
  fields: [
    { key: 'header', label: 'Header', type: 'text', maxLength: 60 },
    {
      key: 'variant',
      label: 'Style',
      type: 'select',
      options: [
        { value: 'skill', label: 'Skill (royal blue)' },
        { value: 'level-up', label: 'Level up (gold)' },
        { value: 'quest', label: 'Quest (emerald)' },
        { value: 'warning', label: 'Warning (crimson)' },
      ],
    },
    { key: 'title', label: 'Title', type: 'text', maxLength: 80 },
    {
      key: 'lines',
      label: 'Lines',
      type: 'string-list',
      minItems: 1,
      maxItems: 8,
      itemLabel: 'Line',
    },
    { key: 'sound', label: 'Chime', type: 'toggle', help: 'A soft synthesized chime on reveal.' },
  ],
  defaults: {
    header: '[SYSTEM NOTIFICATION]',
    variant: 'level-up',
    title: 'Class Evolution Unlocked',
    lines: ['STR +3', 'Perception +2', 'New Skill: Iron Nerves (Lv. 1)'],
    sound: true,
  },
  refine: (p) => {
    const errors: string[] = [];
    if (p.title.trim() === '') errors.push('title: write a title');
    if (p.lines.some((l) => l.trim() === '')) errors.push('lines: remove blank lines');
    return errors;
  },
});

export const meta = schema.meta;
