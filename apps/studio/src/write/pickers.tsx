import { sortText, type Locale } from '@ie/i18n';
import type { StoryProject, VariableDef, VariableType } from '@ie/story';
import { useStudio, useT } from '../store.ts';
import { allPassages } from '../project/tree.ts';
import { labelText, nextName, useEditor } from './edit.ts';

const NEW = '__new__';

interface PickerProps {
  readonly doc: StoryProject;
  readonly value: string;
  readonly onChange: (id: string) => void;
  readonly label: string;
  readonly testId?: string;
}

function sorted<T>(items: readonly T[], name: (item: T) => string, locale: Locale): T[] {
  return sortText(items, locale, name);
}

/** Picks a passage, or makes a new one ("Passage 4") and picks that. */
export function PassagePicker({ doc, value, onChange, label, testId }: PickerProps) {
  const t = useT();
  const editor = useEditor();
  const passages = allPassages(doc);
  return (
    <select
      className="picker"
      aria-label={label}
      value={value}
      data-testid={testId}
      onChange={(event) => {
        if (event.target.value !== NEW) return onChange(event.target.value);
        const name = nextName(
          t('passage.base'),
          passages.map((p) => p.name ?? ''),
        );
        onChange(editor.addPassage(name));
      }}
    >
      {!value && <option value="">{t('pick.passage')}</option>}
      {passages.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name || p.id}
        </option>
      ))}
      <option value={NEW}>{t('pick.newPassage')}</option>
    </select>
  );
}

/** Picks a character, or makes a new one and picks that. */
export function CharacterPicker({ doc, value, onChange, label, testId }: PickerProps) {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const editor = useEditor();
  const name = (c: StoryProject['characters'][number]) => labelText(c.name, locale, c.id);
  return (
    <select
      className="picker picker--speaker"
      aria-label={label}
      value={value}
      data-testid={testId}
      onChange={(event) => {
        if (event.target.value !== NEW) return onChange(event.target.value);
        const base = nextName(
          t('character.base'),
          doc.characters.map((c) => name(c)),
        );
        onChange(editor.addCharacter({ en: base, tr: base }));
      }}
    >
      {!value && <option value="">{t('pick.character')}</option>}
      {sorted(doc.characters, name, locale).map((c) => (
        <option key={c.id} value={c.id}>
          {name(c)}
        </option>
      ))}
      <option value={NEW}>{t('pick.newCharacter')}</option>
    </select>
  );
}

interface VariablePickerProps extends PickerProps {
  /** Only variables of these types (a text variable for Input, a number for costs). */
  readonly types?: readonly VariableType[];
  /** The type a new variable gets. */
  readonly newType?: VariableType;
}

/** Picks a variable, or makes a new one of the right type and picks that. */
export function VariablePicker({
  doc,
  value,
  onChange,
  label,
  testId,
  types,
  newType = 'number',
}: VariablePickerProps) {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const editor = useEditor();
  const name = (v: VariableDef) => labelText(v.name, locale, v.id);
  const usable = doc.variables.filter((v) => !types || types.includes(v.type));
  return (
    <select
      className="picker"
      aria-label={label}
      value={value}
      data-testid={testId}
      onChange={(event) => {
        if (event.target.value !== NEW) return onChange(event.target.value);
        const base = nextName(
          t('variable.base'),
          doc.variables.map((v) => name(v)),
        );
        onChange(editor.addVariable(newType, { en: base, tr: base }));
      }}
    >
      {!usable.some((v) => v.id === value) && <option value={value}>{t('pick.variable')}</option>}
      {sorted(usable, name, locale).map((v) => (
        <option key={v.id} value={v.id}>
          {name(v)}
        </option>
      ))}
      <option value={NEW}>{t('pick.newVariable')}</option>
    </select>
  );
}
