// "Tags & Color" sheet for any item (folder, note, chapter, book): tags as quiet #text, the
// colour rail, Pin and Lock, a synopsis and a word goal. Every change saves straight away.
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRepository } from '../store/context.tsx';
import {
  loadItemMeta,
  normalizeTag,
  RAIL_COLORS,
  updateItemMeta,
  type ItemMeta,
} from '../store/item-meta.ts';
import { Field } from '../ui/Field.tsx';
import { Glyph } from '../ui/Glyph.tsx';
import { Press } from '../ui/Press.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { Stepper } from '../ui/Stepper.tsx';
import { Toggle } from '../ui/Toggle.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import { hitSlopFor, MIN_TOUCH } from '../ui/a11y.ts';

export interface ItemMetaSheetProps {
  visible: boolean;
  itemId: string;
  title: string;
  onClose(): void;
}

const EMPTY: ItemMeta = { tags: [] };

function ToggleRow(p: {
  label: string;
  hint: string;
  value: boolean;
  onChange(v: boolean): void;
  testID: string;
}): ReactNode {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.grow}>
        <Txt variant="body">{p.label}</Txt>
        <Txt variant="meta" color="inkSecondary">
          {p.hint}
        </Txt>
      </View>
      <Toggle
        value={p.value}
        onValueChange={p.onChange}
        accessibilityLabel={p.label}
        testID={p.testID}
      />
    </View>
  );
}

export function ItemMetaSheet(p: ItemMetaSheetProps): ReactNode {
  const repo = useRepository();
  const { colors } = useTheme();
  const [meta, setMeta] = useState<ItemMeta>(EMPTY);
  const [tagText, setTagText] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const { visible, itemId } = p;

  useEffect(() => {
    if (!visible) return;
    let live = true;
    void loadItemMeta(repo, itemId).then((m) => {
      if (!live) return;
      setMeta(m);
      setSynopsis(m.synopsis ?? '');
      setTagText('');
    });
    return () => {
      live = false;
    };
  }, [repo, itemId, visible]);

  const save = (patch: Parameters<typeof updateItemMeta>[2]): void => {
    void updateItemMeta(repo, itemId, patch).then(setMeta);
  };
  const commitTags = (text: string): void => {
    const added = text
      .split(/[,\s]+/)
      .map(normalizeTag)
      .filter(Boolean);
    setTagText('');
    if (added.length) save({ tags: [...new Set([...meta.tags, ...added])] });
  };
  const onTagText = (text: string): void => {
    if (/[,\s]$/.test(text)) commitTags(text);
    else setTagText(text);
  };

  return (
    <Sheet
      visible={visible}
      title="Tags & Color"
      subtitle={p.title}
      onClose={p.onClose}
      testID="item-meta-sheet"
    >
      <View style={styles.block}>
        <Field
          label="Tags"
          value={tagText}
          onChangeText={onTagText}
          onSubmitEditing={() => commitTags(tagText)}
          onBlur={() => commitTags(tagText)}
          placeholder="Add a tag, then space or comma"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          testID="meta-tags"
        />
        {meta.tags.length ? (
          <View style={styles.tags}>
            {meta.tags.map((t) => (
              <Press
                key={t}
                accessibilityRole="button"
                accessibilityLabel={`Remove tag ${t}`}
                onPress={() => save({ tags: meta.tags.filter((x) => x !== t) })}
                testID={`meta-tag-${t}`}
                hitSlop={hitSlopFor(MIN_TOUCH, 32)}
                style={styles.tag}
              >
                <Txt variant="meta" color="inkSecondary">{`#${t}`}</Txt>
              </Press>
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.block}>
        <Txt variant="label" color="inkSecondary">
          Colour rail
        </Txt>
        <View style={styles.swatches}>
          <Press
            accessibilityRole="button"
            accessibilityLabel="No colour"
            onPress={() => save({ color: undefined })}
            wash={null}
            testID="meta-color-none"
            style={[styles.swatch, { borderColor: colors.borderStrong }]}
          >
            <Glyph name="slash" size={14} color="inkMuted" />
          </Press>
          {RAIL_COLORS.map((c) => (
            <Press
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`Colour ${c}`}
              accessibilityState={{ selected: meta.color === c }}
              onPress={() => save({ color: c })}
              wash={null}
              testID={`meta-color-${c.slice(1)}`}
              style={[
                styles.swatch,
                { backgroundColor: c, borderColor: meta.color === c ? colors.ink : c },
              ]}
            >
              {meta.color === c ? <Glyph name="check" size={14} color="onAccent" /> : null}
            </Press>
          ))}
        </View>
      </View>
      <ToggleRow
        label="Pin to top"
        hint="Pinned items always sort first."
        value={meta.pinned === true}
        onChange={(v) => save({ pinned: v ? true : undefined })}
        testID="meta-pin"
      />
      <ToggleRow
        label="Lock"
        hint="Hides the contents and keeps them out of search until unlocked."
        value={meta.locked === true}
        onChange={(v) => save({ locked: v ? true : undefined })}
        testID="meta-lock"
      />
      <Field
        label="Synopsis"
        value={synopsis}
        onChangeText={setSynopsis}
        onBlur={() => save({ synopsis: synopsis.trim() ? synopsis : undefined })}
        multiline
        placeholder="A line or two about this item"
        testID="meta-synopsis"
      />
      <View style={styles.toggleRow}>
        <View style={styles.grow}>
          <Txt variant="body">Word goal</Txt>
          <Txt variant="meta" color="inkSecondary">
            0 means no goal.
          </Txt>
        </View>
        <Stepper
          value={meta.wordGoal ?? 0}
          min={0}
          max={1_000_000}
          step={250}
          label="word goal"
          compact
          onChange={(v) => save({ wordGoal: v > 0 ? v : undefined })}
          testID="meta-goal"
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.xs },
  grow: { flex: 1, gap: 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.sm },
  tag: { minHeight: 32, justifyContent: 'center' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
