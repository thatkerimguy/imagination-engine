// Resource files for the home-screen writing widget (DIRECTIVE-07 E), used by android-widget.js.
// Material You: API 31+ picks the wallpaper-derived system palette (values-v31 / values-night-v31);
// older devices get the Folio ink/paper colours. Plain XML: zero libraries, zero .so files.

const colors = (bg, ink, muted, accent) => `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="kn_widget_bg">${bg}</color>
    <color name="kn_widget_ink">${ink}</color>
    <color name="kn_widget_muted">${muted}</color>
    <color name="kn_widget_accent">${accent}</color>
</resources>
`;

const LAYOUT = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/kn_widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/kn_widget_bg"
    android:orientation="vertical"
    android:gravity="center_vertical"
    android:padding="16dp">
    <TextView
        android:id="@+id/kn_widget_words"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:textColor="@color/kn_widget_accent"
        android:textSize="12sp"
        android:textStyle="bold"
        android:maxLines="1" />
    <TextView
        android:id="@+id/kn_widget_headline"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="4dp"
        android:textColor="@color/kn_widget_ink"
        android:textSize="17sp"
        android:fontFamily="serif"
        android:maxLines="2"
        android:ellipsize="end" />
    <TextView
        android:id="@+id/kn_widget_subline"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="2dp"
        android:textColor="@color/kn_widget_muted"
        android:textSize="13sp"
        android:maxLines="1"
        android:ellipsize="end" />
</LinearLayout>
`;

const BACKGROUND = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="@color/kn_widget_bg" />
    <corners android:radius="24dp" />
</shape>
`;

const INFO = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="180dp"
    android:minHeight="80dp"
    android:targetCellWidth="3"
    android:targetCellHeight="1"
    android:resizeMode="horizontal|vertical"
    android:updatePeriodMillis="0"
    android:initialLayout="@layout/kn_writer_widget"
    android:previewLayout="@layout/kn_writer_widget"
    android:description="@string/kn_widget_description"
    android:widgetCategory="home_screen" />
`;

const STRINGS = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="kn_widget_label">Writing</string>
    <string name="kn_widget_description">Today\\'s word count and one tap back to your chapter.</string>
</resources>
`;

/** Relative path under app/src/main/res → file contents. */
const WIDGET_RES = {
  'layout/kn_writer_widget.xml': LAYOUT,
  'drawable/kn_widget_bg.xml': BACKGROUND,
  'xml/kn_writer_widget_info.xml': INFO,
  'values/kn_widget_strings.xml': STRINGS,
  'values/kn_widget_colors.xml': colors('#FFFBF4E8', '#FF1F1B16', '#FF6B6257', '#FF8A5A2B'),
  'values-night/kn_widget_colors.xml': colors('#FF1A1714', '#FFF3EDE2', '#FFA59C8F', '#FFE0B07A'),
  'values-v31/kn_widget_colors.xml': colors(
    '@android:color/system_neutral1_50',
    '@android:color/system_neutral1_900',
    '@android:color/system_neutral2_700',
    '@android:color/system_accent1_600',
  ),
  'values-night-v31/kn_widget_colors.xml': colors(
    '@android:color/system_neutral1_900',
    '@android:color/system_neutral1_50',
    '@android:color/system_neutral2_200',
    '@android:color/system_accent1_200',
  ),
};

module.exports = { WIDGET_RES };
