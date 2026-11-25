import { defineModuleSchema } from '@kn/core';

export type WhisperAccent = 'cyan' | 'silver' | 'amber';
export type RevealMode = 'hold-or-tilt' | 'hold-only';

export interface GhostWhisperProps {
  surfaceLine: string;
  ghostLine: string;
  accent: WhisperAccent;
  revealMode: RevealMode;
  /** Degrees of device tilt (from the resting pose) that pull the ghost line into focus. */
  tiltThresholdDeg: number;
  audioCue: boolean;
}

export const schema = defineModuleSchema<GhostWhisperProps>({
  meta: {
    id: 'gits-ghost-whisper',
    version: 1,
    name: 'Ghost Whisper',
    genre: 'gits',
    icon: '👻',
    layer: 'inline',
    description: 'A calm line with a faint ghost line behind it, revealed by holding or tilting.',
  },
  fields: [
    { key: 'surfaceLine', label: 'Surface line', type: 'multiline', maxLength: 200 },
    { key: 'ghostLine', label: 'Ghost line', type: 'multiline', maxLength: 200 },
    {
      key: 'accent',
      label: 'Accent',
      type: 'select',
      options: [
        { value: 'cyan', label: 'Cyan' },
        { value: 'silver', label: 'Silver' },
        { value: 'amber', label: 'Amber' },
      ],
    },
    {
      key: 'revealMode',
      label: 'Reveal by',
      type: 'select',
      options: [
        { value: 'hold-or-tilt', label: 'Hold or tilt' },
        { value: 'hold-only', label: 'Hold only' },
      ],
    },
    {
      key: 'tiltThresholdDeg',
      label: 'Tilt needed',
      type: 'number',
      min: 10,
      max: 40,
      step: 1,
      unit: '°',
      showWhen: { field: 'revealMode', equals: 'hold-or-tilt' },
    },
    { key: 'audioCue', label: 'Whisper sound', type: 'toggle' },
  ],
  defaults: {
    surfaceLine: 'Routine telemetry check. All ports nominal.',
    ghostLine: 'Someone is riding behind your optic nerve.',
    accent: 'cyan',
    revealMode: 'hold-or-tilt',
    tiltThresholdDeg: 18,
    audioCue: true,
  },
  refine: (p) => {
    const errors: string[] = [];
    if (p.surfaceLine.trim() === '') errors.push('surfaceLine: write the visible line');
    if (p.ghostLine.trim() === '') errors.push('ghostLine: write the hidden line');
    return errors;
  },
});

export const meta = schema.meta;
