import {
  Activity,
  AudioLines,
  Database,
  Film,
  LibraryBig,
  Spline,
  Palette,
  PenLine,
  Rocket,
  Play,
  Settings,
  Sparkles,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { MessageKey } from './messages.ts';

export const VIEW_IDS = [
  'write',
  'flow',
  'logic',
  'sound',
  'stage',
  'sequencer',
  'materials',
  'design',
  'data',
  'library',
  'publish',
  'play',
  'settings',
  'diagnostics',
] as const;
export type ViewId = (typeof VIEW_IDS)[number];

export interface ViewInfo {
  readonly id: ViewId;
  readonly icon: LucideIcon;
  readonly label: MessageKey;
  /** Roadmap phase that fills this workspace (PLAN.md §13); absent for ready views. */
  readonly phase?: number;
  readonly description?: MessageKey;
}

export const VIEWS: Readonly<Record<ViewId, ViewInfo>> = {
  write: { id: 'write', icon: PenLine, label: 'view.write', description: 'desc.write' },
  flow: { id: 'flow', icon: Workflow, label: 'view.flow', description: 'desc.flow' },
  logic: { id: 'logic', icon: Zap, label: 'view.logic', description: 'desc.logic' },
  sound: { id: 'sound', icon: AudioLines, label: 'view.sound', description: 'desc.sound' },
  stage: { id: 'stage', icon: Sparkles, label: 'view.stage', description: 'desc.stage' },
  sequencer: {
    id: 'sequencer',
    icon: Film,
    label: 'view.sequencer',
    description: 'desc.sequencer',
  },
  materials: {
    id: 'materials',
    icon: Spline,
    label: 'view.materials',
    description: 'desc.materials',
  },
  design: { id: 'design', icon: Palette, label: 'view.design', description: 'desc.design' },
  data: { id: 'data', icon: Database, label: 'view.data', description: 'desc.data' },
  library: {
    id: 'library',
    icon: LibraryBig,
    label: 'view.library',
    description: 'desc.library',
  },
  publish: { id: 'publish', icon: Rocket, label: 'view.publish', description: 'desc.publish' },
  play: { id: 'play', icon: Play, label: 'view.play', description: 'desc.play' },
  settings: { id: 'settings', icon: Settings, label: 'view.settings' },
  diagnostics: { id: 'diagnostics', icon: Activity, label: 'view.diagnostics' },
};

/** Desktop rail: workspaces on top, utilities pinned to the bottom. */
export const RAIL_MAIN: readonly ViewId[] = [
  'write',
  'flow',
  'logic',
  'sound',
  'stage',
  'sequencer',
  'materials',
  'design',
  'data',
  'library',
  'publish',
  'play',
];
export const RAIL_BOTTOM: readonly ViewId[] = ['settings', 'diagnostics'];

/** Phone tab bar: the three most-used views; everything else lives under More. */
export const TABS: readonly ViewId[] = ['write', 'flow', 'play'];
export const MORE: readonly ViewId[] = [
  'logic',
  'sound',
  'stage',
  'sequencer',
  'materials',
  'design',
  'data',
  'library',
  'publish',
  'settings',
  'diagnostics',
];

export function isViewId(value: unknown): value is ViewId {
  return typeof value === 'string' && (VIEW_IDS as readonly string[]).includes(value);
}
