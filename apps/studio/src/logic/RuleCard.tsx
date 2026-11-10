import { listKey, RULE_EVENTS, type RuleDef, type RuleEvent, type StoryProject } from '@ie/story';
import type { MessageKey } from '../messages.ts';
import { useProject } from '../project/store.ts';
import { allPassages } from '../project/tree.ts';
import { useT } from '../store.ts';
import { DeleteButton } from '../data/DeleteButton.tsx';
import { BlockList } from '../write/BlockList.tsx';
import { ConditionBuilder } from '../write/ConditionBuilder.tsx';
import { VariablePicker } from '../write/pickers.tsx';
import { ItemPicker, QuestPicker } from '../write/rpg-pickers.tsx';

/** The first sensible target when a rule starts listening for another kind of event. */
function defaultTarget(doc: StoryProject, on: RuleEvent): string | undefined {
  switch (on) {
    case 'changed':
      return doc.variables[0]?.id;
    case 'entered':
      return undefined;
    case 'gained':
    case 'lost':
      return doc.items?.[0]?.id;
    case 'quest':
      return doc.quests?.[0]?.id;
  }
}

function TargetPicker({
  doc,
  rule,
  onChange,
}: {
  readonly doc: StoryProject;
  readonly rule: RuleDef;
  readonly onChange: (target: string | undefined) => void;
}) {
  const t = useT();
  const label = t('rules.which');
  const value = rule.target ?? '';
  switch (rule.on) {
    case 'changed':
      return <VariablePicker doc={doc} value={value} label={label} onChange={onChange} />;
    case 'gained':
    case 'lost':
      return <ItemPicker doc={doc} value={value} label={label} onChange={onChange} />;
    case 'quest':
      return <QuestPicker doc={doc} value={value} label={label} onChange={onChange} />;
    case 'entered':
      return (
        <select
          className="picker"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value || undefined)}
        >
          <option value="">{t('rules.anyPassage')}</option>
          {allPassages(doc).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || p.id}
            </option>
          ))}
        </select>
      );
  }
}

/** One rule: When (an event and what it names), Only if, Only once, and the blocks it runs. */
export function RuleCard({ doc, rule }: { readonly doc: StoryProject; readonly rule: RuleDef }) {
  const t = useT();
  const edit = useProject((s) => s.edit);
  const set = (change: (r: RuleDef) => RuleDef, key?: string) =>
    edit(
      (d) => ({ ...d, rules: (d.rules ?? []).map((r) => (r.id === rule.id ? change(r) : r)) }),
      key,
    );
  const withTarget = (r: RuleDef, target: string | undefined): RuleDef => {
    const { target: _old, ...rest } = r;
    return target === undefined ? rest : { ...rest, target };
  };

  return (
    <section className="card logic-card" data-testid="rule">
      <label className="labelled">
        <span className="ie-label">{t('rules.name')}</span>
        <input
          className="field"
          value={rule.name ?? ''}
          data-testid="rule-name"
          onChange={(e) => set((r) => ({ ...r, name: e.target.value }), `rule:${rule.id}:name`)}
        />
      </label>
      <div className="row row--wrap">
        <span className="branch__label">{t('rules.when')}</span>
        <select
          className="picker"
          aria-label={t('rules.when')}
          value={rule.on}
          data-testid="rule-on"
          onChange={(e) => {
            const on = e.target.value as RuleEvent;
            set((r) => withTarget({ ...r, on }, defaultTarget(doc, on)));
          }}
        >
          {RULE_EVENTS.map((on) => (
            <option key={on} value={on}>
              {t(`ruleOn.${on}` as MessageKey)}
            </option>
          ))}
        </select>
        <TargetPicker
          doc={doc}
          rule={rule}
          onChange={(target) => set((r) => withTarget(r, target))}
        />
      </div>
      <div className="branch">
        <span className="branch__label">{t('rules.if')}</span>
        <ConditionBuilder
          doc={doc}
          value={rule.if}
          label={t('rules.if')}
          onChange={(formula) =>
            set((r) => {
              const { if: _old, ...rest } = r;
              return formula === undefined ? rest : { ...rest, if: formula };
            }, `rule:${rule.id}:if`)
          }
        />
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={rule.once === true}
          onChange={(e) =>
            set((r) => {
              const { once: _old, ...rest } = r;
              return e.target.checked ? { ...rest, once: true } : rest;
            })
          }
        />
        <span>{t('rules.once')}</span>
      </label>
      <div className="branch">
        <span className="branch__label">{t('rules.do')}</span>
        <BlockList listKey={listKey.rule(rule.id)} blocks={rule.do} nested testId="rule-do" />
      </div>
      <div className="card__foot">
        <span />
        <DeleteButton
          uses={0}
          onDelete={() =>
            edit((d) => ({ ...d, rules: (d.rules ?? []).filter((r) => r.id !== rule.id) }))
          }
        />
      </div>
    </section>
  );
}
