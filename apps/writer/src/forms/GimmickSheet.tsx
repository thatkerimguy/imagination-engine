import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../ui/Button.tsx';
import { BottomSheet } from '../ui/BottomSheet.tsx';
import { colors, radius, space } from '../ui/theme.ts';
import { initialDraft, resetDraft, setField, validateDraft } from './form-state.ts';
import type { GimmickSheetProps } from './gimmick-sheet-types.ts';
import { SchemaForm } from './SchemaForm.tsx';

export function GimmickSheet(p: GimmickSheetProps): ReactNode {
  const { module, visible, initialProps } = p;
  const [draft, setDraft] = useState(() => initialDraft(module.schema, initialProps));

  // Re-initialise from the block's stored props every time the sheet opens.
  useEffect(() => {
    if (visible) setDraft(initialDraft(module.schema, initialProps));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reopening should reset edits
  }, [visible, module.meta.id]);

  const check = useMemo(() => validateDraft(module.schema, draft), [module.schema, draft]);
  const subtitle = module.summarize(draft).subtitle || module.meta.description;

  return (
    <BottomSheet
      visible={visible}
      title={`${module.meta.icon} ${module.meta.name}`}
      subtitle={subtitle}
      onClose={p.onClose}
      testID="gimmick-sheet"
      footer={
        <>
          <Button
            label="Reset to defaults"
            testID="gimmick-reset"
            onPress={() => setDraft(resetDraft(module.schema))}
            style={styles.flex}
          />
          <Button
            label="Save"
            variant="primary"
            testID="gimmick-save"
            disabled={!check.valid}
            onPress={() => {
              if (check.props) p.onSave(check.props);
            }}
            style={styles.flex}
          />
        </>
      }
    >
      {p.disabledInNovel ? (
        <View style={styles.warn}>
          <Text style={styles.warnText}>
            This gimmick is not enabled for this novel, so readers will not see it until you turn it
            on.
          </Text>
        </View>
      ) : null}
      {check.general.map((e) => (
        <Text key={e} style={styles.error}>
          {e}
        </Text>
      ))}
      <SchemaForm
        fields={module.schema.fields}
        draft={draft}
        errors={check.byField}
        onChange={(key, value) => setDraft((d) => setField(d, key, value))}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  warn: {
    borderWidth: 1,
    borderColor: colors.warn,
    borderRadius: radius.md,
    padding: space.md,
  },
  warnText: { color: colors.warn, fontSize: 13 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});
