// Settings › Publishing & Web › Web Publishing & API: Publish API URL, author token, public reader
// URL + Test connection, and the Live Preview reader source. Page wraps a KeyboardAwareScrollView
// (PageScroll) so focused fields always clear the IME.
import type { ReactNode } from 'react';
import { PublishSettingsCard } from '../publish/PublishSettingsCard.tsx';
import { LivePreviewCard } from '../settings/LivePreviewCard.tsx';
import { Page } from '../ui/Page.tsx';

export default function PublishingSettingsScreen(): ReactNode {
  return (
    <Page testID="settings-publishing-screen" keyboardShouldPersistTaps="handled">
      <PublishSettingsCard />
      <LivePreviewCard />
    </Page>
  );
}
