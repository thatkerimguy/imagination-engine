import { listKey } from './compile.ts';
import { truthy } from './formula.ts';
import { eventKey, type RuleDef } from './logic.ts';
import type { RuntimeCore } from './runtime-core.ts';

/**
 * Fires the rules matching the queued events (ADR 0017). Each due rule is pushed as a frame, so
 * its blocks run next, first rule first. A rule whose frame is still on the stack doesn't fire
 * again, which is what stops a rule from triggering itself forever.
 */
export function fireRules(core: RuntimeCore): void {
  const events = core.s.events;
  if (!events?.length) return;
  core.s.events = [];
  const keys = new Set(events);
  const kinds = new Set(events.map((e) => e.slice(0, e.indexOf(':'))));
  const running = new Set(core.s.frames.map((f) => f.rule));
  const due: RuleDef[] = [];
  for (const rule of core.story.project.rules ?? []) {
    const hit =
      rule.target === undefined ? kinds.has(rule.on) : keys.has(eventKey(rule.on, rule.target));
    if (!hit || running.has(rule.id)) continue;
    if (rule.once && core.s.fired?.[rule.id]) continue;
    if (rule.if !== undefined && !truthy(core.compute(rule.if))) continue;
    due.push(rule);
  }
  for (const rule of due.toReversed()) {
    if (rule.once) core.s.fired = { ...core.s.fired, [rule.id]: 1 };
    core.push({ list: listKey.rule(rule.id), index: 0, rule: rule.id });
  }
}
