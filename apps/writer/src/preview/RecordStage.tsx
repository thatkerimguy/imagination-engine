// 9:16 Record Mode for Live Preview (`/preview?…&record=9x16`, DIRECTIVE-07 C): the reader is
// framed in a centred 9:16 box on black so the author can capture BookTok / Reels video with
// Android's built-in screen recorder (reader audio is capturable: ALLOW_AUDIO_PLAYBACK_CAPTURE).
// "Hide controls" removes the header and tier bar; tapping the black letterbox brings them back.
import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { IconBtn } from '../ui/IconBtn.tsx';
import { Press } from '../ui/Press.tsx';
import { space } from '../ui/tokens.ts';

export const RECORD_ASPECT = 9 / 16;

/** The largest 9:16 box that fits in `w × h`. Pure. */
export function fitNineBySixteen(w: number, h: number): { width: number; height: number } {
  if (w <= 0 || h <= 0) return { width: 0, height: 0 };
  return w / h > RECORD_ASPECT
    ? { width: Math.round(h * RECORD_ASPECT), height: h }
    : { width: w, height: Math.round(w / RECORD_ASPECT) };
}

export function RecordStage(p: {
  chrome: boolean;
  onChrome(visible: boolean): void;
  children: ReactNode;
}): ReactNode {
  const [area, setArea] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent): void => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ width, height });
  };
  const box = fitNineBySixteen(area.width, area.height);
  return (
    <View style={styles.stage} onLayout={onLayout} testID="preview-record-stage">
      <Press
        accessibilityRole="button"
        accessibilityLabel={p.chrome ? 'Hide controls' : 'Show controls'}
        onPress={() => p.onChrome(!p.chrome)}
        style={StyleSheet.absoluteFill}
        testID="preview-record-letterbox"
      />
      <View style={[styles.box, box]} testID="preview-record-frame">
        {p.children}
      </View>
      {p.chrome ? (
        <View style={styles.hide}>
          <IconBtn
            icon="maximize"
            accessibilityLabel="Hide controls for recording"
            onPress={() => p.onChrome(false)}
            testID="preview-record-hide"
          />
        </View>
      ) : null}
    </View>
  );
}

/** RecordStage only while recording; otherwise the children as-is. */
export function RecordWrap(p: {
  recording: boolean;
  chrome: boolean;
  onChrome(v: boolean): void;
  children: ReactNode;
}): ReactNode {
  if (!p.recording) return p.children;
  return (
    <RecordStage chrome={p.chrome} onChrome={p.onChrome}>
      {p.children}
    </RecordStage>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  box: { overflow: 'hidden' },
  hide: { position: 'absolute', right: space.sm, bottom: space.sm },
});
