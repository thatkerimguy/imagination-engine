// Starter v2 blueprints, batch A: frame-hud, chat-thread, text-alchemy, artifact-doc (2 each).
import type { GimmickBlueprint } from '@kn/core/gimmicks';
import { ARTIFACT_DOC_BLUEPRINTS } from '../artifact-doc/blueprints.ts';
import { CHAT_THREAD_BLUEPRINTS } from '../chat-thread/blueprints.ts';
import { FRAME_HUD_BLUEPRINTS } from '../frame-hud/blueprints.ts';
import { TEXT_ALCHEMY_BLUEPRINTS } from '../text-alchemy/blueprints.ts';

export const BATCH_A: GimmickBlueprint[] = [
  ...FRAME_HUD_BLUEPRINTS,
  ...CHAT_THREAD_BLUEPRINTS,
  ...TEXT_ALCHEMY_BLUEPRINTS,
  ...ARTIFACT_DOC_BLUEPRINTS,
];
