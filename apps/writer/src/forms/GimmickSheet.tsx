import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { gimmickGlyph, layerRole } from '../editor/gimmick-look.ts';
import { ActionButton } from '../ui/ActionButton.tsx';
import { Glyph } from '../ui/Glyph.tsx';
import { Txt } from '../ui/Txt.tsx';
import { radius, space } from '../ui/tokens.ts';
import { Sheet } from '../ui/Sheet.tsx';
import { useTheme } from '../ui/theme.tsx';
import { initialDraft, resetDraft, setField, validateDraft } from './form-state.ts';
import type { GimmickSheetProps } from './gimmick-sheet-types.ts';
import { SchemaForm } from './SchemaForm.tsx';

function Banner({ text }: { text: string }): ReactNode {
  const { colors } = useTheme();
  return (
    <View style={[styles.banner, { backgroundColor: colors.dangerSoft }]}>
      <Glyph name="alert-circle" size={18} color="danger" />
      <Txt variant="meta" color="danger" style={styles.bannerText}>
        {text}
      </Txt>
    </View>
  );
}

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
    <Sheet
      visible={visible}
      leading={
        <Glyph name={gimmickGlyph(module.meta.id)} size={20} color={layerRole(module.meta.layer)} />
      }
      title={module.meta.name}
      subtitle={subtitle}
      onClose={p.onClose}
      testID="gimmick-sheet"
      footer={
        <>
          <ActionButton
            label="Reset to defaults"
            variant="ghost"
            quiet
            icon="rotate-ccw"
            testID="gimmick-reset"
            onPress={() => setDraft(resetDraft(module.schema))}
          />
          <ActionButton
            label="Save"
            testID="gimmick-save"
            disabled={!check.valid}
            onPress={() => {
              if (check.props) p.onSave(check.props);
            }}
          />
        </>
      }
    >
      {p.disabledInNovel ? (
        <Banner text="This gimmick is not enabled for this novel, so readers will not see it until you turn it on." />
      ) : null}
      {check.general.map((e) => (
        <Banner key={e} text={e} />
      ))}
      <SchemaForm
        fields={module.schema.fields}
        draft={draft}
        errors={check.byField}
        onChange={(key, value) => setDraft((d) => setField(d, key, value))}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.sm,
  },
  bannerText: { flex: 1 },
});
