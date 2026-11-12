import type { BeatmapDef } from '@ie/story';
import { EXCLUSIVE, MODS, type Mod } from '../rules.ts';
import type { PlayResult } from '../session.ts';
import { button, el, type BeatmapText } from './beatmap-hud.ts';

/** Per-device settings for beatmaps, kept by the app (ADR 0033). */
export interface RhythmPrefs {
  /** Milliseconds added to the clock before judging: positive if taps land late. */
  readonly offset: number;
  /** How much the story behind the field is dimmed, 0–1. */
  readonly dim: number;
  readonly hitSounds: boolean;
  /** The changes picked last time. */
  readonly mods: readonly Mod[];
}

export const DEFAULT_PREFS: RhythmPrefs = { offset: 0, dim: 0.85, hitSounds: true, mods: [] };

/** Reads stored settings, keeping only what is valid (they come from browser storage). */
export function parsePrefs(raw: string | null): RhythmPrefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    const num = (x: unknown, lo: number, hi: number, d: number) =>
      typeof x === 'number' && Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d;
    const mods = Array.isArray(v.mods)
      ? MODS.filter((m) => (v.mods as unknown[]).includes(m))
      : DEFAULT_PREFS.mods;
    return {
      offset: Math.round(num(v.offset, -300, 300, 0)),
      dim: num(v.dim, 0, 1, DEFAULT_PREFS.dim),
      hitSounds: typeof v.hitSounds === 'boolean' ? v.hitSounds : true,
      mods: mods.filter((m, i) => !mods.slice(0, i).some((e) => EXCLUSIVE[e] === m)),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function toggleMod(mods: readonly Mod[], mod: Mod): Mod[] {
  if (mods.includes(mod)) return mods.filter((m) => m !== mod);
  const other = EXCLUSIVE[mod];
  return [...mods.filter((m) => m !== other), mod];
}

function minutes(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function offsetControl(
  parent: HTMLElement,
  text: BeatmapText,
  value: () => number,
  change: (delta: number) => void,
): void {
  const row = el('div', 'ie-bm__setting', parent);
  el('span', 'ie-bm__setting-label', row, text('bm.offset'));
  const less = button(row, '−', () => {
    change(-5);
    shown.textContent = text('bm.offsetValue', { n: value() });
  });
  less.setAttribute('aria-label', text('bm.earlier'));
  less.dataset.testid = 'beatmap-offset-down';
  const shown = el('output', 'ie-bm__offset', row, text('bm.offsetValue', { n: value() }));
  shown.dataset.testid = 'beatmap-offset';
  const more = button(row, '+', () => {
    change(5);
    shown.textContent = text('bm.offsetValue', { n: value() });
  });
  more.setAttribute('aria-label', text('bm.later'));
}

export interface StartCardOptions {
  readonly beatmap: BeatmapDef;
  readonly name: string;
  readonly hasSong: boolean;
  readonly length: number;
  /** Changes the help setting turns on: shown on and locked, as are the ones they rule out. */
  readonly forced: readonly Mod[];
  readonly prefs: () => RhythmPrefs;
  readonly save: (prefs: RhythmPrefs) => void;
  readonly start: () => void;
  /** A test play can be closed without playing. */
  readonly close?: () => void;
}

export function startCard(text: BeatmapText, o: StartCardOptions): HTMLElement {
  const card = el('div', 'ie-bm__card');
  card.dataset.testid = 'beatmap-start';
  el('h2', 'ie-bm__title', card, o.name);
  const credit = o.beatmap.credit;
  if (credit?.artist) el('p', 'ie-bm__sub', card, credit.artist);
  if (credit?.mapper) el('p', 'ie-bm__sub', card, text('bm.chartBy', { name: credit.mapper }));
  const d = o.beatmap.difficulty;
  const round = (n: number) => Math.round(n * 10) / 10;
  el('p', 'ie-bm__meta', card, text('bm.stats', {
    size: round(d.size),
    approach: round(d.approach),
    accuracy: round(d.accuracy),
    drain: round(d.drain),
  }));
  el('p', 'ie-bm__meta', card, text('bm.notes', {
    n: o.beatmap.objects.length,
    time: minutes(o.length),
  }));
  if (!o.hasSong) el('p', 'ie-bm__meta', card, text('bm.noSong'));
  el('p', 'ie-bm__help', card, text('bm.help'));

  const mods = el('fieldset', 'ie-bm__mods', card);
  el('legend', 'ie-bm__legend', mods, text('bm.mods'));
  const toggles = new Map<Mod, HTMLButtonElement>();
  // What plays: the reader's picks, less those a forced change rules out, plus the forced ones.
  const locked = (mod: Mod) => o.forced.includes(mod) || o.forced.some((f) => EXCLUSIVE[f] === mod);
  const refresh = () => {
    for (const [mod, b] of toggles) {
      const on = o.forced.includes(mod) || (!locked(mod) && o.prefs().mods.includes(mod));
      b.setAttribute('aria-pressed', String(on));
    }
  };
  for (const mod of MODS) {
    const b = button(mods, text(`bm.mod.${mod}`), () => {
      o.save({ ...o.prefs(), mods: toggleMod(o.prefs().mods, mod) });
      refresh();
    });
    b.classList.add('ie-bm__mod');
    const hint = text(`bm.modHint.${mod}`);
    b.title = locked(mod) ? `${hint} · ${text('bm.modForced')}` : hint;
    b.disabled = locked(mod);
    b.dataset.mod = mod;
    toggles.set(mod, b);
  }
  refresh();

  const settings = el('fieldset', 'ie-bm__settings', card);
  el('legend', 'ie-bm__legend', settings, text('bm.settings'));
  offsetControl(settings, text, () => o.prefs().offset, (delta) =>
    o.save({ ...o.prefs(), offset: Math.max(-300, Math.min(300, o.prefs().offset + delta)) }),
  );
  const dimRow = el('label', 'ie-bm__setting', settings);
  el('span', 'ie-bm__setting-label', dimRow, text('bm.dim'));
  const dim = el('input', 'ie-bm__range', dimRow);
  dim.type = 'range';
  dim.min = '0';
  dim.max = '100';
  dim.value = String(Math.round(o.prefs().dim * 100));
  dim.addEventListener('input', () => o.save({ ...o.prefs(), dim: Number(dim.value) / 100 }));
  const soundRow = el('label', 'ie-bm__setting', settings);
  const sound = el('input', '', soundRow);
  sound.type = 'checkbox';
  sound.checked = o.prefs().hitSounds;
  sound.addEventListener('change', () => o.save({ ...o.prefs(), hitSounds: sound.checked }));
  el('span', 'ie-bm__setting-label', soundRow, text('bm.hitSounds'));

  const actions = el('div', 'ie-bm__actions', card);
  if (o.close) button(actions, text('bm.close'), o.close).dataset.testid = 'beatmap-close';
  const go = button(actions, text('bm.start'), o.start, true);
  go.dataset.testid = 'beatmap-go';
  return card;
}

export interface PauseCardOptions {
  readonly test: boolean;
  readonly offset: () => number;
  readonly changeOffset: (delta: number) => void;
  readonly resume: () => void;
  readonly retry: () => void;
  readonly quit: () => void;
}

export function pauseCard(text: BeatmapText, o: PauseCardOptions): HTMLElement {
  const card = el('div', 'ie-bm__card ie-bm__card--small');
  card.dataset.testid = 'beatmap-paused';
  el('h2', 'ie-bm__title', card, text('bm.paused'));
  const actions = el('div', 'ie-bm__actions', card);
  button(actions, text('bm.resume'), o.resume, true).dataset.testid = 'beatmap-resume';
  button(actions, text('bm.retry'), o.retry).dataset.testid = 'beatmap-retry';
  button(actions, text(o.test ? 'bm.close' : 'bm.quit'), o.quit).dataset.testid = 'beatmap-quit';
  offsetControl(card, text, o.offset, o.changeOffset);
  return card;
}

export interface ResultCardOptions {
  readonly result: PlayResult;
  readonly pass: number;
  readonly test: boolean;
  readonly retry: () => void;
  /** After a watched round: turn Watch off and play. */
  readonly playYourself: () => void;
  readonly done: () => void;
  readonly useOffset: ((ms: number) => void) | null;
}

export function resultCard(text: BeatmapText, o: ResultCardOptions): HTMLElement {
  const { result } = o;
  const tag = text.locale === 'tr' ? 'tr-TR' : 'en-GB';
  const numbers = new Intl.NumberFormat(tag);
  const percent = new Intl.NumberFormat(tag, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const card = el('div', 'ie-bm__card');
  card.dataset.testid = 'beatmap-result';
  card.dataset.won = String(result.won);
  const title = result.failed
    ? 'bm.failed'
    : result.watched
      ? 'bm.watched'
      : result.emptied
        ? 'bm.emptied'
        : result.won
          ? 'bm.cleared'
          : 'bm.short';
  el('h2', 'ie-bm__title', card, text(title));
  if (result.watched) el('p', 'ie-bm__sub', card, text('bm.watchedHint'));
  else if (result.emptied) el('p', 'ie-bm__sub', card, text('bm.emptiedHint'));
  else if (!result.failed && !result.won && o.pass > 0)
    el('p', 'ie-bm__sub', card, text('bm.needed', { n: o.pass }));
  if (!result.failed) {
    const rank = el('p', 'ie-bm__rank', card, result.rank);
    rank.dataset.testid = 'beatmap-rank';
    rank.setAttribute('aria-label', `${text('bm.rank')} ${result.rank}`);
  }
  const list = el('dl', 'ie-bm__stats', card);
  const row = (label: string, value: string, id?: string) => {
    el('dt', '', list, label);
    const dd = el('dd', '', list, value);
    if (id) dd.dataset.testid = id;
  };
  row(text('bm.score'), numbers.format(result.score));
  row(text('bm.accuracy'), percent.format(result.accuracy), 'beatmap-result-accuracy');
  row(text('bm.combo'), `${numbers.format(result.maxCombo)}×`);
  for (const j of ['perfect', 'great', 'good', 'miss'] as const)
    row(text(`bm.${j}`), numbers.format(result.counts[j]));
  const mean = Math.round(result.meanOffset);
  row(text('bm.timing'), text('bm.timingValue', { mean, spread: Math.round(result.spread) }));
  const actions = el('div', 'ie-bm__actions', card);
  const useOffset = o.useOffset;
  if (useOffset && Math.abs(mean) >= 4) {
    const fix = button(actions, text('bm.useOffset', { n: mean }), () => {
      useOffset(mean);
      fix.disabled = true;
    });
  }
  // A watched round settles nothing, so the way on is to play it.
  if (result.watched) {
    const play = button(actions, text('bm.playYourself'), o.playYourself, true);
    play.dataset.testid = 'beatmap-play-yourself';
    return card;
  }
  button(actions, text('bm.retry'), o.retry).dataset.testid = 'beatmap-retry';
  const done = button(actions, text(o.test ? 'bm.close' : 'bm.continue'), o.done, true);
  done.dataset.testid = 'beatmap-done';
  return card;
}
