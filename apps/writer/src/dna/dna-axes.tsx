// The seven fine-tuning axes of the Visual DNA Studio: steppers for numbers, wrapped option
// chips for enums. Every label comes from i18n; chips wrap so tr/es never overflow at 360 dp.
import {
  ATMOSPHERES,
  FONT_VOICES,
  MOTION_PERSONALITIES,
  ORNAMENT_GRAMMARS,
  RADII,
  SONIC_TIMBRES,
  SURFACE_MATERIALS,
  TRACKINGS,
  type BookVisualDna,
} from '@kn/core/dna';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { ListRow } from '../ui/Page.tsx';
import { Toggle } from '../ui/Toggle.tsx';
import { Choice, Group, Num } from './dna-controls.tsx';
import { patchDna } from './dna-store.ts';

export interface AxesProps {
  dna: BookVisualDna;
  onChange(next: BookVisualDna): void;
}

export function DnaAxes({ dna, onChange }: AxesProps): ReactNode {
  const { t } = useI18n();
  const {
    palette: p,
    typography: ty,
    surface: s,
    ornament: o,
    motion: m,
    atmosphere: a,
    sonic: so,
  } = dna;
  return (
    <View testID="dna-axes">
      <Group title="dna.axis.palette">
        <Num
          id="hue"
          label="dna.hue"
          value={p.hue}
          min={0}
          max={360}
          step={5}
          onChange={(hue) => onChange(patchDna(dna, 'palette', { hue }))}
        />
        <Num
          id="chroma"
          label="dna.chroma"
          value={p.chroma}
          min={0}
          max={0.37}
          step={0.01}
          onChange={(chroma) => onChange(patchDna(dna, 'palette', { chroma }))}
        />
        <Num
          id="warmth"
          label="dna.warmth"
          value={p.warmth}
          min={-1}
          max={1}
          step={0.1}
          onChange={(warmth) => onChange(patchDna(dna, 'palette', { warmth }))}
        />
        <Num
          id="secondary"
          label="dna.secondaryHue"
          value={p.secondaryHue}
          min={0}
          max={360}
          step={5}
          onChange={(secondaryHue) => onChange(patchDna(dna, 'palette', { secondaryHue }))}
        />
        <ListRow
          title={t('dna.highContrast')}
          last
          trailing={
            <Toggle
              value={p.contrastMode === 'high'}
              accessibilityLabel={t('dna.highContrast')}
              testID="dna-contrast-mode"
              onValueChange={(on) =>
                onChange(patchDna(dna, 'palette', { contrastMode: on ? 'high' : 'balanced' }))
              }
            />
          }
        />
      </Group>
      <Group title="dna.axis.typography">
        <Choice
          id="display"
          label="dna.display"
          prefix="dna.font"
          values={FONT_VOICES}
          value={ty.display}
          onPick={(display) => onChange(patchDna(dna, 'typography', { display }))}
        />
        <Choice
          id="prose"
          label="dna.prose"
          prefix="dna.font"
          values={FONT_VOICES}
          value={ty.prose}
          onPick={(prose) => onChange(patchDna(dna, 'typography', { prose }))}
        />
        <Choice
          id="diegetic"
          label="dna.diegetic"
          prefix="dna.font"
          values={FONT_VOICES}
          value={ty.diegetic}
          onPick={(diegetic) => onChange(patchDna(dna, 'typography', { diegetic }))}
        />
        <Choice
          id="tracking"
          label="dna.tracking"
          prefix="dna.tracking"
          values={TRACKINGS}
          value={ty.tracking}
          onPick={(tracking) => onChange(patchDna(dna, 'typography', { tracking }))}
        />
      </Group>
      <Group title="dna.axis.surface">
        <Choice
          id="material"
          label="dna.material"
          prefix="dna.material"
          values={SURFACE_MATERIALS}
          value={s.material}
          onPick={(material) => onChange(patchDna(dna, 'surface', { material }))}
        />
        <Num
          id="grain"
          label="dna.grain"
          value={s.grainIntensity}
          min={0}
          max={1}
          step={0.05}
          onChange={(grainIntensity) => onChange(patchDna(dna, 'surface', { grainIntensity }))}
        />
      </Group>
      <Group title="dna.axis.ornament">
        <Choice
          id="grammar"
          label="dna.grammar"
          prefix="dna.grammar"
          values={ORNAMENT_GRAMMARS}
          value={o.grammar}
          onPick={(grammar) => onChange(patchDna(dna, 'ornament', { grammar }))}
        />
        <Choice
          id="radius"
          label="dna.radius"
          prefix="dna.radiusOpt"
          values={RADII}
          value={o.radius}
          onPick={(radius) => onChange(patchDna(dna, 'ornament', { radius }))}
        />
        <Num
          id="stroke"
          label="dna.stroke"
          value={o.strokeWidth}
          min={0.5}
          max={4}
          step={0.5}
          onChange={(strokeWidth) => onChange(patchDna(dna, 'ornament', { strokeWidth }))}
        />
      </Group>
      <Group title="dna.axis.motion">
        <Choice
          id="personality"
          label="dna.personality"
          prefix="dna.motionOpt"
          values={MOTION_PERSONALITIES}
          value={m.personality}
          onPick={(personality) => onChange(patchDna(dna, 'motion', { personality }))}
        />
        <Num
          id="tempo"
          label="dna.tempo"
          value={m.tempo}
          min={0.5}
          max={2}
          step={0.1}
          onChange={(tempo) => onChange(patchDna(dna, 'motion', { tempo }))}
        />
      </Group>
      <Group title="dna.axis.atmosphere">
        <Choice
          id="atmo"
          label="dna.atmoStyle"
          prefix="dna.atmoOpt"
          values={ATMOSPHERES}
          value={a.style}
          onPick={(style) => onChange(patchDna(dna, 'atmosphere', { style }))}
        />
        <Num
          id="atmo-intensity"
          label="dna.intensity"
          value={a.intensity}
          min={0}
          max={1}
          step={0.05}
          onChange={(intensity) => onChange(patchDna(dna, 'atmosphere', { intensity }))}
        />
      </Group>
      <Group title="dna.axis.sonic">
        <Choice
          id="timbre"
          label="dna.timbre"
          prefix="dna.timbreOpt"
          values={SONIC_TIMBRES}
          value={so.timbre}
          onPick={(timbre) => onChange(patchDna(dna, 'sonic', { timbre }))}
        />
        <Num
          id="gain"
          label="dna.gain"
          value={so.gain}
          min={0}
          max={1}
          step={0.05}
          onChange={(gain) => onChange(patchDna(dna, 'sonic', { gain }))}
        />
      </Group>
    </View>
  );
}
