// Local Expo config plugin (DIRECTIVE-07 E), required by with-android-release.js: a privacy-aware
// home-screen writing widget in plain Kotlin (AppWidgetProvider + RemoteViews). Zero third-party
// libraries, zero .so files, zero background polling (`updatePeriodMillis="0"`): JS pushes a
// payload on chapter save / workspace open / lock change via the KnWidget native module, which
// stores it in the `kn_writer_widget` SharedPreferences (excluded from backup by
// android-backup-rules.js) and broadcasts APPWIDGET_UPDATE. Redaction happens in JS
// (src/widget/widget-state.ts) before anything reaches the home screen.
const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
} = require('expo/config-plugins');
const { WIDGET_RES } = require('./android-widget-res');

const MARK = '// kn-android-widget';
const PREFS = 'kn_writer_widget';
const RECEIVER = '.KnWriterWidgetProvider';

const providerKt = (pkg) => `package ${pkg}

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

${MARK}: home-screen writing widget. Shows only what JS already redacted.
class KnWriterWidgetProvider : AppWidgetProvider() {
  companion object {
    const val PREFS = "${PREFS}"
    private const val FALLBACK_TITLE = "Imagination Engine"
    private const val FALLBACK_SUB = "Tap to start writing"
    private const val ROOT_URI = "kinetic-writer://"

    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, KnWriterWidgetProvider::class.java))
      if (ids.isEmpty()) return
      val intent = Intent(context, KnWriterWidgetProvider::class.java).apply {
        action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
      }
      context.sendBroadcast(intent)
    }
  }

  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val headline = prefs.getString("headline", null) ?: FALLBACK_TITLE
    val subline = prefs.getString("subline", null) ?: FALLBACK_SUB
    val words = prefs.getString("todayWordsLabel", null) ?: ""
    val uri = prefs.getString("deepLinkUri", null) ?: ROOT_URI
    val launch = Intent(Intent.ACTION_VIEW, Uri.parse(uri)).apply {
      setClass(context, MainActivity::class.java)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    val pending = PendingIntent.getActivity(
      context, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    for (id in ids) {
      val views = RemoteViews(context.packageName, R.layout.kn_writer_widget).apply {
        setTextViewText(R.id.kn_widget_headline, headline)
        setTextViewText(R.id.kn_widget_subline, subline)
        setTextViewText(R.id.kn_widget_words, words)
        setOnClickPendingIntent(R.id.kn_widget_root, pending)
      }
      manager.updateAppWidget(id, views)
    }
  }
}
`;

const moduleKt = (pkg) => `package ${pkg}

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

${MARK}: JS -> SharedPreferences -> APPWIDGET_UPDATE.
class KnWidgetModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  companion object {
    const val NAME = "KnWidget"
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun updateWidget(headline: String, subline: String, todayWordsLabel: String, deepLinkUri: String) {
    ctx.getSharedPreferences(KnWriterWidgetProvider.PREFS, Context.MODE_PRIVATE).edit()
      .putString("headline", headline)
      .putString("subline", subline)
      .putString("todayWordsLabel", todayWordsLabel)
      .putString("deepLinkUri", deepLinkUri)
      .apply()
    KnWriterWidgetProvider.refreshAll(ctx)
  }
}
`;

const packageKt = (pkg) => `package ${pkg}

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

${MARK}: registers KnWidgetModule (legacy module via the New Architecture interop).
class KnWidgetPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == KnWidgetModule.NAME) KnWidgetModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      KnWidgetModule.NAME to ReactModuleInfo(
        KnWidgetModule.NAME, KnWidgetModule::class.java.name, false, false, false, false,
      ),
    )
  }
}
`;

/** Adds (once) the widget receiver to <application> (mutates). */
function addWidgetReceiver(manifest) {
  const app = manifest.application && manifest.application[0];
  if (!app) throw new Error('android-widget: <application> not found');
  const receivers = (app.receiver = app.receiver || []);
  if (receivers.some((r) => r.$ && r.$['android:name'] === RECEIVER)) return manifest;
  receivers.push({
    $: {
      'android:name': RECEIVER,
      'android:exported': 'true',
      'android:label': '@string/kn_widget_label',
    },
    'intent-filter': [
      { action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }] },
    ],
    'meta-data': [
      {
        $: {
          'android:name': 'android.appwidget.provider',
          'android:resource': '@xml/kn_writer_widget_info',
        },
      },
    ],
  });
  return manifest;
}

function withWidgetManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    addWidgetReceiver(cfg.modResults.manifest);
    return cfg;
  });
}

function withWidgetPackage(config) {
  return withMainApplication(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (!src.includes('KnWidgetPackage()')) {
      const anchor = /PackageList\(this\)\.packages\.apply \{/;
      if (!anchor.test(src)) throw new Error('android-widget: getPackages anchor not found');
      cfg.modResults.contents = src.replace(
        anchor,
        (m) => `${m}\n          add(KnWidgetPackage())`,
      );
    }
    return cfg;
  });
}

function withWidgetSources(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const pkg = cfg.android && cfg.android.package;
      if (!pkg) throw new Error('android-widget: expo.android.package is required');
      const main = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main');
      const dir = path.join(main, 'java', ...pkg.split('.'));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'KnWriterWidgetProvider.kt'), providerKt(pkg));
      fs.writeFileSync(path.join(dir, 'KnWidgetModule.kt'), moduleKt(pkg));
      fs.writeFileSync(path.join(dir, 'KnWidgetPackage.kt'), packageKt(pkg));
      for (const [rel, body] of Object.entries(WIDGET_RES)) {
        const file = path.join(main, 'res', rel);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, body);
      }
      return cfg;
    },
  ]);
}

module.exports = function withAndroidWidget(config) {
  return withWidgetSources(withWidgetPackage(withWidgetManifest(config)));
};
module.exports.addWidgetReceiver = addWidgetReceiver;
module.exports.PREFS = PREFS;
