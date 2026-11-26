// Calm, skippable 3-step welcome tour. Persists nothing: the caller records the outcome.
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActionButton } from '../ui/ActionButton.tsx';
import { Glyph } from '../ui/Glyph.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { Txt } from '../ui/Txt.tsx';
import { radius, space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import { TOUR_STEPS, type OnboardingOutcome } from './onboarding-state.ts';

export interface WelcomeTourSheetProps {
  visible: boolean;
  onClose(reason: OnboardingOutcome): void;
  onOpenPreview(): void;
  onNewNovel(): void;
  onImport(): void;
  onRestore(): void;
}

export function WelcomeTourSheet(p: WelcomeTourSheetProps): ReactNode {
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (p.visible) setIndex(0);
  }, [p.visible]);
  const step = TOUR_STEPS[index] ?? TOUR_STEPS[0]!;
  const last = index === TOUR_STEPS.length - 1;

  const footer = (
    <View style={styles.footer}>
      <View style={styles.dots} accessibilityLabel={`Step ${index + 1} of ${TOUR_STEPS.length}`}>
        {TOUR_STEPS.map((s, i) => (
          <View
            key={s.id}
            style={[styles.dot, { backgroundColor: i === index ? colors.accent : colors.hairline }]}
          />
        ))}
      </View>
      <View style={styles.nav}>
        {index > 0 ? (
          <ActionButton
            variant="ghost"
            label="Back"
            onPress={() => setIndex(index - 1)}
            testID="welcome-back"
          />
        ) : null}
        <ActionButton
          label={last ? 'Done' : 'Next'}
          onPress={() => (last ? p.onClose('completed') : setIndex(index + 1))}
          testID="welcome-next"
        />
      </View>
    </View>
  );

  return (
    <Sheet
      visible={p.visible}
      title="Welcome"
      onClose={() => p.onClose('dismissed')}
      footer={footer}
      leading={
        <ActionButton
          compact
          variant="ghost"
          label="Skip"
          onPress={() => p.onClose('dismissed')}
          testID="welcome-skip"
        />
      }
      testID="welcome-tour"
    >
      <View style={styles.body}>
        <Glyph name={step.icon} size={32} color="accent" />
        <Txt variant="heading">{step.title}</Txt>
        <Txt variant="body" color="inkSecondary">
          {step.body}
        </Txt>
        {step.id === 'preview' ? (
          <ActionButton
            icon="play"
            label="Open Live Preview"
            onPress={p.onOpenPreview}
            testID="welcome-open-preview"
          />
        ) : null}
        {step.id === 'start' ? (
          <View style={styles.actions}>
            <ActionButton
              icon="plus"
              label="New novel"
              onPress={p.onNewNovel}
              testID="welcome-new-novel"
            />
            <ActionButton
              variant="secondary"
              icon="file-text"
              label="Import .docx / .md / .txt"
              onPress={p.onImport}
              testID="welcome-import"
            />
            <ActionButton
              variant="secondary"
              icon="rotate-ccw"
              label="Restore backup"
              onPress={p.onRestore}
              testID="welcome-restore"
            />
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.sm, paddingVertical: space.xs },
  actions: { gap: space.xs },
  footer: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  dots: { flexDirection: 'row', gap: space.xs },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  nav: { flexDirection: 'row', gap: space.xs },
});
