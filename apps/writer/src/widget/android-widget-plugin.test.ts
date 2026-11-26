// DIRECTIVE-07 E: the widget plugin registers exactly one exported receiver, push-only
// (updatePeriodMillis="0"), and its RemoteViews never read anything but the JS-redacted payload.
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

interface Node {
  $?: Record<string, string>;
  receiver?: Node[];
  'intent-filter'?: { action: Node[] }[];
  'meta-data'?: Node[];
}
interface Manifest {
  application?: Node[];
}

const require = createRequire(import.meta.url);
const plugin = require('../../plugins/android-widget.js') as {
  addWidgetReceiver: (m: Manifest) => Manifest;
  PREFS: string;
};
const res = require('../../plugins/android-widget-res.js') as {
  WIDGET_RES: Record<string, string>;
};

describe('android-widget plugin', () => {
  it('adds the provider receiver once, idempotently', () => {
    const m: Manifest = { application: [{ $: {} }] };
    plugin.addWidgetReceiver(plugin.addWidgetReceiver(m));
    const receivers = m.application?.[0]?.receiver ?? [];
    expect(receivers).toHaveLength(1);
    const r = receivers[0];
    expect(r?.$?.['android:name']).toBe('.KnWriterWidgetProvider');
    expect(r?.$?.['android:exported']).toBe('true');
    expect(r?.['intent-filter']?.[0]?.action[0]?.$?.['android:name']).toBe(
      'android.appwidget.action.APPWIDGET_UPDATE',
    );
    expect(r?.['meta-data']?.[0]?.$?.['android:resource']).toBe('@xml/kn_writer_widget_info');
  });

  it('is push-updated only and sized per the directive', () => {
    const info = res.WIDGET_RES['xml/kn_writer_widget_info.xml'] ?? '';
    expect(info).toContain('android:updatePeriodMillis="0"');
    expect(info).toContain('android:minWidth="180dp"');
    expect(info).toContain('android:minHeight="80dp"');
    expect(info).toContain('android:resizeMode="horizontal|vertical"');
  });

  it('ships light, night and Material You colours', () => {
    for (const dir of ['values', 'values-night', 'values-v31', 'values-night-v31'])
      expect(res.WIDGET_RES[`${dir}/kn_widget_colors.xml`]).toContain('kn_widget_bg');
    expect(plugin.PREFS).toBe('kn_writer_widget');
  });
});
