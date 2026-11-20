// Multiline input that grows with its content on every platform (RN Web does not auto-size).
import { useState, type ReactNode } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

export function GrowingTextInput({
  minHeight = 26,
  style,
  onContentSizeChange,
  ...props
}: TextInputProps & { minHeight?: number }): ReactNode {
  const [height, setHeight] = useState(minHeight);
  return (
    <TextInput
      multiline
      scrollEnabled={false}
      {...props}
      onContentSizeChange={(e) => {
        setHeight(Math.max(minHeight, Math.ceil(e.nativeEvent.contentSize.height)));
        onContentSizeChange?.(e);
      }}
      style={[style, { height }]}
    />
  );
}
