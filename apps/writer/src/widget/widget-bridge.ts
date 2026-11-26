// Hands the widget payload to the native KnWidget module (plugins/android-widget.js), which
// stores it in the `kn_writer_widget` SharedPreferences and broadcasts APPWIDGET_UPDATE.
// A no-op on iOS, in Expo Go, and wherever the native module is missing.
import { NativeModules, Platform } from 'react-native';
import type { WidgetPayload } from './widget-state.ts';

interface KnWidgetNative {
  updateWidget(
    headline: string,
    subline: string,
    todayWordsLabel: string,
    deepLinkUri: string,
  ): void;
}

export function pushWidget(p: WidgetPayload): void {
  if (Platform.OS !== 'android') return;
  const native = (NativeModules as { KnWidget?: KnWidgetNative }).KnWidget;
  try {
    native?.updateWidget(p.headline, p.subline, p.todayWordsLabel, p.deepLinkUri);
  } catch (err) {
    console.warn('[writer] widget update failed', err);
  }
}
