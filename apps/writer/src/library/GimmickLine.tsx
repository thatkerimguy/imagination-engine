import type { ReactNode } from 'react';
import { enabledWriterModules } from '../modules/registry.ts';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';

/** Inline muted summary of enabled modules (`Ambience · 3D Dice`); tapping opens novel settings. */
export function GimmickLine({
  enabled,
  onPress,
}: {
  enabled: readonly string[];
  onPress(): void;
}): ReactNode {
  const names = enabledWriterModules(enabled).map((m) => m.meta.name);
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Gimmick modules"
      testID="outline-gimmicks"
      style={{ minHeight: 44, justifyContent: 'center' }}
    >
      <Txt variant="meta" color="inkMuted" numberOfLines={2}>
        {names.length ? names.join(' · ') : 'No gimmicks yet'}
      </Txt>
    </Press>
  );
}
