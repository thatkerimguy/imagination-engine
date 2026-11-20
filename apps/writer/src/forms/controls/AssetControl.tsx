import { useState } from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { AssetKind } from '@kn/core';
import { ActionButton } from '../../ui/ActionButton.tsx';
import { Field } from '../../ui/Field.tsx';
import { space } from '../../ui/tokens.ts';
import { asString } from '../form-state.ts';
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
    <View style={{ gap: space.sm, alignItems: 'flex-start' }}>
      <View style={{ alignSelf: 'stretch' }}>
        <Field
          dense
          testID={`field-${field.key}`}
          accessibilityLabel={`${field.label} path`}
          value={path}
          onChangeText={onChange}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="assets/file-name"
          error={pickError ?? (errors.length > 0 ? ' ' : null)}
          hint="Files are bundled with the novel when you publish."
        />
      </View>
      <ActionButton
        label="Choose file"
        variant="secondary"
        compact
        icon="paperclip"
        accessibilityLabel={`Choose ${field.assetKind} file`}
        onPress={() => void pick()}
      />
    </View>
  );
}
