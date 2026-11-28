// Edit sheet for a v2 cue: the BlueprintForm in a Folio sheet; Done saves valid props to the block.
import type { ChapterDocument, ModuleBlock } from '@kn/core';
import { useRef, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { MIN_TOUCH } from '../ui/a11y.ts';
import { Glyph } from '../ui/Glyph.tsx';
import { ActionButton } from '../ui/ActionButton.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { replaceBlock } from '../store/chapter-ops.ts';
import { BlueprintForm } from './BlueprintForm.tsx';
import { cueBlueprintId, cueFieldProps, starterCueBlueprint } from './cue.ts';
import { useBlueprint } from './use-catalog.ts';

export function CueSheet(p: {
  block: ModuleBlock;
  update(fn: (c: ChapterDocument) => ChapterDocument): void;
  onDone(): void;
}): ReactNode {
  const { t } = useI18n();
  const bp = useBlueprint(cueBlueprintId(p.block.props), starterCueBlueprint(p.block.props));
  const latest = useRef<Record<string, unknown> | null>(null);
  const [valid, setValid] = useState(true);
  const done = (): void => {
    const props = latest.current;
    if (props && bp)
      p.update((c) => replaceBlock(c, { ...p.block, moduleVersion: bp.version, props }));
    p.onDone();
  };
  return (
    <Sheet
      visible
      title={bp?.name ?? t('cue.unknown', { id: cueBlueprintId(p.block.props) ?? '?' })}
      subtitle={bp?.tagline}
      leading={<Glyph name="zap" size={20} color="accent" />}
      onClose={p.onDone}
      testID="cue-sheet"
      footer={
        <ActionButton
          label={t('form.done')}
          disabled={!valid}
          onPress={done}
          testID="cue-sheet-done"
          style={styles.done}
        />
      }
    >
      {bp ? (
        <BlueprintForm
          key={bp.id}
          blueprint={bp}
          initialProps={cueFieldProps(p.block.props)}
          onChange={(props) => {
            latest.current = props;
            setValid(props !== null);
          }}
        />
      ) : null}
    </Sheet>
  );
}

// Full-width primary footer action, at least 48 dp tall.
const styles = StyleSheet.create({ done: { flex: 1, height: MIN_TOUCH } });
