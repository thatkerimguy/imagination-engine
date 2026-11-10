import type { StoryProject } from '@ie/story';
import { newItem, newQuest } from '../project/factory-rpg.ts';
import { useStudio, useT } from '../store.ts';
import { labelText, nextName, useEditor } from './edit.ts';

const NEW = '__new__';

interface PickerProps {
  readonly doc: StoryProject;
  readonly value: string;
  readonly onChange: (id: string) => void;
  readonly label: string;
  readonly testId?: string;
}

/** Picks an item, or makes a new one and picks that. */
export function ItemPicker({ doc, value, onChange, label, testId }: PickerProps) {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const editor = useEditor();
  const items = doc.items ?? [];
  const name = (i: (typeof items)[number]) => labelText(i.name, locale, i.id);
  return (
    <select
      className="picker"
      aria-label={label}
      value={value}
      data-testid={testId}
      onChange={(event) => {
        if (event.target.value !== NEW) return onChange(event.target.value);
        const base = nextName(t('item.base'), items.map(name));
        const item = newItem({ en: base, tr: base });
        editor.edit((d) => ({ ...d, items: [...(d.items ?? []), item] }));
        onChange(item.id);
      }}
    >
      {!items.some((i) => i.id === value) && <option value={value}>{t('pick.item')}</option>}
      {items.map((i) => (
        <option key={i.id} value={i.id}>
          {name(i)}
        </option>
      ))}
      <option value={NEW}>{t('pick.newItem')}</option>
    </select>
  );
}

/** Picks a quest, or makes a new one with a first step and picks that. */
export function QuestPicker({ doc, value, onChange, label, testId }: PickerProps) {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const editor = useEditor();
  const quests = doc.quests ?? [];
  const name = (q: (typeof quests)[number]) => labelText(q.name, locale, q.id);
  return (
    <select
      className="picker"
      aria-label={label}
      value={value}
      data-testid={testId}
      onChange={(event) => {
        if (event.target.value !== NEW) return onChange(event.target.value);
        const base = nextName(t('quest.base'), quests.map(name));
        const step = t('quest.firstStep');
        const quest = newQuest({ en: base, tr: base }, { en: step, tr: step });
        editor.edit((d) => ({ ...d, quests: [...(d.quests ?? []), quest] }));
        onChange(quest.id);
      }}
    >
      {!quests.some((q) => q.id === value) && <option value={value}>{t('pick.quest')}</option>}
      {quests.map((q) => (
        <option key={q.id} value={q.id}>
          {name(q)}
        </option>
      ))}
      <option value={NEW}>{t('pick.newQuest')}</option>
    </select>
  );
}

/** Picks a routine (routines are made in the Logic workspace). */
export function RoutinePicker({ doc, value, onChange, label, testId }: PickerProps) {
  const t = useT();
  const routines = doc.routines ?? [];
  return (
    <select
      className="picker"
      aria-label={label}
      value={value}
      data-testid={testId}
      onChange={(event) => onChange(event.target.value)}
    >
      {!routines.some((r) => r.id === value) && <option value={value}>{t('pick.routine')}</option>}
      {routines.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name || r.id}
        </option>
      ))}
    </select>
  );
}
