// OVERHAUL-03 (chained from with-android-release.js): offline split-chunk reader via
// androidx.webkit WebViewAssetLoader. `pnpm build:preview-assets` copies apps/reader/dist into
// android/app/src/main/assets/reader/, served at https://appassets.androidplatform.net/reader/
// (a real https origin: ES module chunks load lazily with no file:// CORS problems).
//
// Adds a lean native view `KnReaderWebView` (legacy ViewManager on the New Architecture interop):
// own android.webkit.WebView + WebViewAssetLoader, a `KnHostBridge.postMessage` JS interface that
// emits `onKnMessage`, and a `postMessage` command that calls `window.__knReceive(json)`.
// react-native-webview is never patched. androidx.webkit is a pure Java/Kotlin AAR: 0 `.so`,
// 0 permissions. OVERHAUL-04A: the active Android Live Preview transport (PreviewFrame.android.tsx,
// kill switch KN_ASSET_WEBVIEW_ENABLED); `reader-preview.html` remains the fallback.
const fs = require('fs');
const path = require('path');
const {
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
} = require('expo/config-plugins');

const WEBKIT = 'implementation("androidx.webkit:webkit:1.12.1") // kn-webview-assets';

const managerKt = (pkg) => `package ${pkg}

import android.annotation.SuppressLint
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.Event
import org.json.JSONObject

// kn-webview-assets: offline split reader served by WebViewAssetLoader (OVERHAUL-03).
class KnReaderMessageEvent(surfaceId: Int, viewTag: Int, private val data: String) :
  Event<KnReaderMessageEvent>(surfaceId, viewTag) {
  override fun getEventName(): String = EVENT
  override fun getEventData(): WritableMap = Arguments.createMap().apply { putString("data", data) }
  companion object { const val EVENT = "topKnMessage" }
}

class KnReaderWebViewManager : SimpleViewManager<WebView>() {
  override fun getName(): String = NAME

  @SuppressLint("SetJavaScriptEnabled")
  override fun createViewInstance(context: ThemedReactContext): WebView {
    val view = WebView(context)
    view.setBackgroundColor(android.graphics.Color.TRANSPARENT)
    val loader = WebViewAssetLoader.Builder()
      .setDomain(DOMAIN)
      .addPathHandler("/reader/", WebViewAssetLoader.AssetsPathHandler(context))
      .build()
    view.settings.apply {
      javaScriptEnabled = true
      domStorageEnabled = true
      allowFileAccess = false
      allowContentAccess = false
      mediaPlaybackRequiresUserGesture = false
    }
    view.webViewClient = object : WebViewClient() {
      override fun shouldInterceptRequest(v: WebView, request: WebResourceRequest): WebResourceResponse? =
        loader.shouldInterceptRequest(request.url)?.also { res ->
          // ES-module chunks must never be served as text/plain (strict MIME checking).
          mimeFor(request.url.path)?.let { res.mimeType = it }
        }

      override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean =
        request.url.host != DOMAIN

      override fun onReceivedError(v: WebView, request: WebResourceRequest, error: WebResourceError) {
        if (request.isForMainFrame) emit(context, v, native("kn-native-load-error", "description", error.description.toString()))
      }

      override fun onReceivedHttpError(v: WebView, request: WebResourceRequest, res: WebResourceResponse) {
        if (request.isForMainFrame) emit(context, v, native("kn-native-load-error", "description", "HTTP " + res.statusCode))
      }

      // A dead renderer must never take the host app down: report it and let JS remount the view.
      override fun onRenderProcessGone(v: WebView, detail: RenderProcessGoneDetail): Boolean {
        emit(context, v, native("kn-native-render-gone", "didCrash", detail.didCrash()))
        return true
      }
    }
    view.addJavascriptInterface(Bridge(context, view), "KnHostBridge")
    return view
  }

  private class Bridge(private val context: ThemedReactContext, private val view: WebView) {
    @JavascriptInterface
    fun postMessage(json: String) = emit(context, view, json)
  }

  @ReactProp(name = "sourcePath")
  fun setSourcePath(view: WebView, sourcePath: String?) {
    val target = "https://$DOMAIN/reader/" + (sourcePath ?: "index.html?preview=1")
    if (view.url != target) view.loadUrl(target)
  }

  // Fabric interop dispatches the string name; the legacy bridge may send the integer id.
  override fun getCommandsMap(): MutableMap<String, Int> = mutableMapOf("postMessage" to POST_MESSAGE)

  override fun receiveCommand(view: WebView, commandId: String, args: ReadableArray?) {
    if (commandId == "postMessage" || commandId == POST_MESSAGE.toString()) deliver(view, args)
  }

  @Deprecated("Legacy integer command path")
  override fun receiveCommand(view: WebView, commandId: Int, args: ReadableArray?) {
    if (commandId == POST_MESSAGE) deliver(view, args)
  }

  private fun deliver(view: WebView, args: ReadableArray?) {
    val json = args?.getString(0) ?: return
    view.evaluateJavascript("window.__knReceive && window.__knReceive(" + JSONObject.quote(json) + ")", null)
  }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
    mutableMapOf(KnReaderMessageEvent.EVENT to mapOf("registrationName" to "onKnMessage"))

  override fun onDropViewInstance(view: WebView) {
    super.onDropViewInstance(view)
    view.stopLoading()
    view.removeJavascriptInterface("KnHostBridge")
    view.destroy()
  }

  companion object {
    const val NAME = "KnReaderWebView"
    const val DOMAIN = "appassets.androidplatform.net"
    const val POST_MESSAGE = 1

    private val MIME = mapOf(
      "js" to "text/javascript", "mjs" to "text/javascript", "css" to "text/css",
      "html" to "text/html", "json" to "application/json", "wasm" to "application/wasm",
      "svg" to "image/svg+xml", "webmanifest" to "application/manifest+json",
    )

    fun mimeFor(path: String?): String? = MIME[path?.substringAfterLast('.', "")?.lowercase()]

    fun native(type: String, key: String, value: Any): String =
      JSONObject().put("type", type).put(key, value).toString()

    fun emit(context: ThemedReactContext, view: WebView, json: String) {
      view.post {
        UIManagerHelper.getEventDispatcher(context)
          ?.dispatchEvent(KnReaderMessageEvent(UIManagerHelper.getSurfaceId(view), view.id, json))
      }
    }
  }
}
`;

