import {
  PRESETS,
  applyStoryTheme,
  resolveStoryTheme,
  themeColors,
  themeWarnings,
} from '@ie/present';
import {
  CHOICE_STYLES,
  FONT_FAMILIES,
  PAGE_TRANSITIONS,
  THEME_COLORS,
  THEME_LEADING,
  THEME_PRESETS,
  THEME_SIZE,
  type FontFamily,
  type StoryProject,
  type StoryTheme,
  type ThemePreset,
} from '@ie/story';
import { RotateCcw } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { Segmented } from '../components/Segmented.tsx';
import type { MessageKey } from '../messages.ts';
import { useProject } from '../project/store.ts';
import { useT } from '../store.ts';

const AUTO: StoryTheme = { preset: 'auto' };

/** Sets or clears one optional key of a theme. */
function withKey<K extends keyof StoryTheme>(
  theme: StoryTheme,
  key: K,
  value: StoryTheme[K] | undefined,
): StoryTheme {
  const { [key]: _old, ...rest } = theme;
  return (value === undefined ? rest : { ...rest, [key]: value }) as StoryTheme;
}

function useThemeEdit() {
  const edit = useProject((s) => s.edit);
  return (change: (theme: StoryTheme) => StoryTheme, key?: string) =>
    edit((d) => ({ ...d, theme: change(d.theme ?? AUTO) }), key);
}

/** A preset as three dots: page, text and accent. Auto shows the reader's own tokens. */
export function PresetSwatch({ preset }: { readonly preset: ThemePreset }) {
  const palette = PRESETS[preset].palette;
  const colors = palette
    ? [palette.bg, palette.ink, palette.accent]
    : ['var(--color-bg)', 'var(--color-ink)', 'var(--color-accent)'];
  return (
    <span className="theme-swatch" aria-hidden="true">
      {colors.map((color, i) => (
        <span key={i} style={{ background: color }} />
      ))}
    </span>
  );
}

