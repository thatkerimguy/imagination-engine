// `@kn/engines/blueprints`: the 14 starter v2 blueprints plus the legacy-cue resolver that maps
// pre-v2 chapter cues (moduleId + v1 props) onto v2 blueprints so existing chapters keep working.
import type { BlueprintProps, BlueprintRecord, GimmickBlueprint } from '@kn/core/gimmicks';
import { BATCH_A } from './batch-a.ts';
import { BATCH_B } from './batch-b.ts';

export const STARTER_BLUEPRINTS_V2: ReadonlyMap<string, GimmickBlueprint> = new Map(
  [...BATCH_A, ...BATCH_B].map((b) => [b.id, b]),
);

export const starterBlueprint = (id: string): GimmickBlueprint | null =>
  STARTER_BLUEPRINTS_V2.get(id) ?? null;

type Raw = Record<string, unknown>;
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const strs = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

export interface LegacyCue {
  blueprintId: string;
  map(props: Raw): BlueprintProps;
}

const SYSTEM_BADGES: Record<string, [string, string]> = {
  'level-up': ['LEVEL UP', 'primary'],
  quest: ['QUEST', 'secondary'],
  skill: ['SKILL', 'success'],
  warning: ['WARNING', 'warning'],
};

/** v1 moduleId → v2 blueprint + prop mapping (the 4 v1 cues retired in OVERHAUL-03). */
export const LEGACY_CUES: Readonly<Record<string, LegacyCue>> = {
  'gits-cyberbrain-chat': {
    blueprintId: 'cyberbrain-link',
    map: (p) => {
      const sender = str(p.senderId, 'KESTREL-9');
      const side = p.side === 'left' ? 'left' : 'right';
      const messages: BlueprintRecord[] = strs(p.messages).map((text) => ({ sender, text, side }));
      return {
        channel: sender,
        encryption: str(p.encryption, 'AES-Q').toLowerCase(),
        messages,
        lineDelay: typeof p.lineDelay === 'number' ? p.lineDelay : 1.2,
        sound: p.chime !== false,
      };
    },
  },
  'pt-gaslight-edit': {
    blueprintId: 'gaslight-rewrite',
    map: (p) => ({
      mode: 'gaslight',
      initialText: str(p.initialText),
      alteredText: str(p.mutatedText),
      hint: '',
    }),
  },
  'gits-ghost-whisper': {
    blueprintId: 'gaslight-rewrite',
    map: (p) => ({
      mode: 'whisper',
      initialText: str(p.surfaceLine),
      alteredText: str(p.ghostLine),
      hint: 'Hold to listen',
    }),
  },
  'litrpg-system-box': {
    blueprintId: 'system-notification',
    map: (p) => {
      const [badge, accentRole] = SYSTEM_BADGES[str(p.variant)] ?? ['SYSTEM', 'primary'];
      return {
        header: str(p.header, '[SYSTEM NOTIFICATION]'),
        title: str(p.title),
        badge,
        lines: strs(p.lines),
        footer: '',
        accentRole,
        sound: p.sound !== false,
      };
    },
  },
};
