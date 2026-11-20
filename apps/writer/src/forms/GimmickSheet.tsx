// STUB — replaced by the SchemaForm builder task. Keep the exported name and props.
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet.tsx';
import type { GimmickSheetProps } from './gimmick-sheet-types.ts';

export function GimmickSheet(p: GimmickSheetProps): ReactNode {
  return (
    <BottomSheet visible={p.visible} title={p.module.meta.name} onClose={p.onClose}>
      <Text>Schema form goes here</Text>
    </BottomSheet>
  );
}
