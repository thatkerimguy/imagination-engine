import { useState } from 'react';
import type { ReactNode } from 'react';
import { Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { AssetKind } from '@kn/core';
import { Button } from '../../ui/Button.tsx';
import { colors } from '../../ui/legacy-theme.ts';
import { asString } from '../form-state.ts';
import { controlStyles as s } from './styles.ts';
import type { ControlProps } from './types.ts';

const MIME: Record<AssetKind, string[]> = {
  audio: ['audio/*'],
  image: ['image/*'],
  model: ['model/gltf-binary', 'model/gltf+json', 'application/octet-stream'],
};

export function AssetControl({ field, value, onChange, errors }: ControlProps<'asset'>): ReactNode {
  const path = asString(value);
  const [pickError, setPickError] = useState<string | null>(null);

  const pick = async (): Promise<void> => {
    setPickError(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: MIME[field.assetKind],
        copyToCacheDirectory: true,
      });
      const name = res.canceled ? undefined : res.assets[0]?.name;
      if (name) onChange(`assets/${name}`);
    } catch {
      setPickError('Could not open the file picker.');
    }
  };

  return (
    <View style={s.stack}>
      <Button label={`Choose ${field.assetKind} file`} onPress={() => void pick()} />
      <TextInput
        testID={`field-${field.key}`}
        accessibilityLabel={`${field.label} path`}
        value={path}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="assets/file-name"
        placeholderTextColor={colors.muted}
        style={[s.input, errors.length > 0 && s.invalid]}
      />
      {pickError ? <Text style={{ color: colors.danger, fontSize: 12 }}>{pickError}</Text> : null}
      <Text style={s.help}>Files are bundled with the novel when you publish (Phase 3).</Text>
    </View>
  );
}
