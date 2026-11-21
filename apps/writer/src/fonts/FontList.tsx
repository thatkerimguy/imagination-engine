// Grouped font picker: one row per typeface family, each rendered in its own face (`Aa  Lora`),
// plus custom-font import/delete. The active row gets an accent rail and an accent name.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useRepository } from '../store/context.tsx';
import { loadCustomFonts, type CustomFont } from '../store/writer-prefs.ts';
import { ActionButton } from '../ui/ActionButton.tsx';
import { IconBtn } from '../ui/IconBtn.tsx';
import { Divider } from '../ui/Page.tsx';
import { Press } from '../ui/Press.tsx';
import { space } from '../ui/tokens.ts';
import { Txt } from '../ui/Txt.tsx';
import { useTheme } from '../ui/theme.tsx';
import {
  DEFAULT_FONT_ID,
  familyIdOf,
  familyLabel,
  FONT_FAMILIES,
  type FontCategory,
} from './catalog.ts';
import { deleteCustomFont, importCustomFont } from './loader';
import { usePreviewFamily } from './preview-queue.ts';

const GROUPS: readonly { category: FontCategory; title: string }[] = [
  { category: 'serif', title: 'Serif' },
  { category: 'sans', title: 'Sans' },
  { category: 'mono', title: 'Mono' },
];

function FontRow(p: {
  id: string;
  label: string;
  selected: boolean;
  onSelect(): void;
  onDelete?(): void;
}): ReactNode {
  const { colors } = useTheme();
  const family = usePreviewFamily(p.id, p.selected);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Press
        testID={`font-${p.id}`}
        accessibilityRole="radio"
        accessibilityState={{ selected: p.selected, checked: p.selected }}
        accessibilityLabel={p.label}
        onPress={p.onSelect}
        style={{
          flex: 1,
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingLeft: space.sm,
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 10,
            bottom: 10,
            width: 3,
            borderRadius: 2,
            backgroundColor: p.selected ? colors.accent : 'transparent',
          }}
        />
        <Txt
          color={p.selected ? 'accent' : 'inkSecondary'}
          style={{ fontFamily: family, fontSize: 20, lineHeight: 26, width: 34 }}
        >
          Aa
        </Txt>
        <Txt
          numberOfLines={1}
          color={p.selected ? 'accent' : 'ink'}
          style={{ flex: 1, fontFamily: family, fontSize: 17, lineHeight: 24 }}
        >
          {p.label}
        </Txt>
      </Press>
      {p.onDelete ? (
        <IconBtn
          icon="trash-2"
          accessibilityLabel={`Delete ${p.label}`}
          testID={`delete-${p.id}`}
          onPress={p.onDelete}
        />
      ) : null}
    </View>
  );
}

export function FontList(p: { fontId: string; onSelect(id: string): void }): ReactNode {
  const repo = useRepository();
  const [custom, setCustom] = useState<CustomFont[]>([]);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const refresh = useCallback(
    () =>
      void loadCustomFonts(repo).then((list) => {
        if (alive.current) setCustom(list);
      }),
    [repo],
  );
  useEffect(refresh, [refresh]);
  const doImport = async (): Promise<void> => {
    setError(null);
    try {
      const f = await importCustomFont(repo);
      if (f) {
        refresh();
        p.onSelect(f.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import that font.');
    }
  };
  const remove = async (id: string): Promise<void> => {
    await deleteCustomFont(repo, id);
    if (p.fontId === id) p.onSelect(DEFAULT_FONT_ID);
    refresh();
  };
  const active = familyIdOf(p.fontId);
  // A legacy stack (e.g. Rounded) that is no longer a picker row stays visible while selected.
  const legacy =
    FONT_FAMILIES.some((f) => f.id === active) || custom.some((f) => f.id === p.fontId)
      ? null
      : active;
  const row = (id: string, label: string): ReactNode => (
    <FontRow
      key={id}
      id={id}
      label={label}
      selected={active === id}
      onSelect={() => p.onSelect(id)}
    />
  );
  return (
    <View>
      {GROUPS.map((g, gi) => (
        <View key={g.category}>
          {gi > 0 ? <Divider /> : null}
          <Txt variant="overline" color="inkMuted" style={{ paddingTop: space.sm }}>
            {g.title}
          </Txt>
          {FONT_FAMILIES.filter((f) => f.category === g.category).map((f) => row(f.id, f.label))}
          {g.category === 'sans' && legacy ? row(legacy, familyLabel(legacy)) : null}
        </View>
      ))}
      {custom.length > 0 ? (
        <View>
          <Divider />
          <Txt variant="overline" color="inkMuted" style={{ paddingTop: space.sm }}>
            Imported
          </Txt>
          {custom.map((f) => (
            <FontRow
              key={f.id}
              id={f.id}
              label={f.displayName}
              selected={p.fontId === f.id}
              onSelect={() => p.onSelect(f.id)}
              onDelete={() => void remove(f.id)}
            />
          ))}
        </View>
      ) : null}
      <View style={{ paddingTop: space.md, gap: space.xs }}>
        <ActionButton
          variant="secondary"
          icon="plus"
          label="Import font"
          accessibilityLabel="Import .ttf / .otf font"
          testID="import-font"
          onPress={() => void doImport()}
        />
        {error ? (
          <Txt variant="meta" color="danger" testID="import-font-error">
            {error}
          </Txt>
        ) : (
          <Txt variant="caption" color="inkMuted">
            .ttf or .otf. Imported fonts stay on this device.
          </Txt>
        )}
      </View>
    </View>
  );
}
