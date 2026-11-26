// Local Expo config plugin (DIRECTIVE-03), required by with-android-release.js. Zero new
// dependencies and zero new .so files:
//  1. KnInput native module: `setLightNavigationBars` (dark 3-button nav icons while Folio is in
//     a light theme; no deprecated nav-bar colours) and `setShortcutCapture` (the Chapter Editor
//     opts in to hardware-keyboard shortcuts while it is mounted).
//  2. MainActivity.dispatchKeyEvent: Ctrl+<key> presses from a hardware keyboard are emitted to JS
//     as "knShortcut" device events while capture is on (Meta stays with the system). Plain
//     Escape (KEYCODE_ESCAPE, DIRECTIVE-06) is forwarded too, with `ctrl: false`.
//  3. MainActivity.onProvideKeyboardShortcuts (API 24+): Meta+/ lists the editor shortcuts in
//     Android's Keyboard Shortcuts Helper.
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withMainActivity, withMainApplication } = require('expo/config-plugins');

const MARK = '// kn-android-input';

/** Shown in the Meta+/ helper; must match HELPER_SHORTCUTS parity in shortcuts-native.test.ts. */
const HELPER_SHORTCUTS = [
  { label: 'Bold', key: 'B', shift: false },
  { label: 'Italic', key: 'I', shift: false },
  { label: 'Underline', key: 'U', shift: false },
  { label: 'Undo', key: 'Z', shift: false },
  { label: 'Redo', key: 'Z', shift: true },
  { label: 'Redo', key: 'Y', shift: false },
  { label: 'Find & replace', key: 'F', shift: false },
  { label: 'Save now', key: 'S', shift: false },
  { label: 'Live preview', key: 'P', shift: false },
  { label: 'Keyboard shortcuts', key: 'SLASH', shift: false },
];

const CAPTURED = ['B', 'I', 'U', 'Z', 'Y', 'F', 'S', 'P'];
/** The JS `KeyInput.key` emitted for a plain hardware Escape press. */
const ESCAPE_KEY = 'Escape';

const helperRows = HELPER_SHORTCUTS.map(
  (s) =>
    `      info("${s.label}", KeyEvent.KEYCODE_${s.key}, KeyEvent.META_CTRL_ON${
      s.shift ? ' or KeyEvent.META_SHIFT_ON' : ''
    }),`,
).join('\n');

const moduleKt = (pkg) => `package ${pkg}

import android.view.KeyEvent
import android.view.KeyboardShortcutGroup
import android.view.KeyboardShortcutInfo
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import java.lang.ref.WeakReference

${MARK}: system-bar appearance + hardware-keyboard shortcut bridge.
class KnInputModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  companion object {
    const val NAME = "KnInput"
    @Volatile private var capture = false
    @Volatile private var ctxRef: WeakReference<ReactApplicationContext>? = null

    private fun keyName(code: Int): String? = when (code) {
${CAPTURED.map((k) => `      KeyEvent.KEYCODE_${k} -> "${k.toLowerCase()}"`).join('\n')}
      KeyEvent.KEYCODE_SLASH -> "/"
      else -> null
    }

    /** True when the key press was handed to JS (and must not reach the focused view). */
    fun dispatch(event: KeyEvent): Boolean {
      if (!capture || event.action != KeyEvent.ACTION_DOWN || event.repeatCount != 0) return false
      if (event.keyCode == KeyEvent.KEYCODE_ESCAPE) {
        // Plain Escape closes the top panel (sheet -> popover -> Find), like web/iPad.
        if (event.isCtrlPressed || event.isMetaPressed || event.isAltPressed || event.isShiftPressed) return false
        return emit("${ESCAPE_KEY}", ctrl = false, shift = false)
      }
      if (!event.isCtrlPressed || event.isMetaPressed || event.isAltPressed) return false
      val key = keyName(event.keyCode) ?: return false
      return emit(key, ctrl = true, shift = event.isShiftPressed)
    }

    private fun emit(key: String, ctrl: Boolean, shift: Boolean): Boolean {
      val rc = ctxRef?.get() ?: return false
      if (!rc.hasActiveReactInstance()) return false
      val payload = Arguments.createMap().apply {
        putString("key", key)
        putBoolean("ctrl", ctrl)
        putBoolean("shift", shift)
      }
      rc.emitDeviceEvent("knShortcut", payload)
      return true
    }

    private fun info(label: String, code: Int, mods: Int) = KeyboardShortcutInfo(label, code, mods)

    fun helperGroup(): KeyboardShortcutGroup = KeyboardShortcutGroup(
      "Kinetic Writer · Chapter editor",
      listOf(
${helperRows}
      ),
    )
  }

  init {
    ctxRef = WeakReference(ctx)
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun setShortcutCapture(enabled: Boolean) {
    capture = enabled
  }

  @ReactMethod
  fun setLightNavigationBars(light: Boolean) {
    UiThreadUtil.runOnUiThread {
      val activity = ctx.currentActivity ?: return@runOnUiThread
      val window = activity.window ?: return@runOnUiThread
      WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightNavigationBars = light
    }
  }
}
`;

