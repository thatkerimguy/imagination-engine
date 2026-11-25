// Non-skippable Publishing Terms of Use consent (Google Play UGC policy). Shown in the publish sheet
// before an author's first publish and again whenever CURRENT_TOS_VERSION changes. There is no skip:
// "Accept Terms & Continue" stays disabled until the consent toggle is on, and "Publish now" stays
// disabled until the terms are accepted.
import { useState, type ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { ActionButton } from '../ui/ActionButton.tsx';
import { CardGroup } from '../ui/CardGroup.tsx';
import { ListRow, SectionLabel } from '../ui/Page.tsx';
import { Toggle } from '../ui/Toggle.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { CURRENT_TOS_VERSION } from './publish-settings.ts';

const PROHIBITED = [
  'Hate speech or content that attacks people for who they are',
  'Harassment, bullying or threats',
  'Illegal or non-consensual content, including any sexual content involving minors',
  'Spam, scams or misleading content',
  'Work that infringes someone else’s copyright',
];

export interface PublishTosGateProps {
  /** Full Terms online (`<publish API>/legal/terms`); '' hides the link. */
  termsUrl: string;
  onAccept(): Promise<void>;
}

export function PublishTosGate(p: PublishTosGateProps): ReactNode {
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const accept = async (): Promise<void> => {
    setSaving(true);
    try {
      await p.onAccept();
    } finally {
      setSaving(false);
    }
  };
  return (
    <View style={styles.stack} testID="publish-tos-gate">
      <SectionLabel>{`Publishing Terms of Use · ${CURRENT_TOS_VERSION}`}</SectionLabel>
      <Txt variant="body" color="ink">
        Published chapters are public: anyone with the link can read them. Before you publish,
        please agree not to share:
      </Txt>
      <View style={styles.list}>
        {PROHIBITED.map((line) => (
          <Txt key={line} variant="meta" color="inkSecondary">
            {`•  ${line}`}
          </Txt>
        ))}
      </View>
      <Txt variant="meta" color="inkSecondary">
        Readers can report published work. Reported work is reviewed and may be taken down. You can
        unpublish your book at any time from this sheet.
      </Txt>
      <CardGroup>
        {p.termsUrl ? (
          <ListRow
            icon="external-link"
            title="Read the full Terms online"
            testID="publish-tos-link"
            onPress={() => void Linking.openURL(p.termsUrl)}
          />
        ) : null}
        <ListRow
          title="I agree to the Publishing Terms of Use"
          last
          trailing={
            <Toggle
              value={agreed}
              onValueChange={setAgreed}
              accessibilityLabel="I agree to the Publishing Terms of Use"
              testID="publish-tos-check"
            />
          }
        />
      </CardGroup>
      <ActionButton
        label={saving ? 'Saving…' : 'Accept Terms & Continue'}
        icon="check"
        variant="secondary"
        disabled={!agreed || saving}
        onPress={() => void accept()}
        testID="publish-tos-accept"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  list: { gap: space.xs },
});
