// Local Expo config plugin: keeps the native Android additions reproducible across
// `expo prebuild --clean` (scripts/build-android-apk.ps1 regenerates android/ every build).
//  1. MainActivity requests the display's highest refresh-rate mode (120Hz panels; MIUI/HyperOS
//     otherwise caps sideloaded apps at 60Hz).
//  2. A zero-dependency MaterialYou native module exposes the Android 12+ wallpaper palette.
//  3. A zero-dependency SaveFile native module opens the system "Save file" picker
//     (ACTION_CREATE_DOCUMENT) so exports land where the Author chooses, not in the share sheet.
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withMainActivity, withMainApplication } = require('expo/config-plugins');

const MARK = '// kn-android-polish';

const REFRESH_RATE = `
    ${MARK}: ask for the highest refresh-rate mode (120Hz panels; MIUI caps sideloads at 60Hz).
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
      display?.supportedModes
        ?.maxByOrNull { it.refreshRate }
        ?.let { mode ->
          window.attributes = window.attributes.apply {
            preferredDisplayModeId = mode.modeId
          }
        }
    }`;

const moduleKt = (pkg) => `package ${pkg}

import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

${MARK}: Android 12+ Material You wallpaper palette, or null (older Android / OEM gaps).
class MaterialYouModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  companion object {
    const val NAME = "MaterialYou"
  }

  override fun getName(): String = NAME

  private fun hex(id: Int): String = String.format("#%06X", 0xFFFFFF and ctx.getColor(id))

  @ReactMethod
  fun getWallpaperPalette(isDark: Boolean, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      promise.resolve(null)
      return
    }
    try {
      val roles = if (isDark) linkedMapOf(
        "canvas" to android.R.color.system_neutral1_900,
        "surface" to android.R.color.system_neutral1_800,
        "surfaceElevated" to android.R.color.system_neutral1_700,
        "accent" to android.R.color.system_accent1_200,
        "warm" to android.R.color.system_accent3_200,
        "neutral" to android.R.color.system_neutral2_800
      ) else linkedMapOf(
        "canvas" to android.R.color.system_neutral1_50,
        "surface" to android.R.color.system_neutral1_100,
        "surfaceElevated" to android.R.color.system_neutral1_0,
        "accent" to android.R.color.system_accent1_600,
        "warm" to android.R.color.system_accent3_600,
        "neutral" to android.R.color.system_neutral2_100
      )
      val map = Arguments.createMap()
      for ((key, id) in roles) map.putString(key, hex(id))
      promise.resolve(map)
    } catch (e: Throwable) {
      promise.resolve(null)
    }
  }
}
`;

const saveFileKt = (pkg) => `package ${pkg}

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.util.Base64
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

${MARK}: system "Save file" picker. Resolves "saved" or "cancelled"; rejects only on IO errors.
class SaveFileModule(private val ctx: ReactApplicationContext) :
  ReactContextBaseJavaModule(ctx), ActivityEventListener {
  companion object {
    const val NAME = "SaveFile"
    private const val REQUEST_CODE = 0x4B57
  }

  private var pendingPromise: Promise? = null
  private var pendingData: String? = null

  init {
    ctx.addActivityEventListener(this)
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun saveFile(filename: String, mimeType: String, base64Data: String, promise: Promise) {
    if (pendingPromise != null) {
      promise.reject("E_SAVE_BUSY", "Another save is already waiting for the file picker.")
      return
    }
    val activity = ctx.currentActivity
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "The app is not in the foreground.")
      return
    }
    val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = mimeType
      putExtra(Intent.EXTRA_TITLE, filename)
    }
    pendingPromise = promise
    pendingData = base64Data
    try {
      activity.startActivityForResult(intent, REQUEST_CODE)
    } catch (e: Exception) {
      clearPending()
      promise.reject("E_NO_PICKER", "No file picker is available: \${e.message}", e)
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_CODE) return
    val promise = pendingPromise ?: return
    val payload = pendingData
    clearPending()
    val uri: Uri? = data?.data
    if (resultCode != Activity.RESULT_OK || uri == null || payload == null) {
      promise.resolve("cancelled")
      return
    }
    try {
      val bytes = Base64.decode(payload, Base64.DEFAULT)
      val out = ctx.contentResolver.openOutputStream(uri, "wt")
        ?: throw java.io.IOException("Could not open the chosen file for writing.")
      out.use { it.write(bytes) }
      promise.resolve("saved")
    } catch (e: Exception) {
      promise.reject("E_SAVE_FAILED", "Could not save the file: \${e.message}", e)
    }
  }

  override fun onNewIntent(intent: Intent) {}

  private fun clearPending() {
    pendingPromise = null
    pendingData = null
  }
}
`;

const packageKt = (pkg) => `package ${pkg}

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

${MARK}: registers MaterialYouModule and SaveFileModule (legacy modules, reached through the
// New Architecture interop).
class MaterialYouPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    when (name) {
      MaterialYouModule.NAME -> MaterialYouModule(reactContext)
      SaveFileModule.NAME -> SaveFileModule(reactContext)
      else -> null
    }

  private fun info(name: String, className: String) = ReactModuleInfo(
    name,
    className,
    false, // canOverrideExistingModule
    false, // needsEagerInit
    false, // isCxxModule
    false, // isTurboModule
  )

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      MaterialYouModule.NAME to info(MaterialYouModule.NAME, MaterialYouModule::class.java.name),
      SaveFileModule.NAME to info(SaveFileModule.NAME, SaveFileModule::class.java.name),
    )
  }
}
`;

function withRefreshRate(config) {
  return withMainActivity(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (cfg.modResults.language !== 'kt')
      throw new Error('with-android-polish: Kotlin MainActivity expected');
    if (!src.includes(MARK)) {
      const anchor = /super\.onCreate\((null|savedInstanceState)\)/;
      if (!anchor.test(src)) throw new Error('with-android-polish: super.onCreate not found');
      cfg.modResults.contents = src.replace(anchor, (m) => m + REFRESH_RATE);
    }
    return cfg;
  });
}

function withMaterialYouPackage(config) {
  return withMainApplication(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (!src.includes('MaterialYouPackage()')) {
      const anchor = /PackageList\(this\)\.packages\.apply \{/;
      if (!anchor.test(src)) throw new Error('with-android-polish: getPackages anchor not found');
      cfg.modResults.contents = src.replace(
        anchor,
        (m) => `${m}\n          add(MaterialYouPackage())`,
      );
    }
    return cfg;
  });
}

function withMaterialYouSources(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const pkg = cfg.android && cfg.android.package;
      if (!pkg) throw new Error('with-android-polish: expo.android.package is required');
      const dir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app/src/main/java',
        ...pkg.split('.'),
      );
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'MaterialYouModule.kt'), moduleKt(pkg));
      fs.writeFileSync(path.join(dir, 'MaterialYouPackage.kt'), packageKt(pkg));
      fs.writeFileSync(path.join(dir, 'SaveFileModule.kt'), saveFileKt(pkg));
      return cfg;
    },
  ]);
}

module.exports = function withAndroidPolish(config) {
  return withMaterialYouSources(withMaterialYouPackage(withRefreshRate(config)));
};
