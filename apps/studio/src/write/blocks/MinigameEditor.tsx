import {
  defaultGame,
  listKey,
  MINIGAME_TEMPLATES,
  MINIGAME_VALUES,
  type MinigameBlock,
  type MinigameGame,
  type MinigameTemplate,
} from '@ie/story';
import { LabelFields } from '../../data/LabelFields.tsx';
import type { MessageKey } from '../../messages.ts';
import { MinigameParams } from '../../minigame/MinigameParams.tsx';
import { MinigameTryout } from '../../minigame/MinigameTryout.tsx';
import { useStudio, useT } from '../../store.ts';
import { BlockList } from '../BlockList.tsx';
import { useWrite } from '../context.ts';
import { labelText } from '../edit.ts';
import { Sentence } from '../Sentence.tsx';

/** Keeps the words a cipher or typing game already has when switching between the two. */
function switchTemplate(game: MinigameGame, template: MinigameTemplate): MinigameGame {
  const words =
    game.template === 'cipher' ? game.words : game.template === 'typing' ? game.phrases : null;
  if (template === 'cipher' && words) return { template, words };
  if (template === 'typing' && words) return { template, phrases: words };
  return defaultGame(template);
}

/** Play {template}; its parameters and a try-out; where results go; success and failure lists. */
export function MinigameEditor({ block }: { readonly block: MinigameBlock }) {
  const t = useT();
  const { doc, editor } = useWrite();
  const locale = useStudio((s) => s.locale);
  const set = (change: (b: MinigameBlock) => MinigameBlock, mergeKey?: string) =>
    editor.block(block.id, (b) => change(b as MinigameBlock), mergeKey);
  const numbers = doc.variables.filter((v) => v.type === 'number');
  const values: readonly string[] = MINIGAME_VALUES[block.game.template];

  const variablePicker = (
    value: string | undefined,
    label: string,
    onChange: (id: string | undefined) => void,
    testId: string,
  ) => (
    <label className="inline-field" key={testId}>
      <span>{label}</span>
      <select
        className="picker"
        value={value ?? ''}
        data-testid={testId}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">{t('mg.noScore')}</option>
        {numbers.map((v) => (
          <option key={v.id} value={v.id}>
            {labelText(v.name, locale, v.id)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="branches" data-testid="minigame-editor">
      <div className="row row--wrap">
        <Sentence
          template={t('mg.sentence')}
          slots={{
            template: (
              <select
                className="picker"
                aria-label={t('mg.template')}
                value={block.game.template}
                data-testid="mg-template"
                onChange={(e) =>
                  set((b) => {
                    const template = e.target.value as MinigameTemplate;
                    // Stored values belong to the old template; keep only those the new one has.
                    const keep: readonly string[] = MINIGAME_VALUES[template];
                    const store = Object.fromEntries(
                      Object.entries(b.store ?? {}).filter(([name]) => keep.includes(name)),
                    );
                    const { store: _old, ...rest } = b;
                    return {
                      ...rest,
                      game: switchTemplate(b.game, template),
                      ...(Object.keys(store).length ? { store } : {}),
                    };
                  })
                }
              >
                {MINIGAME_TEMPLATES.map((template) => (
                  <option key={template} value={template}>
                    {t(`mg.tpl.${template}` as MessageKey)}
                  </option>
                ))}
              </select>
            ),
          }}
        />
      </div>
      <MinigameParams
        game={block.game}
        onChange={(game) => set((b) => ({ ...b, game }), `mg:${block.id}`)}
      />
      <div className="mg-title">
        <LabelFields
          value={block.title}
          prefix={t('mg.title')}
          testId="mg-title"
          onChange={(title) =>
            set((b) => {
              const { title: _old, ...rest } = b;
              return title.en?.trim() || title.tr?.trim() ? { ...rest, title } : rest;
            }, `mg-title:${block.id}`)
          }
        />
        <p className="hint">{t('mg.titleHint')}</p>
      </div>
      <MinigameTryout game={block.game} {...(block.title ? { title: block.title } : {})} />
      <div className="row row--wrap">
        {variablePicker(
          block.score,
          t('mg.score'),
          (score) =>
            set((b) => {
              const { score: _old, ...rest } = b;
              return score ? { ...rest, score } : rest;
            }),
          'mg-score',
        )}
        {values.map((name) =>
          variablePicker(
            block.store?.[name],
            t('mg.store', { value: t(`mg.v.${name}` as MessageKey) }),
            (id) =>
              set((b) => {
                const { [name]: _old, ...others } = b.store ?? {};
                const store = id ? { ...others, [name]: id } : others;
                const { store: _was, ...rest } = b;
                return Object.keys(store).length ? { ...rest, store } : rest;
              }),
            `mg-store-${name}`,
          ),
        )}
      </div>
      <div className="branch">
        <span className="branch__label">{t('mg.win')}</span>
        <BlockList listKey={listKey.win(block.id)} blocks={block.win} nested testId="mg-win" />
      </div>
      <div className="branch">
        <span className="branch__label">{t('mg.lose')}</span>
        <BlockList listKey={listKey.lose(block.id)} blocks={block.lose} nested testId="mg-lose" />
      </div>
    </div>
  );
}
