// Help & Legal: module guide, formatting, backup, licenses, legal links. Fully offline except
// the external legal links. Replay welcome tour resets the onboarding flag.
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, View } from 'react-native';
import { ShortcutsSheet } from '../editor/ShortcutsSheet.tsx';
import { FormattingSection } from '../help/FormattingSection.tsx';
import { GimmickGuideSection } from '../help/GimmickGuideSection.tsx';
import { BackupSection, WhatsNewSection } from '../help/HelpSections.tsx';
import {
  DEFAULT_LEGAL_BASE,
  legalUrl,
  PRIVACY_SUMMARY,
  TERMS_SUMMARY,
  type LegalPage,
} from '../help/help-content.ts';
import { LicensesSheet } from '../help/LicensesSheet.tsx';
import { markOnboarding, resetOnboarding } from '../onboarding/onboarding-state.ts';
import { useTourActions } from '../onboarding/use-tour-actions.ts';
import { WelcomeTourSheet } from '../onboarding/WelcomeTourSheet.tsx';
import { loadPublishConfig } from '../publish/publish-settings.ts';
import { routes } from '../routes.ts';
import { useRepository } from '../store/context.tsx';
import { CardGroup } from '../ui/CardGroup.tsx';
import { ListRow, Page, SectionLabel } from '../ui/Page.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';

const LEGAL_ROWS: readonly { page: LegalPage; title: string }[] = [
  { page: 'terms', title: 'Terms of service' },
  { page: 'privacy', title: 'Privacy policy' },
  { page: 'takedown', title: 'Takedown requests' },
];

export default function HelpScreen(): ReactNode {
  const repo = useRepository();
  const router = useRouter();
  const [apiUrl, setApiUrl] = useState('');
  const [shortcuts, setShortcuts] = useState(false);
  const [licenses, setLicenses] = useState(false);
  const [tour, setTour] = useState(false);

  useEffect(() => {
    void loadPublishConfig(repo).then((c) => setApiUrl(c.apiUrl));
  }, [repo]);

  const replay = (): void => {
    void resetOnboarding(repo).then(() => setTour(true));
  };
  const closeTour = (reason: 'completed' | 'dismissed'): void => {
    setTour(false);
    void markOnboarding(repo, reason);
  };
  const tourActions = useTourActions(() => closeTour('completed'));

  return (
    <Page testID="help-screen">
      <Stack.Screen options={{ title: 'Help & Legal' }} />
      <View style={{ gap: space.xl }}>
        <GimmickGuideSection />
        <FormattingSection onOpenShortcuts={() => setShortcuts(true)} onReplayTour={replay} />
        <BackupSection />
        <WhatsNewSection />
        <View style={{ gap: space.xs }}>
          <SectionLabel>Licenses</SectionLabel>
          <CardGroup>
            <ListRow
              icon="award"
              title="Open-source & font licenses"
              onPress={() => setLicenses(true)}
              last
              testID="help-licenses"
            />
          </CardGroup>
        </View>
        <View style={{ gap: space.xs }}>
          <SectionLabel>Legal & diagnostics</SectionLabel>
          <Txt variant="meta" color="inkSecondary">
            {PRIVACY_SUMMARY}
          </Txt>
          <Txt variant="meta" color="inkSecondary">
            {TERMS_SUMMARY}
          </Txt>
          <CardGroup>
            {LEGAL_ROWS.map((r) => {
              const url = legalUrl(apiUrl, r.page) || legalUrl(DEFAULT_LEGAL_BASE, r.page);
              return (
                <ListRow
                  key={r.page}
                  icon="external-link"
                  title={r.title}
                  detail={url ? undefined : 'Set a Publish API URL in Settings'}
                  onPress={url ? () => void Linking.openURL(url) : undefined}
                  testID={`help-legal-${r.page}`}
                />
              );
            })}
            <ListRow
              icon="activity"
              title="Document Doctor"
              onPress={() => router.push(routes.doctor)}
              last
              testID="help-open-doctor"
            />
          </CardGroup>
        </View>
      </View>
      <ShortcutsSheet visible={shortcuts} onClose={() => setShortcuts(false)} />
      <LicensesSheet visible={licenses} onClose={() => setLicenses(false)} />
      <WelcomeTourSheet visible={tour} onClose={closeTour} {...tourActions} />
    </Page>
  );
}
