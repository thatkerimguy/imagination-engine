import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Icon } from '../ui/Icon.tsx';
import { space } from '../ui/m3-tokens.ts';
import { TextField } from '../ui/TextField.tsx';
import { makeStyles } from '../ui/theme.tsx';
import type { InlineEditorProps, SceneBreakBlock } from './block-types.ts';

const useStyles = makeStyles((t) => ({
  wrap: { gap: space.sm, paddingVertical: space.sm },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  line: { flex: 1, height: 1, backgroundColor: t.colors.outlineVariant },
}));

export function SceneBreakEditor(p: InlineEditorProps<SceneBreakBlock>): ReactNode {
  const s = useStyles();
  return (
    <View style={s.wrap}>
      <View style={s.divider}>
        <View style={s.line} />
        <Icon name="diamond" size={20} color="primary" />
        <View style={s.line} />
      </View>
      <TextField
        dense
        label="Label"
        value={p.block.label ?? ''}
        onFocus={p.onSelect}
        onChangeText={(label) => p.onChange({ ...p.block, label })}
        placeholder="Label (optional)"
      />
      <TextField
        dense
        label="Timestamp"
        value={p.block.timestamp ?? ''}
        onFocus={p.onSelect}
        onChangeText={(timestamp) => p.onChange({ ...p.block, timestamp })}
        placeholder="Timestamp (optional)"
      />
    </View>
  );
}
