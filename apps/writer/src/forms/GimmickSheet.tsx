import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { AppText } from '../ui/AppText.tsx';
import { BottomSheet } from '../ui/BottomSheet.tsx';
import { Button } from '../ui/Button.tsx';
import { Icon } from '../ui/Icon.tsx';
import { IconBadge } from '../ui/layout.tsx';
import { shape, space } from '../ui/m3-tokens.ts';
import { makeStyles } from '../ui/theme.tsx';
import { initialDraft, resetDraft, setField, validateDraft } from './form-state.ts';
import type { GimmickSheetProps } from './gimmick-sheet-types.ts';
import { SchemaForm } from './SchemaForm.tsx';

function Banner({ text }: { text: string }): ReactNode {
  const s = useStyles();
  return (
    <View style={s.banner}>
      <Icon name="error-outline" size={20} color="onErrorContainer" />
      <AppText variant="bodyMedium" color="onErrorContainer" style={s.bannerText}>
        {text}
      </AppText>
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
    <BottomSheet
      visible={visible}
      leading={<IconBadge glyph={module.meta.icon} />}
      title={module.meta.name}
      subtitle={subtitle}
      onClose={p.onClose}
      testID="gimmick-sheet"
      footer={
        <>
          <Button
            label="Reset to defaults"
            variant="text"
            icon="restart-alt"
            testID="gimmick-reset"
            onPress={() => setDraft(resetDraft(module.schema))}
          />
          <Button
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
    </BottomSheet>
  );
}

const useStyles = makeStyles((t) => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: shape.medium,
    backgroundColor: t.colors.errorContainer,
  },
  bannerText: { flex: 1 },
}));
