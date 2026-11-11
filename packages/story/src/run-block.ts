import { startBattle } from './battle.ts';
import { optionView, timerFor } from './choices.ts';
import { listKey } from './compile.ts';
import { parseDice } from './dice.ts';
import { truthy } from './formula.ts';
import { runItem, runQuest, runRoutine } from './rpg-run.ts';
import type { RuntimeCore } from './runtime-core.ts';
import { ENDINGS_KEY } from './runtime-options.ts';
import type { Block } from './schema.ts';
import { rememberScene, type OptionView } from './state.ts';
import { sequenceSceneChanges, type SequenceBlock } from './sequence.ts';
import { runExits } from './world-run.ts';

/** Runs one block. Returns true when a beat now waits for the reader. */
export function runBlock(core: RuntimeCore, block: Block): boolean {
  switch (block.type) {
    case 'narration':
    case 'dialogue':
      return core.wait({
        kind: 'line',
        blockId: block.id,
        values: core.snapshotValues(block.text),
      });
    case 'choice': {
      const views = block.options
        .map((o) => optionView(block, o.id, core.optionContext))
        .filter((v): v is OptionView => v !== null);
      if (views.length === 0) return false;
      const values = core.snapshotValues(block.prompt, ...block.options.map((o) => o.text));
      const timer = block.timer ? timerFor(block, views) : undefined;
      return core.wait(
        timer
          ? { kind: 'choice', blockId: block.id, options: views, timer, values }
          : { kind: 'choice', blockId: block.id, options: views, values },
      );
    }
    case 'if': {
      const branch = block.branches.find((b) => truthy(core.compute(b.when)));
      if (branch) core.push({ list: listKey.branch(branch.id), index: 0 });
      else if (block.else) core.push({ list: listKey.else(block.id), index: 0 });
      return false;
    }
    case 'check': {
      const dice = parseDice(block.dice);
      const rolls = Array.from({ length: dice.count }, () => core.randomInt(1, dice.sides));
      const modifier = block.modifier === undefined ? 0 : Number(core.compute(block.modifier)) || 0;
      const target = Number(core.compute(block.target)) || 0;
      const success = rolls.reduce((a, b) => a + b, 0) + modifier >= target;
      core.push({ list: success ? listKey.success(block.id) : listKey.fail(block.id), index: 0 });
      return core.wait({
        kind: 'check',
        blockId: block.id,
        rolls,
        modifier,
        target,
        success,
        values: core.snapshotValues(block.label),
      });
    }
    case 'input':
      return core.wait({ kind: 'input', blockId: block.id });
    case 'pause':
      return core.wait(
        block.seconds === undefined
          ? { kind: 'pause', blockId: block.id }
          : { kind: 'pause', blockId: block.id, seconds: block.seconds },
      );
    case 'set':
      core.applySet(
        block.var,
        block.op ?? 'set',
        block.value === undefined ? null : core.compute(block.value),
      );
      return false;
    case 'jump':
      while (core.s.frames.length && !core.s.frames.at(-1)?.call)
        core.s.frames = core.s.frames.slice(0, -1);
      core.enter(block.to);
      return false;
    case 'call':
      core.push({ list: '', index: 0, call: true });
      core.enter(block.to);
      return false;
    case 'return': {
      const boundary = core.s.frames.findLastIndex((f) => f.call);
      core.s.frames = boundary < 0 ? [] : core.s.frames.slice(0, boundary);
      return false;
    }
    case 'random': {
      const total = block.branches.reduce((sum, b) => sum + (b.weight ?? 1), 0);
      let roll = core.randomFloat() * total;
      const branch =
        block.branches.find((b) => (roll -= b.weight ?? 1) < 0) ?? block.branches.at(-1);
      if (branch) core.push({ list: listKey.branch(branch.id), index: 0 });
      return false;
    }
    case 'end':
      if (block.ending) {
        const reached = core.persistent[ENDINGS_KEY];
        const list = Array.isArray(reached) ? reached : [];
        if (!list.includes(block.ending.id))
          core.writePersistent(ENDINGS_KEY, [...list, block.ending.id]);
      }
      return core.finish(block);
    case 'fight':
      return core.wait({ kind: 'fight', blockId: block.id });
    case 'minigame':
      return core.wait({ kind: 'minigame', blockId: block.id });
    case 'sequence':
      return runSequence(core, block);
    case 'action':
      core.s.scene = rememberScene(core.s.scene, block.action, block.params ?? {});
      core.host.runAction?.(block.action, block.params ?? {});
      return false;
    case 'item':
      runItem(core, block);
      return false;
    case 'quest':
      runQuest(core, block);
      return false;
    case 'shop':
      return core.wait({ kind: 'shop', blockId: block.id });
    case 'battle':
      return startBattle(core, block);
    case 'routine':
      runRoutine(core, block);
      return false;
    case 'exits':
      return runExits(core, block);
    case 'note':
      return false;
  }
}

/**
 * A sequence leaves its last background and look as scene state, so a load or rewind shows the
 * same picture without replaying it (ADR 0019). Waiting hands the host a beat to play.
 */
function runSequence(core: RuntimeCore, block: SequenceBlock): boolean {
  const sequence = core.story.project.sequences?.find((q) => q.id === block.sequence);
  if (!sequence) return false;
  // Its song keeps playing afterwards, so it becomes the scene's music.
  if (sequence.track)
    core.s.scene = rememberScene(core.s.scene, 'audio.music.set', { track: sequence.track });
  for (const clip of sequenceSceneChanges(sequence))
    core.s.scene = rememberScene(core.s.scene, clip.action, clip.params ?? {});
  if (block.wait === false) {
    core.host.runAction?.('sequence.play', { sequence: sequence.id });
    return false;
  }
  return core.wait({ kind: 'sequence', blockId: block.id });
}