/** A page of story in the theme being edited, drawn with the reader's own classes. */
export function ThemePreview({ theme }: { readonly theme: StoryTheme | undefined }) {
  const t = useT();
  const holder = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (holder.current) applyStoryTheme(holder.current, resolveStoryTheme(theme));
  }, [theme]);
  return (
    <div className="theme-preview" ref={holder} data-testid="theme-preview">
      <div className="story" data-layout="page">
        <div className="story__page">
          <p className="line line--narration">{t('preview.line')}</p>
          <p className="line line--dialogue">
            <span className="line__speaker">{t('preview.speaker')}</span>
            <span className="line__text">{t('preview.dialogue')}</span>
          </p>
        </div>
        <div className="story__prompt">
          <div className="choices">
            <div className="choices__list">
              {(['preview.choice1', 'preview.choice2'] as const).map((key, i) => (
                <span className="choice" key={key}>
                  <span className="choice__body">
                    <span className="choice__text">{t(key)}</span>
                  </span>
                  <span className="choice__key">{i + 1}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FontSelect({
  label,
  value,
  onChange,
  testId,
}: {
  readonly label: string;
  readonly value: FontFamily | undefined;
  readonly onChange: (font: FontFamily | undefined) => void;
  readonly testId: string;
}) {
  const t = useT();
  return (
    <label className="labelled">
      <span className="ie-label">{label}</span>
      <select
        className="picker"
        value={value ?? ''}
        data-testid={testId}
        onChange={(e) => onChange((e.target.value || undefined) as FontFamily | undefined)}
      >
        <option value="">{t('font.preset')}</option>
        {FONT_FAMILIES.map((f) => (
          <option key={f} value={f}>
            {t(`font.${f}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The story's look: a preset, then colours, type, choices and the page turn on top of it. */
export function ThemeEditor({ doc }: { readonly doc: StoryProject }) {
  const t = useT();
  const set = useThemeEdit();
  const theme = doc.theme ?? AUTO;
  const look = PRESETS[theme.preset];
  const colors = themeColors(theme);
  const warnings = themeWarnings(theme);

  return (
    <div className="theme-editor">
      <div className="cards theme-editor__controls">
        <section className="card">
          <h3 className="card__title">{t('theme.preset')}</h3>
          <div className="theme-presets" role="group" aria-label={t('theme.preset')}>
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="theme-preset"
                aria-pressed={theme.preset === preset}
                data-testid={`theme-preset-${preset}`}
                // A new preset is a new look; only the reader-comfort settings carry over.
                onClick={() =>
                  set((old) => ({
                    preset,
                    ...(old.size === undefined ? {} : { size: old.size }),
                    ...(old.leading === undefined ? {} : { leading: old.leading }),
                  }))
                }
              >
                <PresetSwatch preset={preset} />
                <span>{t(`preset.${preset}`)}</span>
              </button>
            ))}
          </div>
          {theme.preset === 'auto' && <p className="hint">{t('theme.autoHint')}</p>}
        </section>

        {theme.preset !== 'auto' && (
          <section className="card">
            <h3 className="card__title">{t('theme.colors')}</h3>
            <div className="card__grid">
              {THEME_COLORS.map((color) => {
                const name = t(`color.${color}`);
                const custom = theme.colors?.[color];
                return (
                  <div className="theme-color" key={color}>
                    <label className="theme-color__field">
                      <input
                        type="color"
                        value={colors[color] ?? '#000000'}
                        data-testid={`theme-color-${color}`}
                        onChange={(e) =>
                          set(
                            (old) => ({
                              ...old,
                              colors: { ...old.colors, [color]: e.target.value },
                            }),
                            `theme:color:${color}`,
                          )
                        }
                      />
                      <span>{name}</span>
                    </label>
                    {custom && (
                      <button
                        type="button"
                        className="ie-button ie-button--quiet icon-button"
                        aria-label={t('theme.resetColor', { color: name })}
                        title={t('theme.resetColor', { color: name })}
                        onClick={() =>
                          set((old) => {
                            const { [color]: _old, ...rest } = old.colors ?? {};
                            return withKey(
                              old,
                              'colors',
                              Object.keys(rest).length ? rest : undefined,
                            );
                          })
                        }
                      >
                        <RotateCcw size={16} strokeWidth={1.5} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {warnings.map((w) => (
              <p
                className="hint"
                data-danger
                role="status"
                key={w.color}
                data-testid="theme-warning"
              >
                {t('theme.contrast', {
                  color: t(`color.${w.color}`),
                  ratio: String(w.ratio),
                  needs: String(w.needs),
                })}
              </p>
            ))}
          </section>
        )}

        <section className="card">
          <h3 className="card__title">{t('theme.type')}</h3>
          <div className="card__grid">
            <FontSelect
              label={t('theme.prose')}
              value={theme.prose}
              testId="theme-prose"
              onChange={(font) => set((old) => withKey(old, 'prose', font))}
            />
            <FontSelect
              label={t('theme.ui')}
              value={theme.ui}
              testId="theme-ui"
              onChange={(font) => set((old) => withKey(old, 'ui', font))}
            />
            <label className="labelled">
              <span className="ie-label">
                {t('theme.size')} · {Math.round((theme.size ?? 1) * 100)}%
              </span>
              <input
                className="ie-range"
                type="range"
                min={THEME_SIZE.min}
                max={THEME_SIZE.max}
                step={0.05}
                value={theme.size ?? 1}
                onChange={(e) => {
                  const size = Number(e.target.value);
                  set((old) => withKey(old, 'size', size === 1 ? undefined : size), 'theme:size');
                }}
              />
            </label>
            <label className="labelled">
              <span className="ie-label">
                {t('theme.leading')} · {(theme.leading ?? 1.6).toFixed(2)}
              </span>
              <input
                className="ie-range"
                type="range"
                min={THEME_LEADING.min}
                max={THEME_LEADING.max}
                step={0.05}
                value={theme.leading ?? 1.6}
                onChange={(e) => {
                  const leading = Number(e.target.value);
                  set((old) => withKey(old, 'leading', leading), 'theme:leading');
                }}
              />
            </label>
          </div>
          <p className="hint">{t('theme.fontsHint')}</p>
        </section>

        <section className="card">
          <span className="ie-label">{t('theme.choices')}</span>
          <Segmented
            label={t('theme.choices')}
            value={theme.choices ?? look.choices ?? 'outline'}
            options={CHOICE_STYLES.map((value) => ({
              value,
              label: t(`choiceStyle.${value}` as MessageKey),
            }))}
            onChange={(choices) => set((old) => ({ ...old, choices }))}
          />
          <span className="ie-label">{t('theme.transition')}</span>
          <Segmented
            label={t('theme.transition')}
            value={theme.transition ?? look.transition ?? 'none'}
            options={PAGE_TRANSITIONS.map((value) => ({
              value,
              label: t(`transition.${value}` as MessageKey),
            }))}
            onChange={(transition) => set((old) => ({ ...old, transition }))}
          />
        </section>
      </div>
      <aside className="theme-editor__preview" aria-label={t('theme.preview')}>
        <span className="ie-label">{t('theme.preview')}</span>
        <ThemePreview theme={doc.theme} />
      </aside>
    </div>
  );
}