const packageKt = (pkg) => `package ${pkg}

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

${MARK}: registers KnInputModule (legacy module via the New Architecture interop).
class KnInputPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == KnInputModule.NAME) KnInputModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      KnInputModule.NAME to ReactModuleInfo(
        KnInputModule.NAME, KnInputModule::class.java.name, false, false, false, false,
      ),
    )
  }
}
`;

const ACTIVITY = `
  ${MARK}: Ctrl shortcuts from hardware keyboards go to JS while the editor captures them.
  override fun dispatchKeyEvent(event: android.view.KeyEvent): Boolean =
    KnInputModule.dispatch(event) || super.dispatchKeyEvent(event)

  ${MARK}: Meta+/ Keyboard Shortcuts Helper (API 24+).
  override fun onProvideKeyboardShortcuts(
    data: MutableList<android.view.KeyboardShortcutGroup>,
    menu: android.view.Menu?,
    deviceId: Int,
  ) {
    super.onProvideKeyboardShortcuts(data, menu, deviceId)
    data.add(KnInputModule.helperGroup())
  }
`;

function withInputActivity(config) {
  return withMainActivity(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (cfg.modResults.language !== 'kt')
      throw new Error('android-input: Kotlin MainActivity expected');
    if (!src.includes(MARK)) {
      const anchor = /class MainActivity\s*:\s*ReactActivity\(\)\s*\{/;
      if (!anchor.test(src)) throw new Error('android-input: MainActivity class not found');
      cfg.modResults.contents = src.replace(anchor, (m) => m + ACTIVITY);
    }
    return cfg;
  });
}

function withInputPackage(config) {
  return withMainApplication(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (!src.includes('KnInputPackage()')) {
      const anchor = /PackageList\(this\)\.packages\.apply \{/;
      if (!anchor.test(src)) throw new Error('android-input: getPackages anchor not found');
      cfg.modResults.contents = src.replace(anchor, (m) => `${m}\n          add(KnInputPackage())`);
    }
    return cfg;
  });
}

function withInputSources(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const pkg = cfg.android && cfg.android.package;
      if (!pkg) throw new Error('android-input: expo.android.package is required');
      const dir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app/src/main/java',
        ...pkg.split('.'),
      );
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'KnInputModule.kt'), moduleKt(pkg));
      fs.writeFileSync(path.join(dir, 'KnInputPackage.kt'), packageKt(pkg));
      return cfg;
    },
  ]);
}

module.exports = function withAndroidInput(config) {
  return withInputSources(withInputPackage(withInputActivity(config)));
};
module.exports.HELPER_SHORTCUTS = HELPER_SHORTCUTS;
module.exports.ESCAPE_KEY = ESCAPE_KEY;
module.exports.moduleKt = moduleKt;
