// Shows the Welcome tour once on a fresh workspace (only the demo novel, never dismissed or
// completed). Users with their own manuscripts or a restored backup never see it.
import { useEffect, useState, type ReactNode } from 'react';
import { useRepository } from '../store/context.tsx';
import {
  hasUserNovels,
  loadOnboarding,
  markOnboarding,
  shouldShowOnboarding,
  type OnboardingOutcome,
} from './onboarding-state.ts';
import { useTourActions } from './use-tour-actions.ts';
import { WelcomeTourSheet } from './WelcomeTourSheet.tsx';

export function OnboardingLauncher({
  novelIds,
}: {
  novelIds: readonly string[] | null;
}): ReactNode {
  const repo = useRepository();
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (!novelIds || checked) return;
    setChecked(true);
    void loadOnboarding(repo).then((settings) => {
      if (shouldShowOnboarding({ hasUserNovels: hasUserNovels(novelIds), settings }))
        setVisible(true);
    });
  }, [novelIds, checked, repo]);
  const close = (reason: OnboardingOutcome): void => {
    setVisible(false);
    void markOnboarding(repo, reason);
  };
  const actions = useTourActions(() => close('completed'));
  return <WelcomeTourSheet visible={visible} onClose={close} {...actions} />;
}
