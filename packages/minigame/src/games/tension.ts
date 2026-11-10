import { MINIGAME_DEFAULTS, type TensionGame } from '@ie/story';
import { clamp, defineMinigame, score } from '../types.ts';

export interface TensionState {
  /** Seconds the marker has to spend inside the zone. */
  readonly hold: number;
  readonly limit: number;
  readonly zone: number;
  readonly drift: number;
  /** Where the zone's wander starts, so two games don't move alike. */
  readonly phase: number;
  /** The marker, 0 (slack) to 1 (taut), and how fast it is moving. */
  pos: number;
  velocity: number;
  held: boolean;
  /** Centre of the zone right now. */
  center: number;
  /** 0 to 1; the game is won at 1. */
  progress: number;
  best: number;
  elapsed: number;
}

const D = MINIGAME_DEFAULTS.tension;
/** Pull while held and give while released, in lengths of the bar a second, each second. */
const PULL = 2.2;
const GIVE = 1.6;
const DRAG = 2.5;

/** The zone wanders on two slow waves, so it never repeats in a way that can be learned. */
function centerAt(s: TensionState, time: number): number {
  const reach = (1 - s.zone) / 2;
  const wave =
    0.62 * Math.sin(time * s.drift * 0.9 + s.phase) +
    0.38 * Math.sin(time * s.drift * 2.3 + s.phase * 2);
  return 0.5 + reach * wave;
}

const over = (s: TensionState) => s.progress >= 1 || s.elapsed >= s.limit;

/** Hold to pull, release to give: keep the marker inside the drifting zone until the bar fills. */
export const tension = defineMinigame<TensionGame, TensionState>({
  id: 'tension',
  setup(game, ctx) {
    const state: TensionState = {
      hold: game.hold ?? D.hold,
      limit: (game.limit ?? D.limit) * ctx.ease,
      zone: clamp((game.zone ?? D.zone) * ctx.ease, 0.1, 0.8),
      drift: (game.drift ?? D.drift) / ctx.ease,
      phase: ctx.random() * Math.PI * 2,
      pos: 0.5,
      velocity: 0,
      held: false,
      center: 0.5,
      progress: 0,
      best: 0,
      elapsed: 0,
    };
    state.center = centerAt(state, 0);
    state.pos = state.center;
    return state;
  },
  update(s, dt) {
    if (over(s)) return;
    s.elapsed += dt;
    s.velocity += (s.held ? PULL : -GIVE) * dt;
    s.velocity -= s.velocity * DRAG * dt;
    s.pos += s.velocity * dt;
    if (s.pos <= 0 || s.pos >= 1) {
      s.pos = clamp(s.pos, 0, 1);
      s.velocity = 0;
    }
    s.center = centerAt(s, s.elapsed);
    const inside = Math.abs(s.pos - s.center) <= s.zone / 2;
    // Slipping out loses ground at half the rate it was won.
    s.progress = clamp(s.progress + (inside ? dt : -dt / 2) / s.hold, 0, 1);
    s.best = Math.max(s.best, s.progress);
  },
  onInput(s, input) {
    if (input.kind === 'press') s.held = true;
    else if (input.kind === 'release') s.held = false;
  },
  result(s) {
    if (!over(s)) return null;
    const won = s.progress >= 1;
    return {
      won,
      score: score(won ? 60 + 40 * (1 - s.elapsed / s.limit) : 55 * s.best),
      values: { seconds: Math.round(s.elapsed) },
    };
  },
  timeLeft: (s) => Math.max(0, 1 - s.elapsed / s.limit),
});