const packageKt = (pkg) => `package ${pkg}

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager

// kn-webview-assets: registers the KnReaderWebView view manager (New Architecture interop).
class KnReaderWebViewPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? = null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider { emptyMap() }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<in Nothing, in Nothing>> =
    listOf(KnReaderWebViewManager())
}
`;

function withWebkitDependency(config) {
  return withAppBuildGradle(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (!src.includes('kn-webview-assets')) {
      const anchor = /dependencies\s*\{/;
      if (!anchor.test(src))
        throw new Error('android-webview-assets: dependencies block not found');
      cfg.modResults.contents = src.replace(anchor, (m) => `${m}\n    ${WEBKIT}`);
    }
    return cfg;
  });
}

function withReaderPackage(config) {
  return withMainApplication(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (!src.includes('KnReaderWebViewPackage()')) {
      const anchor = /PackageList\(this\)\.packages\.apply \{/;
      if (!anchor.test(src))
        throw new Error('android-webview-assets: getPackages anchor not found');
      cfg.modResults.contents = src.replace(
        anchor,
        (m) => `${m}\n          add(KnReaderWebViewPackage())`,
      );
    }
    return cfg;
  });
}

function withReaderSources(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const pkg = cfg.android && cfg.android.package;
      if (!pkg) throw new Error('android-webview-assets: expo.android.package is required');
      const dir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app/src/main/java',
        ...pkg.split('.'),
      );
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'KnReaderWebViewManager.kt'), managerKt(pkg));
      fs.writeFileSync(path.join(dir, 'KnReaderWebViewPackage.kt'), packageKt(pkg));
      return cfg;
    },
  ]);
}

module.exports = function withAndroidWebviewAssets(config) {
  return withReaderSources(withReaderPackage(withWebkitDependency(config)));
};
module.exports.WEBKIT = WEBKIT;
module.exports.managerKt = managerKt;
module.exports.packageKt = packageKt;
