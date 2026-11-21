// Local Expo config plugin: keeps the native Android additions reproducible across
// `expo prebuild --clean` (scripts/build-android-apk.ps1 regenerates android/ every build).
//  1. MainActivity requests the display's highest refresh-rate mode (120Hz panels; MIUI/HyperOS
//     otherwise caps sideloaded apps at 60Hz).
//  2. A zero-dependency MaterialYou native module exposes the Android 12+ wallpaper palette.
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

const packageKt = (pkg) => `package ${pkg}

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

${MARK}: registers MaterialYouModule (a legacy module, reached through the New Architecture interop).
class MaterialYouPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == MaterialYouModule.NAME) MaterialYouModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      MaterialYouModule.NAME to ReactModuleInfo(
        MaterialYouModule.NAME,
        MaterialYouModule::class.java.name,
        false, // canOverrideExistingModule
        false, // needsEagerInit
        false, // isCxxModule
        false, // isTurboModule
      ),
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
      return cfg;
    },
  ]);
}

module.exports = function withAndroidPolish(config) {
  return withMaterialYouSources(withMaterialYouPackage(withRefreshRate(config)));
};
