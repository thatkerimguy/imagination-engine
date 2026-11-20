// Font family picker rows (each rendered in its own typeface) plus custom-font import/delete.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useRepository } from '../store/context.tsx';
import { loadCustomFonts, type CustomFont } from '../store/writer-prefs.ts';
import { AppText } from '../ui/AppText.tsx';
import { Button } from '../ui/Button.tsx';
import { Icon } from '../ui/Icon.tsx';
import { IconButton } from '../ui/IconButton.tsx';
import { Muted } from '../ui/layout.tsx';
import { FONT_PRESETS, DEFAULT_FONT_ID } from './catalog.ts';
import { deleteCustomFont, importCustomFont, useFontFamily } from './loader';

const SAMPLE = 'The quick brown fox jumps over the lazy dog';

function FontRow(p: {
  id: string;
  label: string;
  selected: boolean;
  onSelect(): void;
  onDelete?(): void;
}): ReactNode {
  const family = useFontFamily(p.id);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable
        testID={`font-${p.id}`}
        accessibilityRole="radio"
        accessibilityState={{ selected: p.selected }}
        accessibilityLabel={p.label}
        onPress={p.onSelect}
        style={{ flex: 1, minHeight: 56, paddingVertical: 8, flexDirection: 'row', gap: 12 }}
      >
        <View style={{ flex: 1 }}>
          <AppText variant="labelLarge">{p.label}</AppText>
          <AppText variant="bodyLarge" numberOfLines={1} style={{ fontFamily: family }}>
            {SAMPLE}
          </AppText>
        </View>
        {p.selected ? <Icon name="check" color="primary" /> : null}
      </Pressable>
      {p.onDelete ? (
        <IconButton
          icon="delete-outline"
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
  const refresh = useCallback(() => void loadCustomFonts(repo).then(setCustom), [repo]);
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
  return (
    <View>
      {FONT_PRESETS.map((f) => (
        <FontRow
          key={f.id}
          id={f.id}
          label={f.label}
          selected={p.fontId === f.id}
          onSelect={() => p.onSelect(f.id)}
        />
      ))}
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
      <Button
        variant="tonal"
        icon="add"
        label="Import .ttf / .otf font"
        testID="import-font"
        onPress={() => void doImport()}
      />
      {error ? (
        <AppText variant="bodyMedium" color="error" testID="import-font-error">
          {error}
        </AppText>
      ) : (
        <Muted>Imported fonts stay on this device.</Muted>
      )}
    </View>
  );
}
